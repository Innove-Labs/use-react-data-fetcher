"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDataFetcher = useDataFetcher;
exports.createDataFetcher = createDataFetcher;
const react_1 = require("react");
const axios_1 = __importDefault(require("axios"));
function useDataFetcher({ url, method = "GET", body, headers, queryParams, autoFetch = true, retry = 0, debounce = 300, baseUrl, credentials = false, autoRefresh = 0, wsUrl, }) {
    const [data, setData] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [wsData, setWsData] = (0, react_1.useState)(null);
    const wsRef = (0, react_1.useRef)(null);
    const abortControllerRef = (0, react_1.useRef)(null);
    const timeoutRef = (0, react_1.useRef)(null);
    const isMounted = (0, react_1.useRef)(true);
    (0, react_1.useEffect)(() => {
        isMounted.current = true;
        return () => {
            var _a;
            isMounted.current = false;
            (_a = abortControllerRef.current) === null || _a === void 0 ? void 0 : _a.abort();
            if (timeoutRef.current)
                clearTimeout(timeoutRef.current);
            closeWebSocket(); // Close WebSocket on unmount
        };
    }, []);
    const fetchData = (0, react_1.useCallback)((...args_1) => __awaiter(this, [...args_1], void 0, function* (attempts = 0) {
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
        // Exponential Backoff (100ms → 200ms → 400ms → max 5s)
        const retryDelay = Math.min(100 * 2 ** attempts, 5000);
        timeoutRef.current = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                if (!isMounted.current)
                    return;
                setLoading(true);
                setError(null);
                (_a = abortControllerRef.current) === null || _a === void 0 ? void 0 : _a.abort();
                abortControllerRef.current = new AbortController();
                const isFormData = body instanceof FormData;
                const config = {
                    baseURL: baseUrl,
                    method,
                    url,
                    headers: isFormData
                        ? Object.assign({}, headers) : Object.assign({ "Content-Type": "application/json" }, headers),
                    data: isFormData ? body : JSON.stringify(body),
                    params: queryParams,
                    signal: abortControllerRef.current.signal,
                    withCredentials: credentials,
                };
                const response = yield (0, axios_1.default)(config);
                if (isMounted.current)
                    setData(response.data);
            }
            catch (err) {
                if (axios_1.default.isCancel(err))
                    return;
                if (attempts < retry) {
                    setTimeout(() => fetchData(attempts + 1), retryDelay);
                }
                else {
                    if (isMounted.current)
                        setError(err.message || "Something went wrong");
                }
            }
            finally {
                if (isMounted.current)
                    setLoading(false);
            }
        }), debounce);
    }), [url, method, body, headers, queryParams, retry, debounce, baseUrl, credentials]);
    const fetchDataRef = (0, react_1.useRef)(fetchData);
    (0, react_1.useEffect)(() => {
        fetchDataRef.current = fetchData;
    }, [fetchData]);
    (0, react_1.useEffect)(() => {
        if (autoFetch && !wsUrl) {
            fetchDataRef.current();
        }
    }, [autoFetch, wsUrl]);
    // ===========================
    // WebSocket Logic
    // ===========================
    (0, react_1.useEffect)(() => {
        if (!wsUrl)
            return;
        let reconnectAttempts = 0;
        const connectWebSocket = () => {
            if (wsRef.current)
                return;
            wsRef.current = new WebSocket(wsUrl);
            console.log("Connecting WebSocket:", wsUrl);
            wsRef.current.onopen = () => {
                console.log("WebSocket Connected");
                reconnectAttempts = 0;
            };
            wsRef.current.onmessage = (event) => {
                if (isMounted.current)
                    setWsData(JSON.parse(event.data));
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
    const sendMessage = (message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
        else {
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
    (0, react_1.useEffect)(() => {
        if (!autoRefresh || wsUrl)
            return;
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
        cancel: () => { var _a; return (_a = abortControllerRef.current) === null || _a === void 0 ? void 0 : _a.abort(); },
        wsData,
        sendMessage,
        closeWebSocket,
    };
}
// Factory function for reusable configurations
function createDataFetcher(defaultOptions) {
    return function useFetcher(options) {
        return useDataFetcher(Object.assign(Object.assign({}, defaultOptions), (options !== null && options !== void 0 ? options : {})));
    };
}
