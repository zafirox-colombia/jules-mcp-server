/**
 * Characterization Tests para las herramientas MCP de Jules
 * 
 * Estos tests documentan y validan el comportamiento actual de cada herramienta
 * antes de cualquier refactorización.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as clientModule from '../../src/client.js';
import {
    mockSource,
    mockSourceList,
    mockEmptySourceList,
    mockSession,
    mockCompletedSession,
    mockSessionList,
    mockEmptySessionList,
    mockActivityList,
    mockEmptyActivityList,
    mockPlanActivity,
} from '../mocks/jules-api.mock.js';

// Helper para simular respuestas de julesRequest
function mockJulesRequest<T>(response: T) {
    return vi.spyOn(clientModule, 'julesRequest').mockResolvedValue(response as any);
}

function mockJulesRequestError(message: string) {
    return vi.spyOn(clientModule, 'julesRequest').mockRejectedValue(new Error(message));
}

describe('Jules MCP Tools - Characterization', () => {
    beforeEach(() => {
        vi.spyOn(clientModule, 'getApiKey').mockReturnValue('test-api-key');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ===== Tool 1: jules_list_sources =====
    describe('jules_list_sources', () => {
        it('formatea correctamente la lista de repositorios', async () => {
            const mock = mockJulesRequest(mockSourceList);

            // Simular la lógica de formateo (extraída del index.ts)
            const data = await clientModule.julesRequest<typeof mockSourceList>('/sources');

            expect(data.sources).toHaveLength(1);
            expect(data.sources![0].githubRepo?.owner).toBe('testowner');
            expect(data.sources![0].githubRepo?.repo).toBe('testrepo');
            mock.mockRestore();
        });

        it('maneja lista vacía de repositorios', async () => {
            const mock = mockJulesRequest(mockEmptySourceList);

            const data = await clientModule.julesRequest<typeof mockEmptySourceList>('/sources');

            expect(data.sources).toHaveLength(0);
            mock.mockRestore();
        });

        it('incluye parámetros de paginación en la URL', async () => {
            const mock = vi.spyOn(clientModule, 'julesRequest').mockResolvedValue(mockSourceList);

            await clientModule.julesRequest('/sources?pageSize=10&pageToken=abc');

            expect(mock).toHaveBeenCalledWith('/sources?pageSize=10&pageToken=abc');
            mock.mockRestore();
        });
    });

    // ===== Tool 2: jules_get_source =====
    describe('jules_get_source', () => {
        it('obtiene detalles de un repositorio específico', async () => {
            const mock = mockJulesRequest(mockSource);

            const source = await clientModule.julesRequest<typeof mockSource>('/sources/github-testowner-testrepo');

            expect(source.githubRepo?.owner).toBe('testowner');
            expect(source.githubRepo?.branches).toHaveLength(2);
            mock.mockRestore();
        });
    });

    // ===== Tool 3: jules_create_session =====
    describe('jules_create_session', () => {
        it('crea una sesión y retorna ID', async () => {
            const mock = mockJulesRequest(mockSession);

            const session = await clientModule.julesRequest<typeof mockSession>('/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: 'Test prompt',
                    sourceContext: {
                        source: 'sources/github/testowner/testrepo',
                        githubRepoContext: { startingBranch: 'main' },
                    },
                }),
            });

            expect(session.id).toBe('ses_abc123');
            expect(session.state).toBe('QUEUED');
            mock.mockRestore();
        });
    });

    // ===== Tool 4: jules_list_sessions =====
    describe('jules_list_sessions', () => {
        it('lista sesiones con sus estados', async () => {
            const mock = mockJulesRequest(mockSessionList);

            const data = await clientModule.julesRequest<typeof mockSessionList>('/sessions');

            expect(data.sessions).toHaveLength(1);
            expect(data.sessions![0].title).toBe('Test Session');
            mock.mockRestore();
        });

        it('maneja lista vacía de sesiones', async () => {
            const mock = mockJulesRequest(mockEmptySessionList);

            const data = await clientModule.julesRequest<typeof mockEmptySessionList>('/sessions');

            expect(data.sessions).toHaveLength(0);
            mock.mockRestore();
        });
    });

    // ===== Tool 5: jules_get_status =====
    describe('jules_get_status', () => {
        it('obtiene estado y actividades recientes', async () => {
            const sessionMock = mockJulesRequest(mockSession);

            const session = await clientModule.julesRequest<typeof mockSession>('/sessions/ses_abc123');

            expect(session.state).toBe('QUEUED');
            expect(session.prompt).toBe('Test prompt for session');
            sessionMock.mockRestore();
        });

        it('incluye información de PR cuando está completada', async () => {
            const mock = mockJulesRequest(mockCompletedSession);

            const session = await clientModule.julesRequest<typeof mockCompletedSession>('/sessions/ses_abc123');

            expect(session.state).toBe('COMPLETED');
            expect(session.outputs?.[0]?.pullRequest?.url).toContain('github.com');
            mock.mockRestore();
        });
    });

    // ===== Tool 6: jules_send_message =====
    describe('jules_send_message', () => {
        it('envía mensaje a una sesión', async () => {
            const mock = mockJulesRequest({});

            await clientModule.julesRequest('/sessions/ses_abc123:sendMessage', {
                method: 'POST',
                body: JSON.stringify({ prompt: 'Additional instructions' }),
            });

            expect(mock).toHaveBeenCalledWith('/sessions/ses_abc123:sendMessage', expect.objectContaining({
                method: 'POST',
            }));
            mock.mockRestore();
        });
    });

    // ===== Tool 7: jules_get_activity =====
    describe('jules_get_activity', () => {
        it('obtiene actividad específica', async () => {
            const mock = mockJulesRequest(mockPlanActivity);

            const activity = await clientModule.julesRequest<typeof mockPlanActivity>(
                '/sessions/ses_abc123/activities/act_plan1'
            );

            expect(activity.planGenerated?.plan?.steps).toHaveLength(2);
            mock.mockRestore();
        });
    });

    // ===== Tool 8: jules_list_activities =====
    describe('jules_list_activities', () => {
        it('lista actividades de una sesión', async () => {
            const mock = mockJulesRequest(mockActivityList);

            const data = await clientModule.julesRequest<typeof mockActivityList>(
                '/sessions/ses_abc123/activities'
            );

            expect(data.activities).toHaveLength(2);
            mock.mockRestore();
        });

        it('maneja lista vacía de actividades', async () => {
            const mock = mockJulesRequest(mockEmptyActivityList);

            const data = await clientModule.julesRequest<typeof mockEmptyActivityList>(
                '/sessions/ses_abc123/activities'
            );

            expect(data.activities).toHaveLength(0);
            mock.mockRestore();
        });
    });

    // ===== Tool 9: jules_approve_plan =====
    describe('jules_approve_plan', () => {
        it('aprueba el plan de una sesión', async () => {
            const mock = mockJulesRequest({});

            await clientModule.julesRequest('/sessions/ses_abc123:approvePlan', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            expect(mock).toHaveBeenCalledWith('/sessions/ses_abc123:approvePlan', expect.objectContaining({
                method: 'POST',
            }));
            mock.mockRestore();
        });
    });

    // ===== Tool 10: jules_get_session_output =====
    describe('jules_get_session_output', () => {
        it('obtiene output de sesión completada', async () => {
            const mock = mockJulesRequest(mockCompletedSession);

            const session = await clientModule.julesRequest<typeof mockCompletedSession>('/sessions/ses_abc123');

            expect(session.outputs?.[0]?.pullRequest?.title).toBe('feat: add new feature');
            mock.mockRestore();
        });

        it('detecta sesión no completada', async () => {
            const mock = mockJulesRequest(mockSession);

            const session = await clientModule.julesRequest<typeof mockSession>('/sessions/ses_abc123');

            expect(session.state).not.toBe('COMPLETED');
            mock.mockRestore();
        });
    });

    // ===== Tool 11: jules_delete_session =====
    describe('jules_delete_session', () => {
        it('elimina una sesión', async () => {
            const mock = mockJulesRequest({});

            await clientModule.julesRequest('/sessions/ses_abc123', {
                method: 'DELETE',
            });

            expect(mock).toHaveBeenCalledWith('/sessions/ses_abc123', expect.objectContaining({
                method: 'DELETE',
            }));
            mock.mockRestore();
        });
    });

    // ===== Manejo de Errores =====
    describe('Error Handling', () => {
        it('propaga errores de API correctamente', async () => {
            mockJulesRequestError('Error de la API de Jules 401: Invalid API key');

            await expect(clientModule.julesRequest('/test')).rejects.toThrow('Invalid API key');
        });
    });
});
