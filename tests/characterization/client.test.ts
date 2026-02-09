/**
 * Characterization Tests para el cliente de la API de Jules
 * 
 * Estos tests documentan y validan el comportamiento actual del cliente HTTP
 * antes de cualquier refactorización.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { julesRequest, getApiKey, formatErrorForUser, JULES_API_BASE } from '../../src/client.js';
import { createMockFetch, mockSource, mockApiError } from '../mocks/jules-api.mock.js';

describe('JulesClient', () => {
    const originalEnv = process.env;
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        process.env = { ...originalEnv, JULES_API_KEY: 'test-api-key' };
    });

    afterEach(() => {
        process.env = originalEnv;
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe('getApiKey', () => {
        it('retorna la API key cuando está configurada', () => {
            process.env.JULES_API_KEY = 'my-test-key';
            expect(getApiKey()).toBe('my-test-key');
        });

        it('lanza error cuando JULES_API_KEY no está configurada', () => {
            delete process.env.JULES_API_KEY;
            expect(() => getApiKey()).toThrow('La variable de entorno JULES_API_KEY es requerida');
        });
    });

    describe('julesRequest', () => {
        it('construye la URL correctamente con el endpoint', async () => {
            let capturedUrl = '';
            globalThis.fetch = async (url) => {
                capturedUrl = url.toString();
                return new Response(JSON.stringify(mockSource), { status: 200 });
            };

            await julesRequest('/sources/test');
            expect(capturedUrl).toBe(`${JULES_API_BASE}/sources/test`);
        });

        it('incluye el header X-Goog-Api-Key con la API key', async () => {
            let capturedHeaders: Headers | undefined;
            globalThis.fetch = async (url, options) => {
                capturedHeaders = new Headers(options?.headers);
                return new Response(JSON.stringify({}), { status: 200 });
            };

            await julesRequest('/test');
            expect(capturedHeaders?.get('X-Goog-Api-Key')).toBe('test-api-key');
        });

        it('incluye Content-Type application/json', async () => {
            let capturedHeaders: Headers | undefined;
            globalThis.fetch = async (url, options) => {
                capturedHeaders = new Headers(options?.headers);
                return new Response(JSON.stringify({}), { status: 200 });
            };

            await julesRequest('/test');
            expect(capturedHeaders?.get('Content-Type')).toBe('application/json');
        });

        it('parsea respuestas JSON exitosas', async () => {
            globalThis.fetch = async () => {
                return new Response(JSON.stringify({ data: 'test' }), { status: 200 });
            };

            const result = await julesRequest<{ data: string }>('/test');
            expect(result).toEqual({ data: 'test' });
        });

        it('retorna objeto vacío para respuestas sin body (DELETE)', async () => {
            globalThis.fetch = async () => {
                // Usamos status 200 con body vacío (Node.js Response no soporta 204 directamente)
                return new Response('', { status: 200 });
            };

            const result = await julesRequest('/test');
            expect(result).toEqual({});
        });

        it('lanza error con mensaje descriptivo para errores 4xx', async () => {
            globalThis.fetch = async () => {
                return new Response(JSON.stringify(mockApiError), {
                    status: 401,
                    headers: { 'content-type': 'application/json' },
                });
            };

            await expect(julesRequest('/test')).rejects.toThrow('Error de la API de Jules 401: Invalid API key');
        });

        it('maneja errores no-JSON graciosamente', async () => {
            globalThis.fetch = async () => {
                return new Response('Service Unavailable', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'content-type': 'text/plain' },
                });
            };

            await expect(julesRequest('/test')).rejects.toThrow('Service Unavailable');
        });
    });

    describe('formatErrorForUser', () => {
        it('extrae mensaje de Error objects', () => {
            const error = new Error('Test error message');
            expect(formatErrorForUser(error)).toBe('Test error message');
        });

        it('retorna mensaje genérico para errores no-Error', () => {
            expect(formatErrorForUser('string error')).toBe('Ocurrió un error desconocido');
            expect(formatErrorForUser(null)).toBe('Ocurrió un error desconocido');
            expect(formatErrorForUser(undefined)).toBe('Ocurrió un error desconocido');
        });
    });
});
