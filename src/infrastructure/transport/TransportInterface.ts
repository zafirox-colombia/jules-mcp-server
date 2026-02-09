/**
 * Interface: TransportInterface
 * 
 * Abstracción para diferentes mecanismos de transporte MCP.
 * Permite intercambiar stdio (local) y HTTP (remoto) sin modificar
 * la lógica de las herramientas.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Interfaz base para transportes MCP.
 */
export interface TransportInterface {
    /**
     * Nombre identificador del transporte.
     */
    readonly name: string;

    /**
     * Inicia el transporte y conecta al servidor MCP.
     */
    start(): Promise<void>;

    /**
     * Detiene el transporte y limpia recursos.
     */
    stop(): Promise<void>;
}

/**
 * Factory para crear transportes.
 */
export interface TransportFactory {
    /**
     * Crea una instancia del transporte.
     * @param server - Servidor MCP a conectar
     */
    create(server: McpServer): TransportInterface;
}
