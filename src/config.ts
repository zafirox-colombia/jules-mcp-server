/**
 * Configuración global de la aplicación
 * 
 * Incluye feature flags para control de comportamiento.
 */

export type TransportType = 'stdio' | 'http';

export interface AppConfig {
    /**
     * Tipo de transporte a usar.
     * - 'stdio': Transporte local via stdin/stdout (Claude Desktop)
     * - 'http': Transporte HTTP/SSE (Cloudflare Workers)
     */
    transport: TransportType;

    /**
     * URL base de la API de Jules.
     */
    julesApiBase: string;
}

/**
 * Configuración por defecto cargada desde variables de entorno.
 */
export function loadConfig(): AppConfig {
    return {
        transport: (process.env.MCP_TRANSPORT as TransportType) ?? 'stdio',
        julesApiBase: process.env.JULES_API_BASE ?? 'https://jules.googleapis.com/v1alpha',
    };
}

/**
 * Singleton de configuración.
 */
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
    if (!_config) {
        _config = loadConfig();
    }
    return _config;
}

/**
 * Resetea la configuración (útil para tests).
 */
export function resetConfig(): void {
    _config = null;
}

/**
 * Establece configuración personalizada (útil para tests).
 */
export function setConfig(config: Partial<AppConfig>): void {
    _config = { ...loadConfig(), ...config };
}
