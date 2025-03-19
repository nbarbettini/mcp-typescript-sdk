#!/usr/bin/env node
import { Server } from "./server/index.js";
import { StreamableHttpServerTransport } from "./server/streamableHttp.js";
import { Tool } from "./types.js";
import { startMcpServer } from "./harness.js";
import { z } from "zod";

// Define the Echo tool
const echoTool: Tool = {
  name: "echo",
  description: "Echo back the input message",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to echo back",
      },
    },
    required: ["message"],
  },
};

// Define a random number tool
const randomTool: Tool = {
  name: "random",
  description: "Generate a random number in a given range",
  inputSchema: {
    type: "object",
    properties: {
      min: {
        type: "number",
        description: "The minimum value of the range",
        default: 1,
      },
      max: {
        type: "number",
        description: "The maximum value of the range",
        default: 100,
      },
    },
  },
};

/**
 * Initialize the Echo MCP server
 */
export async function initializeEchoServer(
  transport: StreamableHttpServerTransport
): Promise<void> {
  console.error("Initializing Echo MCP Server...");

  const server = new Server(
    {
      name: "Echo MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Set up the echo tool
  server.setRequestHandler(
    z.object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number()]),
      method: z.literal("tools/call"),
      params: z.object({
        name: z.string(),
        arguments: z.object({}).passthrough(),
      }),
    }),
    async (request) => {
      console.error("Received tool call request:", request);
      try {
        switch (request.params.name) {
          case "echo": {
            const message = request.params.arguments?.message as string;
            if (!message) {
              throw new Error("Missing required argument: message");
            }
            return {
              content: [{ type: "text", text: `Echo: ${message}` }],
            };
          }

          case "random": {
            const min = Number(request.params.arguments?.min || 1);
            const max = Number(request.params.arguments?.max || 100);
            const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
            return {
              content: [
                {
                  type: "text",
                  text: `Random number between ${min} and ${max}: ${randomValue}`
                }
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        console.error("Error executing tool:", error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  );

  // Set up the list tools handler
  server.setRequestHandler(
    z.object({
      jsonrpc: z.literal("2.0"),
      id: z.union([z.string(), z.number()]),
      method: z.literal("tools/list"),
      params: z.object({}),
    }),
    async () => {
      console.error("Received tools/list request");
      return {
        tools: [echoTool, randomTool],
      };
    },
  );

  // Connect the server to the provided transport
  await server.connect(transport);
}

// Main entry point for the script
async function main() {
  const port = parseInt(process.env.PORT || "3000");

  // Start the server with our harness
  startMcpServer(
    (transport) => initializeEchoServer(transport),
    {
      port,
      serverName: "Echo MCP Server",
    }
  );
}

// Only run if this is the main module (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}