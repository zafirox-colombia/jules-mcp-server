#!/usr/bin/env node
// NOTE: El shebang se mantiene para compatibilidad con Unix, pero el servidor debe ejecutarse con `node build/index.js` en Windows.

/**
 * Servidor MCP de Jules
 * Servidor del Protocolo de Contexto de Modelo para el agente de codificación Jules AI de Google
 *
 * Expone la funcionalidad de la API de Jules a través de herramientas MCP estandarizadas
 * que asistentes de IA como Claude pueden descubrir e invocar.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getApiKey } from "./client.js";
import { registerTools } from "./tools.js";

// ===== Configuración del Servidor =====
const server = new McpServer({
  name: "jules-mcp-server",
  version: "1.1.0",
});

// ===== Registrar Herramientas =====
registerTools(server);

// ===== Iniciar Servidor (Stdio) =====
async function main() {
  try {
    // Validar API key al inicio
    getApiKey();

    // Conectar transporte stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log a stderr (stdout está reservado para el protocolo MCP)
    console.error("Servidor MCP de Jules en ejecución (Stdio Mode)");
    console.error("Todas las herramientas han sido registradas exitosamente.");
  } catch (error) {
    console.error("Error fatal al iniciar el servidor MCP de Jules:", error);
    process.exit(1);
  }
}

main();
