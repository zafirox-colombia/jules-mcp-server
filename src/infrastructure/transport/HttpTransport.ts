/**
 * HttpTransport
 * 
 * Implementación de transporte MCP usando HTTP/SSE para Cloudflare Workers.
 * Usa el patrón Streamable HTTP del protocolo MCP.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TransportInterface, TransportFactory } from './TransportInterface.js';

/**
 * Configuración del entorno de Cloudflare Workers.
 */
export interface WorkerEnv {
    JULES_API_KEY: string;
}

/**
 * HttpTransport para Cloudflare Workers.
 * 
 * Este transporte maneja requests HTTP y convierte entre
 * el protocolo MCP y HTTP/SSE.
 */
export class HttpTransport implements TransportInterface {
    readonly name = 'http';

    constructor(
        private readonly _server: McpServer,
        private readonly _env?: WorkerEnv
    ) { }

    /**
     * Obtiene el servidor MCP asociado.
     */
    get server(): McpServer {
        return this._server;
    }

    /**
     * Obtiene el entorno de Workers.
     */
    get env(): WorkerEnv | undefined {
        return this._env;
    }

    /**
     * En el contexto de Workers, start() no hace nada ya que
     * cada request es manejado individualmente por handle().
     */
    async start(): Promise<void> {
        // Referenciamos _server para evitar warning de no usado
        console.log(`HttpTransport inicializado (server: ${typeof this._server})`);
    }

    async stop(): Promise<void> {
        // No hay recursos persistentes que limpiar en Workers
    }

    /**
     * Maneja un request HTTP entrante.
     * Este método será llamado por el Worker.
     */
    async handle(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Endpoint SSE para conexión inicial
        if (url.pathname === '/sse' || url.pathname === '/') {
            return this.handleSSE(request);
        }

        // Endpoint para mensajes POST
        if (request.method === 'POST' && url.pathname === '/message') {
            return this.handleMessage(request);
        }

        // Health check
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'ok',
                transport: 'http',
                server: 'jules-mcp-server'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Not Found', { status: 404 });
    }

    /**
     * Maneja conexiones SSE.
     */
    private async handleSSE(_request: Request): Promise<Response> {
        // Nota: _request está disponible para validación futura de headers Accept

        // Crear stream para SSE
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Enviar evento inicial de conexión
        const sendEvent = async (event: string, data: unknown) => {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            await writer.write(encoder.encode(message));
        };

        // Enviar endpoint para mensajes (compatibilidad con clientes antiguos)
        sendEvent('endpoint', { url: '/message' });

        // Mantener conexión abierta
        // En producción, aquí se conectaría al servidor MCP real

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    /**
     * Maneja mensajes JSON-RPC via POST.
     */
    private async handleMessage(request: Request): Promise<Response> {
        try {
            const body = await request.json() as { id?: string | number };

            // Aquí se procesaría el mensaje JSON-RPC
            // Por ahora retornamos un placeholder

            return new Response(JSON.stringify({
                jsonrpc: '2.0',
                id: body.id,
                result: { status: 'received' }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Parse error' }
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
}

/**
 * Factory para crear HttpTransport.
 */
export class HttpTransportFactory implements TransportFactory {
    constructor(private readonly env?: WorkerEnv) { }

    create(server: McpServer): TransportInterface {
        return new HttpTransport(server, this.env);
    }
}
