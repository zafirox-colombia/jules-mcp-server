/**
 * Mocks para la API de Jules
 * Usado en characterization tests para simular respuestas de la API
 */

import { Activity, Session, SessionState, Source } from "../../src/types";


// ===== Mock Sources =====
export const mockSource: Source = {
    name: 'sources/github/testowner/testrepo',
    id: 'github-testowner-testrepo',
    githubRepo: {
        owner: 'testowner',
        repo: 'testrepo',
        isPrivate: false,
        defaultBranch: { displayName: 'main' },
        branches: [
            { displayName: 'main' },
            { displayName: 'develop' },
        ],
    },
};

export const mockSourceList = {
    sources: [mockSource],
    nextPageToken: undefined,
};

export const mockEmptySourceList = {
    sources: [],
    nextPageToken: undefined,
};

// ===== Mock Sessions =====
export const mockSession: Session = {
    id: 'ses_abc123',
    name: 'sessions/ses_abc123',
    title: 'Test Session',
    prompt: 'Test prompt for session',
    state: 'QUEUED' as SessionState,
    url: 'https://jules.google.com/sessions/ses_abc123',
    createTime: '2024-12-15T00:00:00Z',
    updateTime: '2024-12-15T00:01:00Z',
};

export const mockCompletedSession: Session = {
    ...mockSession,
    state: 'COMPLETED' as SessionState,
    outputs: [
        {
            pullRequest: {
                url: 'https://github.com/testowner/testrepo/pull/1',
                title: 'feat: add new feature',
                description: 'This PR adds a new feature',
                number: 1,
            },
        },
    ],
};

export const mockSessionList = {
    sessions: [mockSession],
    nextPageToken: undefined,
};

export const mockEmptySessionList = {
    sessions: [],
    nextPageToken: undefined,
};

// ===== Mock Activities =====
export const mockPlanActivity: Activity = {
    name: 'sessions/ses_abc123/activities/act_plan1',
    id: 'act_plan1',
    timestamp: '2024-12-15T00:00:30Z',
    createTime: '2024-12-15T00:00:30Z',
    originator: 'agent',
    planGenerated: {
        plan: {
            description: 'Plan to implement feature',
            steps: [
                { step: 'Step 1', description: 'First step' },
                { step: 'Step 2', description: 'Second step' },
            ],
        },
    },
};

export const mockProgressActivity: Activity = {
    name: 'sessions/ses_abc123/activities/act_progress1',
    id: 'act_progress1',
    timestamp: '2024-12-15T00:01:00Z',
    createTime: '2024-12-15T00:01:00Z',
    originator: 'agent',
    progressUpdated: {
        title: 'Working on implementation',
        description: 'Currently implementing step 1',
    },
};

export const mockActivityList = {
    activities: [mockProgressActivity, mockPlanActivity],
    nextPageToken: undefined,
};

export const mockEmptyActivityList = {
    activities: [],
    nextPageToken: undefined,
};

export const mockAgentMessagedActivity: Activity = {
    name: 'sessions/ses_abc123/activities/act_agent_msg1',
    id: 'act_agent_msg1',
    createTime: '2024-12-15T00:02:00Z',
    originator: 'agent',
    agentMessaged: {
        agentMessage: 'He completado la implementación. ¿Deseas que agregue tests?',
    },
};

export const mockUserMessagedActivity: Activity = {
    name: 'sessions/ses_abc123/activities/act_user_msg1',
    id: 'act_user_msg1',
    createTime: '2024-12-15T00:03:00Z',
    originator: 'user',
    userMessaged: {
        userMessage: 'Sí, agrega tests de integración.',
    },
};

export const mockSessionCompletedActivity: Activity = {
    name: 'sessions/ses_abc123/activities/act_completed1',
    id: 'act_completed1',
    createTime: '2024-12-15T00:10:00Z',
    originator: 'system',
    sessionCompleted: {},
};

export const mockSessionFailedActivity: Activity = {
    name: 'sessions/ses_abc123/activities/act_failed1',
    id: 'act_failed1',
    createTime: '2024-12-15T00:10:00Z',
    originator: 'system',
    sessionFailed: {
        reason: 'No se pudieron instalar las dependencias',
    },
};

export const mockActivityWithArtifacts: Activity = {
    name: 'sessions/ses_abc123/activities/act_artifact1',
    id: 'act_artifact1',
    createTime: '2024-12-15T00:05:00Z',
    originator: 'agent',
    progressUpdated: {
        title: 'Aplicando cambios',
        description: 'Se aplicaron cambios al código fuente',
    },
    artifacts: [
        {
            changeSet: {
                source: 'sources/github/testowner/testrepo',
                gitPatch: {
                    baseCommitId: 'a1b2c3d4e5f6',
                    unidiffPatch: 'diff --git a/src/auth.js b/src/auth.js\n--- a/src/auth.js\n+++ b/src/auth.js\n@@ -1,3 +1,5 @@\n+import { hash } from "crypto";\n',
                    suggestedCommitMessage: 'feat: agregar autenticación',
                },
            },
        },
        {
            bashOutput: {
                command: 'npm test',
                output: 'All tests passed (42 passing)',
                exitCode: 0,
            },
        },
    ],
};

// ===== Mock API Errors =====
export const mockApiError = {
    error: {
        code: 401,
        message: 'Invalid API key',
        status: 'UNAUTHENTICATED',
    },
};

export const mockNotFoundError = {
    error: {
        code: 404,
        message: 'Session not found',
        status: 'NOT_FOUND',
    },
};

// ===== Mock Fetch Helper =====
export function createMockFetch(responses: Map<string, { status: number; body: unknown }>) {
    return async (url: string | URL, options?: RequestInit): Promise<Response> => {
        const urlStr = url.toString();

        for (const [pattern, response] of responses) {
            if (urlStr.includes(pattern)) {
                return new Response(JSON.stringify(response.body), {
                    status: response.status,
                    headers: { 'content-type': 'application/json' },
                });
            }
        }

        // Default: 404
        return new Response(JSON.stringify(mockNotFoundError), {
            status: 404,
            headers: { 'content-type': 'application/json' },
        });
    };
}
