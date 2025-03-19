# MCP Server Harness

This harness provides a reusable HTTP server setup for running MCP protocol servers. It handles:

- Setting up Express server with proper middleware
- Managing HTTP routes and sessions
- Providing a clean UI at the root endpoint
- Mapping session IDs to transport instances
- Cleaning up closed sessions

## Basic Usage

```typescript
import { startMcpServer } from "./harness.js";
import { StreamableHttpServerTransport } from "./server/streamableHttp.js";
import { Server } from "./server/index.js";

// Initialize your server with a transport
async function initializeMyServer(
  transport: StreamableHttpServerTransport
): Promise<void> {
  const server = new Server({
    name: "My MCP Server",
    version: "1.0.0",
  });

  // Set up your request handlers here
  // server.setRequestHandler(...);

  // Connect the server to the transport
  await server.connect(transport);
}

// Start the server with our harness
startMcpServer(initializeMyServer, {
  port: 3000,
  serverName: "My MCP Server",
});
```

## Examples

### 1. Slack MCP Server

See `server-slack.ts` for a complete implementation that uses the harness to serve Slack API tools.

The key parts are:

1. Export an initializer function that takes a transport:

   ```typescript
   export async function initializeSlackServer(
     transport: StreamableHttpServerTransport,
     botToken: string,
     teamId: string
   ): Promise<void> {
     // Set up your server and connect it to the transport
   }
   ```

2. Use the harness in your main function:
   ```typescript
   startMcpServer(
     (transport) => initializeSlackServer(transport, botToken, teamId),
     {
       port,
       serverName: "Slack MCP Server",
     }
   );
   ```

### 2. Echo MCP Server

See `server-echo.ts` for a simpler example that implements basic echo and random number tools.

## API Reference

### startMcpServer(initializeServer, options)

Starts an HTTP server for an MCP implementation.

**Parameters:**

- `initializeServer`: `(transport: StreamableHttpServerTransport) => Promise<void>`
  A function that initializes your MCP server and connects it to the provided transport

- `options`: `McpHarnessOptions`
  - `port`: Port number (default: 3000)
  - `serverName`: Name to display in UI and logs

## Benefits

- **Separation of Concerns**: Keep your server logic separate from HTTP details
- **Reusability**: Run different MCP servers with the same harness
- **Session Management**: Automatically handles session tracking and cleanup
- **Built-in UI**: Provides a default UI at the root endpoint
