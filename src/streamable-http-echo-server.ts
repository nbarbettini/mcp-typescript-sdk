// streamable-http-echo-server.ts
import express from 'express';
import { McpServer, ResourceTemplate } from './server/mcp.js';
import { StreamableHttpServerTransport } from './server/streamableHttp.js';
import { z } from 'zod';
import cors from 'cors';

// Create an MCP server
const server = new McpServer({
  name: "Echo",
  version: "1.0.0"
});

// Add an echo resource that reflects back the message
server.resource(
  "echo",
  new ResourceTemplate("echo://{message}", { list: undefined }),
  async (uri, { message }) => ({
    contents: [{
      uri: uri.href,
      text: `Resource echo: ${message}`
    }]
  })
);

// Add an echo tool that reflects back the message
server.tool(
  "echo",
  { message: z.string() },
  async ({ message }) => ({
    content: [{ type: "text", text: `Tool echo: ${message}` }]
  })
);

// Add a random number generator tool
server.tool(
  "random",
  { min: z.number({ description: "The minimum value of the range" }), max: z.number({ description: "The maximum value of the range" }) },
  async ({ min, max }) => ({
    content: [{ type: "text", text: `Random number between ${min} and ${max}: ${Math.floor(Math.random() * (max - min + 1)) + min}` }]
  })
);

// Add an echo prompt template
server.prompt(
  "echo",
  { message: z.string() },
  ({ message }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please process this message: ${message}`
      }
    }]
  })
);

// Set up Express server
const app = express();
app.use(express.json());
app.use(cors()); // Allow cross-origin requests for easier testing

// Set up a session management system
const transports = new Map<string, StreamableHttpServerTransport>();

// Add a simple info page at the root
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>MCP Streamable HTTP Echo Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto; }
          h2 { margin-top: 30px; }
        </style>
      </head>
      <body>
        <h1>MCP Streamable HTTP Echo Server</h1>
        <p>This server implements the MCP Streamable HTTP transport.</p>

        <h2>How to test this server:</h2>

        <h3>1. Open an SSE stream</h3>
        <pre>curl -N -H "Accept: text/event-stream" http://localhost:3001/mcp</pre>

        <h3>2. Send a request to the echo tool</h3>
        <pre>curl -X POST http://localhost:3001/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "123",
    "method": "tools/call",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello, Streamable HTTP!"
      }
    }
  }'</pre>

        <h3>3. Read a resource</h3>
        <pre>curl -X POST http://localhost:3001/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "124",
    "method": "resources/read",
    "params": {
      "uri": "echo://Hello%20Resources"
    }
  }'</pre>

        <h3>4. Get a prompt template</h3>
        <pre>curl -X POST http://localhost:3001/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "125",
    "method": "prompts/get",
    "params": {
      "name": "echo",
      "arguments": {
        "message": "Hello from prompt template!"
      }
    }
  }'</pre>
      </body>
    </html>
  `);
});

// Single endpoint that handles both GET and POST requests
app.all("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Find existing transport for this session, or create a new one
  let transport: StreamableHttpServerTransport;

  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!;
    console.log(`Using existing transport for session ${sessionId}`);
  } else {
    // Create a new transport
    transport = new StreamableHttpServerTransport();

    // Connect the server to this transport
    await server.connect(transport);

    // Store the transport by its session ID
    transports.set(transport.sessionId, transport);
    console.log(`Created new transport with session ID: ${transport.sessionId}`);

    // Remove the transport when the connection is closed
    transport.onclose = () => {
      console.log(`Closing transport for session: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
    };
  }

  console.log(`Handling ${req.method} request to /mcp`);

  // Handle the request (this handles both GET and POST methods)
  // Pass the already parsed body from express.json() middleware
  await transport.handleRequest(req, res, req.body);
});

// Start the server
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n📡 Streamable HTTP Echo server running at http://localhost:${PORT}`);
  console.log(`\n📝 Visit http://localhost:${PORT} in your browser for usage instructions`);
  console.log(`\n📋 API endpoint is available at http://localhost:${PORT}/mcp`);
  console.log('\n🔍 Testing instructions:');
  console.log('  - Use GET with Accept: text/event-stream to open an SSE stream');
  console.log('  - Use POST with JSON-RPC messages to interact with the server');
  console.log('  - Include Mcp-Session-Id header to maintain sessions across requests');
});