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
}

interface UseHttpResponse<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  cancel: () => void;
  wsData: any;
  sendMessage: (message: any) => void;
  closeWebSocket: () => void;
}

export function useDataFetcher<T = any>({
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
}: UseHttpOptions): UseHttpResponse<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wsData, setWsData] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      closeWebSocket(); // Close WebSocket on unmount
    };
  }, []);

  const fetchData = useCallback(async (attempts = 0) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Exponential Backoff (100ms → 200ms → 400ms → max 5s)
    const retryDelay = Math.min(100 * 2 ** attempts, 5000);

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
          data: isFormData ? body : JSON.stringify(body),
          params: queryParams,
          signal: abortControllerRef.current.signal,
          withCredentials: credentials,
        };

        const response: AxiosResponse<T> = await axios(config);
        if (isMounted.current) setData(response.data);
      } catch (err: any) {
        if (axios.isCancel(err)) return;
        if (attempts < retry) {
          setTimeout(() => fetchData(attempts + 1), retryDelay);
        } else {
          if (isMounted.current) setError(err.message || "Something went wrong");
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    }, debounce);
  }, [url, method, body, headers, queryParams, retry, debounce, baseUrl, credentials]);

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
    const connectWebSocket = () => {
      if (wsRef.current) return;

      wsRef.current = new WebSocket(wsUrl);
      console.log("Connecting WebSocket:", wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket Connected");
        reconnectAttempts = 0;
      };

      wsRef.current.onmessage = (event) => {
        if (isMounted.current) setWsData(JSON.parse(event.data));
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket Disconnected");
        wsRef.current = null;
        if (isMounted.current && reconnectAttempts < retry) {
          reconnectAttempts++;
          setTimeout(connectWebSocket, 1000 * reconnectAttempts);
        }
      };
    };

    connectWebSocket();
    return () => closeWebSocket();
  }, [wsUrl, retry]);

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not connected. Message not sent.");
    }
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
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
  };
}

// Factory function for reusable configurations
export function createDataFetcher<T>(defaultOptions: UseHttpOptions) {
  return function useFetcher(options?: UseHttpOptions): UseHttpResponse<T> {
    return useDataFetcher<T>({ ...defaultOptions, ...(options ?? {}) });
  };
}
