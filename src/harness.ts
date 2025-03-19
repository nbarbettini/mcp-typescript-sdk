#!/usr/bin/env node
import 'dotenv/config'; // Load environment variables from .env file
import express from 'express';
import { StreamableHttpServerTransport } from './server/streamableHttp.js';
import { Server } from './server/index.js';
import cors from 'cors';

/**
 * Configuration options for the MCP Server Harness
 */
export interface McpHarnessOptions {
  /** The port to run the server on */
  port?: number;
  /** The server name to display in UI and logs */
  serverName: string;
  /** HTML content to display on the root page */
  rootPageContent?: string;
}

/**
 * Initialize an MCP server and connect it to a transport
 */
export type ServerInitializer = (transport: StreamableHttpServerTransport) => Promise<void>;

/**
 * A simple harness that provides HTTP server functionality for MCP protocol servers.
 * This creates a minimal Express server with an MCP endpoint.
 */
export function startMcpServer(
  initializeServer: ServerInitializer | Server,
  options: McpHarnessOptions
): void {
  const app = express();
  const port = options.port || parseInt(process.env.PORT || "3000");
  const serverName = options.serverName;
  const transports = new Map<string, StreamableHttpServerTransport>();

  // Configure Express
  app.use(express.json());
  app.use(cors());

  // Set up the root page
  app.get('/', (req, res) => {
    if (options.rootPageContent) {
      res.send(options.rootPageContent);
    } else {
      res.send(getDefaultRootPage(serverName));
    }
  });

  // Set up the MCP endpoint
  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Find existing transport for this session, or create a new one
    let transport: StreamableHttpServerTransport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId)!;
      console.error(`Using existing transport for session ${sessionId}`);
    } else {
      // Create a new transport
      transport = new StreamableHttpServerTransport();

      // Connect the server to this transport
      if (initializeServer instanceof Server) {
        // If a server instance was passed, connect it directly
        await initializeServer.connect(transport);
      } else {
        // Use the initializer function
        await initializeServer(transport);
      }

      // Store the transport by its session ID
      transports.set(transport.sessionId, transport);
      console.error(`Created new transport with session ID: ${transport.sessionId}`);

      // Remove the transport when the connection is closed
      transport.onclose = () => {
        console.error(`Closing transport for session: ${transport.sessionId}`);
        transports.delete(transport.sessionId);
      };
    }

    console.error(`Handling ${req.method} request to /mcp`);

    // Handle the request (this handles both GET and POST methods)
    // Pass the already parsed body from express.json() middleware
    await transport.handleRequest(req, res, req.body);
  });

  // Start the server
  app.listen(port, () => {
    console.error(`${serverName} running on HTTP port ${port}`);
    console.error(`MCP endpoint available at http://localhost:${port}/mcp`);
  });
}

/**
 * Generate a default HTML page for the root endpoint
 */
function getDefaultRootPage(serverName: string): string {
  return `
    <html>
      <head>
        <title>${serverName}</title>
        <style>
          body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>${serverName}</h1>
        <p>This server implements the MCP protocol over HTTP transport.</p>
        <p>The MCP endpoint is available at <code>/mcp</code>.</p>
      </body>
    </html>
  `;
}