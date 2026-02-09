/**
 * StdioTransport
 * 
 * Implementación de transporte MCP usando stdin/stdout.
 * Este es el transporte estándar para Claude Desktop.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { TransportInterface, TransportFactory } from './TransportInterface.js';

export class StdioTransport implements TransportInterface {
    readonly name = 'stdio';

    private transport: StdioServerTransport | null = null;

    constructor(private readonly server: McpServer) { }

    async start(): Promise<void> {
        this.transport = new StdioServerTransport();
        await this.server.connect(this.transport);

        // Log a stderr (stdout está reservado para el protocolo MCP)
        console.error('Servidor MCP de Jules en ejecución (transporte: stdio)');
    }

    async stop(): Promise<void> {
        // StdioServerTransport no tiene método close explícito
        // El proceso terminará cuando stdin se cierre
        this.transport = null;
    }
}

/**
 * Factory para crear StdioTransport.
 */
export class StdioTransportFactory implements TransportFactory {
    create(server: McpServer): TransportInterface {
        return new StdioTransport(server);
    }
}
