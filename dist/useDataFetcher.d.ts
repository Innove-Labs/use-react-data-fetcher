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
export declare function useDataFetcher<T = any>({ url, method, body, headers, queryParams, autoFetch, retry, debounce, baseUrl, credentials, autoRefresh, wsUrl, }: UseHttpOptions): UseHttpResponse<T>;
export declare function createDataFetcher<T>(defaultOptions: UseHttpOptions): (options?: UseHttpOptions) => UseHttpResponse<T>;
export {};
