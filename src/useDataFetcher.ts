import { useState, useEffect, useCallback, useRef } from "react";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface UseHttpOptions {
  url: string;
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  queryParams?: Record<string, any>;
  autoFetch?: boolean;
  retry?: number;
  debounce?: number;
  baseUrl?: string;
  credentials?: boolean;
  autoRefresh?: number;
  wsUrl?: string;
  timeout?: number;
}

interface UseHttpResponse<TResponse> {
  data: TResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  cancel: () => void;
  wsData: TResponse | null;
  sendMessage: (message: any) => void;
  closeWebSocket: () => void;
  wsState: "connecting" | "open" | "closed" | "error";
}

export function useDataFetcher<TResponse = any>({
  url,
  method = "GET",
  body,
  headers,
  queryParams,
  autoFetch = true,
  retry = 0,
  debounce = 300,
  baseUrl,
  credentials = false,
  autoRefresh = 0,
  wsUrl,
  timeout = 15000,
}: UseHttpOptions): UseHttpResponse<TResponse> {
  const [data, setData] = useState<TResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wsData, setWsData] = useState<any | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const latestRequestIdRef = useRef<number>(0);
  const [wsState, setWsState] = useState<"connecting" | "open" | "closed" | "error">("connecting");
  const [wsMessagesQueue, setWsMessagesQueue] = useState<any[]>([]);
  const [isFirst, setIsFirst] = useState(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      closeWebSocket();
      if(wsRef?.current) wsRef.current?.close();
    };
  }, []);

  // handling messages in the queue that were sent before the connection was open
  useEffect(() => {
    if (wsState === "open" && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsMessagesQueue.length) {
      wsMessagesQueue.forEach((message) => {
        wsRef.current?.send(JSON.stringify(message));
      });
      setWsMessagesQueue([]);
    }
  }, [wsState, wsMessagesQueue]);

  const fetchData = useCallback(async (attempts = 0) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const retryDelay = Math.min(100 * 2 ** attempts, 5000);
    const requestId = Date.now(); // Unique identifier for this request
    const currentRequestId = requestId; // Capture for closure

    timeoutRef.current = setTimeout(async () => {
      try {
        if (!isMounted.current) return;
        setLoading(true);
        setError(null);

        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        const isFormData = body instanceof FormData;
        const config: AxiosRequestConfig = {
          baseURL: baseUrl,
          method,
          url,
          headers: isFormData
            ? { ...headers }
            : { "Content-Type": "application/json", ...headers },
          params: queryParams,
          signal: abortControllerRef.current.signal,
          withCredentials: credentials,
          timeout: timeout,
        };

        if(method !== "GET" && body) {
          config.data = body;
        }

        const response: AxiosResponse<TResponse> = await axios(config);
        
        // Only update state if this is still the most recent request
        if (isMounted.current && currentRequestId === latestRequestIdRef.current) {
          setData(response.data);
        }
      } catch (err: any) {
        if (axios.isCancel(err)) return;
        if (attempts < retry) {
          setTimeout(() => fetchData(attempts + 1), retryDelay);
        } else {
          if (isMounted.current && currentRequestId === latestRequestIdRef.current) {
            setError(err.response?.data?.message || err.message || "Something went wrong");
          }
        }
      } finally {
        if (isMounted.current && currentRequestId === latestRequestIdRef.current) {
          setLoading(false);
        }
      }
    }, !isFirst ? debounce : 0);
    
    // Update the latest request ID
    latestRequestIdRef.current = requestId;
    setIsFirst(false);
  }, [url, method, body, headers, queryParams, retry, debounce, baseUrl, credentials, timeout]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    if (autoFetch && !wsUrl) {
      fetchDataRef.current();
    }
  }, [autoFetch, wsUrl]);

  // ===========================
  // WebSocket Logic
  // ===========================
  useEffect(() => {
    if (!wsUrl) return;

    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = retry * 2; // Adding a maximum limit for reconnections
    
    const connectWebSocket = () => {
      if (wsRef.current) return;

      wsRef.current = new WebSocket(wsUrl);
      console.log("Connecting WebSocket:", wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket Connected");
        reconnectAttempts = 0;
        setWsState("open");
      };

      wsRef.current.onmessage = (event) => {
        try {
          if (isMounted.current) setWsData(JSON.parse(event.data));
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
          setError("Failed to parse WebSocket message");
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setWsState("error");
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket Disconnected");
        wsRef.current = null;
        setWsState("closed");
        if (isMounted.current && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, 1000 * Math.min(reconnectAttempts, 30)); // Cap at 30 seconds
        }
      };
    };

    connectWebSocket();
    return () => closeWebSocket();
  }, [wsUrl, retry, isMounted]);

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected. Message not sent.");
      setWsMessagesQueue((prev) => [...prev, message]);
    }
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsState("closed");
    }
  };

  // ===========================
  // Auto Refresh Logic
  // ===========================
  useEffect(() => {
    if (!autoRefresh || wsUrl) return;

    const interval = setInterval(() => {
      fetchDataRef.current();
    }, autoRefresh);

    return () => clearInterval(interval);
  }, [autoRefresh, wsUrl]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchDataRef.current(),
    cancel: () => abortControllerRef.current?.abort(),
    wsData,
    sendMessage,
    closeWebSocket,
    wsState
  };
}

// Factory function for reusable configurations
export function createDataFetcher<TResponse>(defaultOptions: UseHttpOptions) {
  return function useFetcher(options?: UseHttpOptions): UseHttpResponse<TResponse> {
    return useDataFetcher<TResponse>({ ...defaultOptions, ...(options ?? {}) });
  };
}