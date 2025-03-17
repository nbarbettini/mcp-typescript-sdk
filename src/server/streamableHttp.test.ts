import { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHttpServerTransport } from "./streamableHttp.js";
import { JSONRPCRequest, JSONRPCResponse } from "../types.js";

describe("StreamableHttpServerTransport", () => {
  let transport: StreamableHttpServerTransport;

  beforeEach(() => {
    transport = new StreamableHttpServerTransport();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("start() initializes the transport", async () => {
    await expect(transport.start()).resolves.toBeUndefined();
  });

  test("close() ends all active streams", async () => {
    const mockResponse = {
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      headersSent: true,
      getHeader: jest.fn().mockReturnValue("text/event-stream"),
      writeHead: jest.fn().mockReturnThis(),
      write: jest.fn(),
    } as unknown as ServerResponse;

    // @ts-expect-error - Using private property for testing
    transport._sseStreams.set("test-session", mockResponse);

    await transport.close();

    expect(mockResponse.end).toHaveBeenCalled();
    // @ts-expect-error - Using private property for testing
    expect(transport._sseStreams.size).toBe(0);
  });

  test("handleRequest processes GET requests for SSE streams", async () => {
    const mockRequest = {
      method: "GET",
      headers: {
        accept: "text/event-stream",
      },
    } as IncomingMessage;

    const mockResponse = {
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      getHeader: jest.fn(),
      writeHead: jest.fn().mockReturnThis(),
      write: jest.fn(),
    } as unknown as ServerResponse;

    await transport.handleRequest(mockRequest, mockResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }));
  });

  test("handleRequest processes POST requests for JSON-RPC messages", async () => {
    const jsonRpcRequest: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: "test-id",
      method: "test.method",
    };

    const mockRequest = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
    } as IncomingMessage;

    const mockResponse = {
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      getHeader: jest.fn(),
      writeHead: jest.fn().mockReturnThis(),
      write: jest.fn(),
    } as unknown as ServerResponse;

    const onMessageSpy = jest.fn();
    transport.onmessage = onMessageSpy;

    await transport.handleRequest(mockRequest, mockResponse, jsonRpcRequest);

    expect(onMessageSpy).toHaveBeenCalledWith(jsonRpcRequest);
  });

  test("send() handles JSON-RPC responses", async () => {
    const jsonRpcResponse: JSONRPCResponse = {
      jsonrpc: "2.0",
      id: "test-id",
      result: { success: true },
    };

    const mockResponse = {
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      headersSent: false,
      getHeader: jest.fn(),
      writeHead: jest.fn().mockReturnThis(),
      write: jest.fn(),
    } as unknown as ServerResponse;

    // @ts-expect-error - Using private property for testing
    transport._sseStreams.set("test-session-test-id", mockResponse);

    await transport.send(jsonRpcResponse);

    expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "application/json",
    }));
    expect(mockResponse.end).toHaveBeenCalledWith(JSON.stringify(jsonRpcResponse));
  });

  test("send() sends events to all open SSE streams for non-responses", async () => {
    const jsonRpcRequest: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: "test-id-2",
      method: "test.method",
    };

    const mockResponse = {
      end: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      headersSent: true,
      getHeader: jest.fn((name) => {
        // This mock better simulates how Node.js handles header retrieval
        // by returning the value regardless of case sensitivity
        if (name.toLowerCase() === 'content-type') {
          return "text/event-stream";
        }
        return null;
      }),
      writeHead: jest.fn().mockReturnThis(),
      write: jest.fn(),
    } as unknown as ServerResponse;

    // @ts-expect-error - Using private property for testing
    transport._sseStreams.set("test-session", mockResponse);

    await transport.send(jsonRpcRequest);

    expect(mockResponse.write).toHaveBeenCalled();
    expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("data: {"));
  });
});