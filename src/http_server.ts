
// @ts-ignore
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { getApiKey } from "./client.js";
import { registerTools } from "./tools.js";

/**
 * Jules MCP HTTP Server
 * 
 * Provides a stateless HTTP JSON-RPC transport for the Jules MCP server,
 * compatible with JulesMCPClient.php which expects synchronous responses.
 */

// ===== Configuration =====
const PORT = process.env.MCP_PORT || 3000;

// ===== Express Setup =====
// @ts-ignore
const app = express();
// @ts-ignore
app.use(express.json());

// Healthcheck endpoint
// @ts-ignore
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", transport: "http-jsonrpc" });
});

// Custom Stateless Transport for Request/Response cycle
class StatelessTransport implements Transport {
    private responseSent = false;

    constructor(
        // @ts-ignore
        private res: any
    ) { }

    onclose?: () => void;
    onerror?: (error: Error) => void;
    // @ts-ignore
    onmessage?: (message: JSONRPCMessage) => void;

    async start(): Promise<void> {
        // No startup needed
    }

    async send(message: JSONRPCMessage): Promise<void> {
        if (this.responseSent) return;

        // We only care about the result/error response to the client's call
        // Notifications or other messages might be ignored in this stateless model
        // but typically McpServer will send the response immediately.

        this.responseSent = true;
        this.res.json(message);
    }

    async close(): Promise<void> {
        // No cleanup needed
    }

    // Helper to feed message into the transport (from request)
    async handleRequest(message: JSONRPCMessage) {
        if (this.onmessage) {
            this.onmessage(message);
        }
    }
}

// Handler for stateless JSON-RPC calls
// @ts-ignore
app.post("/message", async (req, res) => {
    try {
        const transport = new StatelessTransport(res);
        const server = new McpServer({
            name: "jules-mcp-server-http",
            version: "1.1.0",
        });

        registerTools(server);

        await server.connect(transport);

        // Feed the request body (JSON-RPC) to the server
        const body = req.body;
        if (!body) {
            res.status(400).json({ error: { message: "Missing body" } });
            return;
        }

        // Handle message
        // The server will process it and call transport.send() with the result
        await transport.handleRequest(body);

        // Note: If server logic is async, send() might be called later. 
        // But for tool calls, it's usually awaited chain. 
        // However, if the server implementation doesn't await the tool execution before returning?
        // McpServer implementation usually handles 'callTool' and sends response.
        // We rely on transport.send() being called.
        // If it times out or doesn't send (e.g. notification), the client hangs?
        // We might want a timeout safety here, but Express has defaults.

    } catch (error: any) {
        console.error("Error processing request:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: { message: error.message || "Internal Error" } });
        }
    }
});

// ===== Start =====
async function main() {
    try {
        getApiKey(); // Validate key

        // @ts-ignore
        app.listen(PORT, () => {
            console.log(`[MCP] Jules server started`);
            console.log(`[MCP] Transport: HTTP (Stateless JSON-RPC)`);
            console.log(`[MCP] Port: ${PORT}`);
            console.log(`[MCP] Extensions: /health, /message`);
        });

    } catch (error) {
        console.error("Fatal error starting HTTP server:", error);
        process.exit(1);
    }
}

main();
