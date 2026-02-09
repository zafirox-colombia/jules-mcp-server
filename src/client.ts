/**
 * Cliente de la API de Jules
 * Maneja autenticación, manejo de errores y procesamiento de solicitudes/respuestas
 */

import type { JulesApiError } from "./types.js";

// Configuración de la API de Jules
export const JULES_API_BASE = "https://jules.googleapis.com/v1alpha";

/**
 * Obtiene la API key de Jules desde las variables de entorno
 * @throws {Error} si JULES_API_KEY no está configurada
 */
export function getApiKey(): string {
  const apiKey = process.env.JULES_API_KEY;
  if (!apiKey) {
    throw new Error(
      "La variable de entorno JULES_API_KEY es requerida. " +
      "Obtén tu API key desde https://jules.google.com/settings#api"
    );
  }
  return apiKey;
}

/**
 * Realiza una solicitud a la API de Jules
 * @param endpoint - Ruta del endpoint de la API (ej: "/sources", "/sessions")
 * @param options - Opciones de fetch (método, body, etc.)
 * @returns Respuesta JSON parseada
 * @throws {Error} en errores de API con mensajes descriptivos
 */
export async function julesRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const url = `${JULES_API_BASE}${endpoint}`;

  // DEBUG: Imprimir URL en logs
  console.error(`[JulesRequest] ${options.method || "GET"} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // Manejar respuestas no exitosas
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorMessage = `Error de la API de Jules ${response.status}: ${response.statusText}`;

      // Intentar parsear el cuerpo del error si es JSON
      if (contentType?.includes("application/json")) {
        try {
          const errorData = (await response.json()) as JulesApiError;
          if (errorData.error?.message) {
            errorMessage = `Error de la API de Jules ${response.status}: ${errorData.error.message}`;
          }
        } catch {
          // Si el parseo JSON falla, usar el mensaje de error original
        }
      } else {
        // Para errores no JSON, intentar obtener el texto del cuerpo
        const errorText = await response.text();
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      throw new Error(errorMessage);
    }

    // Parsear respuesta exitosa
    // Para respuestas vacías (como DELETE), devolver objeto vacío
    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    // Re-lanzar con contexto adicional si es un error de red
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Error de red al conectar con la API de Jules: ${error.message}`
      );
    }
    // Re-lanzar otros errores tal cual
    throw error;
  }
}

/**
 * Formatea el error para la respuesta de la herramienta MCP
 * Extrae un mensaje amigable sin exponer detalles sensibles
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocurrió un error desconocido";
}
