## useDataFetcher - A Powerful React Hook for HTTP & WebSocket Requests

`useDataFetcher` is a fully featured React hook that simplifies making HTTP requests with support for retries, auto-refresh, FormData, and WebSockets.

### ✨ Features
- ✅ **Supports all HTTP methods** (`GET`, `POST`, `PUT`, `DELETE`)
- ✅ **Auto-retry** failed requests with exponential backoff
- ✅ **Auto-refresh** data at a specified interval
- ✅ **Debounce** requests to prevent excessive calls
- ✅ **FormData support** for file uploads
- ✅ **WebSocket support** with real-time updates
- ✅ **Abort & cancel ongoing requests**

### 📦 Installation

```sh
npm install use-data-fetcher
```

or

```sh
yarn add use-data-fetcher
```

### 🚀 Usage

#### Basic Usage (HTTP Request)
```tsx
import { useDataFetcher } from "use-data-fetcher";

function MyComponent() {
  const { data, loading, error, refetch } = useDataFetcher({
    url: "https://api.example.com/data",
    method: "GET",
    autoFetch: true,
    retry: 3,
    debounce: 500,
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <button onClick={refetch}>Refresh Data</button>
    </div>
  );
}
```

#### FormData Example (File Upload)
```tsx
function FileUpload() {
  const { data, loading, error, refetch } = useDataFetcher({
    url: "https://api.example.com/upload",
    method: "POST",
    body: new FormData(),
    headers: { "Authorization": "Bearer token" },
  });

  return <button onClick={refetch}>Upload</button>;
}
```

#### WebSocket Example
```tsx
function WebSocketExample() {
  const { wsData, sendMessage, closeWebSocket } = useDataFetcher({
    wsUrl: "wss://example.com/socket",
  });

  return (
    <div>
      <p>WebSocket Message: {JSON.stringify(wsData)}</p>
      <button onClick={() => sendMessage({ type: "ping" })}>Send Message</button>
      <button onClick={closeWebSocket}>Close WebSocket</button>
    </div>
  );
}
```

### 🎛 API Reference

#### `useDataFetcher(options: UseHttpOptions)`
##### **Options**
| Property      | Type                  | Default | Description |
|--------------|-----------------------|---------|-------------|
| `url`        | `string`               | `""`     | The API endpoint to fetch data from. |
| `method`     | `'GET' | 'POST' | 'PUT' | 'DELETE'` | `'GET'` | The HTTP method to use. |
| `body`       | `any`                  | `null`   | Request payload (supports JSON & FormData). |
| `headers`    | `Record<string, string>` | `{}`     | Additional request headers. |
| `queryParams` | `Record<string, any>`  | `{}`     | URL query parameters. |
| `autoFetch`  | `boolean`              | `true`   | Automatically fetch data on mount. |
| `retry`      | `number`               | `0`      | Number of times to retry on failure. |
| `debounce`   | `number` (ms)          | `300`    | Delay before making a request. |
| `autoRefresh` | `number` (ms)         | `0`      | Interval for auto-refreshing data. |
| `baseUrl`    | `string`               | `""`     | Base URL for requests. |
| `credentials` | `boolean`             | `false`  | Include credentials in requests. |
| `wsUrl`      | `string`               | `""`     | WebSocket URL (disables HTTP fetch). |

##### **Return Value**
| Property         | Type        | Description |
|-----------------|------------|-------------|
| `data`          | `T | null`  | Response data. |
| `loading`       | `boolean`   | Indicates loading state. |
| `error`         | `string | null` | Error message if request fails. |
| `refetch`       | `() => void` | Function to manually refetch data. |
| `cancel`        | `() => void` | Cancel an ongoing request. |
| `wsData`        | `any`       | Latest WebSocket message. |
| `sendMessage`   | `(message: any) => void` | Sends a message over WebSocket. |
| `closeWebSocket` | `() => void` | Closes the WebSocket connection. |
| `wsState`       | `"connecting" or "open" or "closed" or "error"` | Websocket connection status |

#### `createDataFetcher(defaultOptions: UseHttpOptions)`
Returns a custom `useFetcher` hook with preconfigured options.

```tsx
const useCustomFetcher = createDataFetcher({ baseUrl: "https://api.example.com" });
const { data } = useCustomFetcher({ url: "/posts" });
```

### 🛠 Best Practices
- Use `retry` for handling intermittent failures.
- Avoid `autoRefresh` when using `wsUrl` (WebSocket handles real-time updates).
- Call `closeWebSocket` when leaving a WebSocket-enabled component.

### 🔥 Contributions
Contributions are welcome! Feel free to open issues and PRs.

### 📜 License
MIT License. Made with ❤️ for React developers.

