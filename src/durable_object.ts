
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { julesRequest, formatErrorForUser } from './client.js';
import type {
    SourceList,
    SessionList,
    Session,
    ActivityList,
    CreateSessionRequest,
    Activity,
    Source,
} from './types.js';

export interface Env {
    JULES_API_KEY: string;
    JULES_DO: DurableObjectNamespace;
}

function translateState(state: string): string {
    const t: Record<string, string> = {
        STATE_UNSPECIFIED: 'No especificado', QUEUED: 'En cola', PLANNING: 'Planificando',
        AWAITING_PLAN_APPROVAL: 'Esperando aprobación', AWAITING_USER_FEEDBACK: 'Esperando respuesta',
        IN_PROGRESS: 'En progreso', PAUSED: 'Pausada', COMPLETED: 'Completada', FAILED: 'Fallida', CANCELLED: 'Cancelada',
    };
    return t[state] || state;
}

function cleanSessionId(id: string): string {
    return id?.startsWith('sessions/') ? id.split('/')[1] : id?.trim() || '';
}

function createServer(env: Env): { server: McpServer, toolHandlers: Map<string, (args: any) => Promise<any>> } {
    // Configurar API Key globalmente para el cliente
    (globalThis as any).process = (globalThis as any).process || { env: {} };
    ((globalThis as any).process.env).JULES_API_KEY = env.JULES_API_KEY;

    const server = new McpServer({ name: 'jules-mcp-server', version: '1.1.0' });
    const toolHandlers = new Map<string, (args: any) => Promise<any>>();

    const register = (name: string, schema: any, handler: (args: any) => Promise<any>) => {
        server.tool(name, schema, handler);
        toolHandlers.set(name, handler);
    };

    register('jules_list_sources', { pageSize: z.number().optional(), pageToken: z.string().optional(), filter: z.string().optional() },
        async ({ pageSize, pageToken, filter }) => {
            try {
                const params = new URLSearchParams();
                if (pageSize) params.append('pageSize', pageSize.toString());
                if (pageToken) params.append('pageToken', pageToken);
                if (filter) params.append('filter', filter);
                const data = await julesRequest<SourceList>(`/sources${params.toString() ? `?${params}` : ''}`);
                if (!data.sources?.length) return { content: [{ type: 'text', text: 'No hay repositorios.' }] };
                const list = data.sources.map(s => `- ${s.githubRepo?.owner}/${s.githubRepo?.repo}`).join('\n');
                return { content: [{ type: 'text', text: `Repositorios (${data.sources.length}):\n${list}` }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_get_source', { sourceId: z.string() },
        async ({ sourceId }) => {
            try {
                const endpoint = sourceId.startsWith('sources/') ? `/${sourceId}` : `/sources/${sourceId}`;
                const s = await julesRequest<Source>(endpoint);
                return { content: [{ type: 'text', text: `Fuente: ${s.name}\nID: ${s.id}` }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_create_session', { repoOwner: z.string(), repoName: z.string(), prompt: z.string(), branch: z.string().default('main'), automationMode: z.enum(['AUTOMATION_MODE_UNSPECIFIED', 'AUTO_CREATE_PR']).optional(), title: z.string().optional() },
        async ({ repoOwner, repoName, prompt, branch, automationMode, title }) => {
            try {
                const body: CreateSessionRequest = { prompt: 'IMPORTANTE: Responder en ESPAÑOL. ' + prompt, sourceContext: { source: `sources/github/${repoOwner}/${repoName}`, githubRepoContext: { startingBranch: branch } }, title: title || `${repoName}: ${prompt.substring(0, 50)}` };
                body.automationMode = automationMode || 'AUTO_CREATE_PR';
                const session = await julesRequest<Session>('/sessions', { method: 'POST', body: JSON.stringify(body) });
                return { content: [{ type: 'text', text: `Sesión: ${session.id}\nEstado: ${translateState(session.state)}` }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_list_sessions', { pageSize: z.number().default(10), pageToken: z.string().optional() },
        async ({ pageSize, pageToken }) => {
            try {
                const size = pageSize || 10;
                const params = new URLSearchParams(); params.append('pageSize', size.toString()); if (pageToken) params.append('pageToken', pageToken);
                const data = await julesRequest<SessionList>(`/sessions?${params}`);
                if (!data.sessions?.length) return { content: [{ type: 'text', text: 'No hay sesiones.' }] };
                const list = data.sessions.map((s, i) => `${i + 1}. ${s.title || 'Sin título'} (${translateState(s.state)})`).join('\n');
                return { content: [{ type: 'text', text: `Sesiones (${data.sessions.length}):\n${list}` }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_get_status', { sessionId: z.string(), includeActivities: z.number().default(3) },
        async ({ sessionId }) => {
            try {
                const session = await julesRequest<Session>(`/sessions/${cleanSessionId(sessionId)}`);
                let text = `Sesión: ${session.title}\nEstado: ${translateState(session.state)}`;
                const prOut = session.outputs?.find((o: any) => o?.pullRequest); if (prOut?.pullRequest) text += `\nPR: ${prOut.pullRequest.url}`;
                return { content: [{ type: 'text', text }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_send_message', { sessionId: z.string(), message: z.string() },
        async ({ sessionId, message }) => {
            try {
                await julesRequest(`/sessions/${cleanSessionId(sessionId)}:sendMessage`, { method: 'POST', body: JSON.stringify({ prompt: message }) });
                return { content: [{ type: 'text', text: 'Mensaje enviado.' }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_get_activity', { sessionId: z.string(), activityId: z.string() },
        async ({ sessionId, activityId }) => {
            try {
                const a = await julesRequest<Activity>(`/sessions/${cleanSessionId(sessionId)}/activities/${activityId}`);
                return { content: [{ type: 'text', text: `Actividad: ${a.originator} @ ${a.createTime}` }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_list_activities', { sessionId: z.string(), limit: z.number().default(10), pageToken: z.string().optional() },
        async ({ sessionId, limit, pageToken }) => {
            try {
                const params = new URLSearchParams(); params.append('pageSize', limit.toString()); if (pageToken) params.append('pageToken', pageToken);
                const data = await julesRequest<ActivityList>(`/sessions/${cleanSessionId(sessionId)}/activities?${params}`);
                if (!data.activities?.length) return { content: [{ type: 'text', text: 'No hay actividades.' }] };
                const list = data.activities.map((a, i) => `${i + 1}. [${a.originator}] ${a.createTime}`).join('\n');
                return { content: [{ type: 'text', text: `Actividades (${data.activities.length}):\n${list}` }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_approve_plan', { sessionId: z.string() },
        async ({ sessionId }) => {
            try {
                await julesRequest(`/sessions/${cleanSessionId(sessionId)}:approvePlan`, { method: 'POST', body: '{}' });
                return { content: [{ type: 'text', text: 'Plan aprobado.' }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    register('jules_get_session_output', { sessionId: z.string() },
        async ({ sessionId }) => {
            try {
                const session = await julesRequest<Session>(`/sessions/${cleanSessionId(sessionId)}`);
                if (session.state !== 'COMPLETED') return { content: [{ type: 'text', text: `Estado: ${translateState(session.state)}` }] };
                const prD = session.outputs?.find((o: any) => o?.pullRequest); const pr = prD?.pullRequest;
                return { content: [{ type: 'text', text: pr ? `PR: ${pr.url}\n${pr.title}` : 'Sesión completada sin PR.' }] };
            } catch (e) { return { content: [{ type: 'text', text: `Error: ${formatErrorForUser(e)}` }], isError: true }; }
        });

    // Tool 12: ChatGPT Search (Deep Research)
    register('search', { query: z.string() },
        async ({ query }) => {
            try {
                // Mapear búsqueda a listado de fuentes
                const params = new URLSearchParams();
                if (query) params.append('filter', query); // Intentar filtrar por query si la API lo soporta, o traer todo

                const data = await julesRequest<SourceList>(`/sources${params.toString() ? `?${params}` : ''}`);
                const sources = data.sources || [];

                // Filtrado manual simple si la API no filtra estricto (opcional, por ahora confiamos en la API o devolvemos todo)
                // Formatear resultados según spec de ChatGPT
                const results = sources.map(s => ({
                    id: s.id,
                    title: s.name || s.id,
                    url: `https://github.com/${s.githubRepo?.owner}/${s.githubRepo?.repo}` // Construir URL si es GitHub
                }));

                // La respuesta debe ser un solo item de texto con un JSON stringified dentro
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ results })
                    }]
                };
            } catch (e) {
                // En caso de error, devolver lista vacía o error formateado
                return { content: [{ type: 'text', text: JSON.stringify({ results: [] }) }], isError: true };
            }
        });

    // Tool 13: ChatGPT Fetch (Deep Research)
    register('fetch', { id: z.string() },
        async ({ id }) => {
            try {
                const endpoint = id.startsWith('sources/') ? `/${id}` : `/sources/${id}`;
                const s = await julesRequest<Source>(endpoint);

                // Construir documento completo
                const document = {
                    id: s.id,
                    title: s.name || s.id,
                    text: `Source ID: ${s.id}\nName: ${s.name}\nGitHub: ${s.githubRepo?.owner}/${s.githubRepo?.repo}`,
                    url: `https://github.com/${s.githubRepo?.owner}/${s.githubRepo?.repo}`,
                    metadata: {
                        sourceType: 'github',
                        owner: s.githubRepo?.owner,
                        repo: s.githubRepo?.repo
                    }
                };

                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify(document)
                    }]
                };
            } catch (e) {
                return { content: [{ type: 'text', text: `Error fetching document: ${formatErrorForUser(e)}` }], isError: true };
            }
        });

    return { server, toolHandlers };
}

function getToolsList() {
    return [
        { name: 'jules_list_sources', description: 'Lista repositorios conectados', inputSchema: { type: 'object', properties: { pageSize: { type: 'number' }, pageToken: { type: 'string' }, filter: { type: 'string' } } } },
        { name: 'jules_get_source', description: 'Obtiene detalles de repositorio', inputSchema: { type: 'object', properties: { sourceId: { type: 'string' } }, required: ['sourceId'] } },
        { name: 'jules_create_session', description: 'Inicia tarea de codificación', inputSchema: { type: 'object', properties: { repoOwner: { type: 'string' }, repoName: { type: 'string' }, prompt: { type: 'string' }, branch: { type: 'string' }, automationMode: { type: 'string' }, title: { type: 'string' } }, required: ['repoOwner', 'repoName', 'prompt'] } },
        { name: 'jules_list_sessions', description: 'Lista sesiones', inputSchema: { type: 'object', properties: { pageSize: { type: 'number' }, pageToken: { type: 'string' } } }, required: [] },
        { name: 'jules_get_status', description: 'Obtiene estado de sesión', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, includeActivities: { type: 'number' } }, required: ['sessionId'] } },
        { name: 'jules_send_message', description: 'Envía mensaje a sesión', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, message: { type: 'string' } }, required: ['sessionId', 'message'] } },
        { name: 'jules_get_activity', description: 'Obtiene actividad específica', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, activityId: { type: 'string' } }, required: ['sessionId', 'activityId'] } },
        { name: 'jules_list_activities', description: 'Lista actividades de sesión', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, limit: { type: 'number' }, pageToken: { type: 'string' } }, required: ['sessionId'] } },
        { name: 'jules_approve_plan', description: 'Aprueba plan de ejecución', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
        { name: 'jules_get_session_output', description: 'Obtiene salida de sesión', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
        { name: 'jules_delete_session', description: 'Elimina sesión', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } },
        { name: 'search', description: 'Search for sources/repositories (ChatGPT compliant)', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
        { name: 'fetch', description: 'Fetch source details by ID (ChatGPT compliant)', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
    ];
}

export class JulesDurableObject implements DurableObject {
    state: DurableObjectState;
    env: Env;

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, mcp-protocol-version' };

        if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

        if (url.pathname === '/health') {
            return Response.json({ status: 'ok', server: 'jules-mcp-server', version: '1.1.0', tools: 11, type: 'DurableObject' }, { headers: cors });
        }

        // SSE endpoint
        if (url.pathname === '/sse') {
            const sessionId = crypto.randomUUID();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = new TextEncoder();

            const baseUrl = new URL(request.url);
            const messageUrl = `${baseUrl.origin}/message?sessionId=${sessionId}`;

            (async () => {
                await writer.write(encoder.encode(`event: endpoint\ndata: ${messageUrl}\n\n`));
                const keepAlive = setInterval(async () => { try { await writer.write(encoder.encode(': keep-alive\n\n')); } catch { clearInterval(keepAlive); } }, 15000);
            })();

            return new Response(readable, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
        }

        // Message & MCP endpoint (JSON-RPC)
        if (request.method === 'POST' && (url.pathname === '/message' || url.pathname === '/mcp')) {
            try {
                const body = await request.json() as { jsonrpc?: string; method?: string; id?: string | number; params?: Record<string, unknown> };

                if (body.method === 'initialize') {
                    return Response.json({
                        jsonrpc: '2.0',
                        id: body.id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: {
                                tools: { listChanged: true },
                                resources: { listChanged: true, subscribe: false },
                                prompts: { listChanged: true },
                                logging: {}
                            },
                            serverInfo: {
                                name: 'jules-mcp-server',
                                version: '1.1.0'
                            }
                        }
                    }, { headers: cors });
                }

                if (body.method === 'notifications/initialized') return new Response(null, { status: 204, headers: cors });
                if (body.method === 'ping') return Response.json({ jsonrpc: '2.0', id: body.id, result: {} }, { headers: cors });
                if (body.method === 'logging/setLevel') return Response.json({ jsonrpc: '2.0', id: body.id, result: {} }, { headers: cors });
                if (body.method === 'resources/list') return Response.json({ jsonrpc: '2.0', id: body.id, result: { resources: [] } }, { headers: cors });
                if (body.method === 'resources/templates/list') return Response.json({ jsonrpc: '2.0', id: body.id, result: { resourceTemplates: [] } }, { headers: cors });
                if (body.method === 'prompts/list') return Response.json({ jsonrpc: '2.0', id: body.id, result: { prompts: [] } }, { headers: cors });
                if (body.method === 'completion/complete') return Response.json({ jsonrpc: '2.0', id: body.id, result: { completion: { values: [], total: 0, hasMore: false } } }, { headers: cors });
                if (body.method === 'tools/list') return Response.json({ jsonrpc: '2.0', id: body.id, result: { tools: getToolsList() } }, { headers: cors });

                if (body.method === 'tools/call') {
                    const { toolHandlers } = createServer(this.env);
                    const toolName = body.params?.name as string;
                    const toolArgs = (body.params?.arguments || {}) as Record<string, unknown>;

                    if (toolHandlers.has(toolName)) {
                        const result = await toolHandlers.get(toolName)!(toolArgs);
                        return Response.json({ jsonrpc: '2.0', id: body.id, result }, { headers: cors });
                    }
                    return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Tool not found: ${toolName}` } }, { headers: cors });
                }

                return Response.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Method not supported: ${body.method}` } }, { status: 400, headers: cors });
            } catch (error) {
                console.error('[Worker] Error:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                return Response.json({ jsonrpc: '2.0', error: { code: -32603, message: `Internal error: ${errorMessage}` } }, { status: 500, headers: cors });
            }
        }

        // OpenAPI JSON
        if (url.pathname === '/openapi.json') {
            const tools = getToolsList();
            const paths: Record<string, any> = {};
            tools.forEach(tool => {
                paths[`/api/${tool.name}`] = {
                    post: {
                        operationId: tool.name,
                        summary: tool.description,
                        description: tool.description,
                        requestBody: { required: true, content: { 'application/json': { schema: tool.inputSchema } } },
                        responses: {
                            '200': { description: 'Ejecución exitosa', content: { 'application/json': { schema: { type: 'object', properties: { content: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, text: { type: 'string' } } } }, isError: { type: 'boolean' } } } } } },
                            '500': { description: 'Error del servidor' }
                        }
                    }
                };
            });

            return Response.json({
                openapi: '3.1.0',
                info: { title: 'Jules MCP API', description: 'API Híbrida MCP/REST', version: '1.1.0' },
                servers: [{ url: 'https://jules-mcp-server.micuenta-maicolcursor.workers.dev' }],
                paths: paths,
            }, { headers: cors });
        }

        // API REST
        if (request.method === 'POST' && url.pathname.startsWith('/api/')) {
            const toolName = url.pathname.replace('/api/', '');
            const { toolHandlers } = createServer(this.env);
            if (toolHandlers.has(toolName)) {
                try {
                    const args = await request.json() as Record<string, unknown>;
                    const result = await toolHandlers.get(toolName)!(args);
                    return Response.json(result, { headers: cors });
                } catch (error) {
                    return Response.json({ error: String(error), isError: true }, { status: 500, headers: cors });
                }
            }
        }

        return new Response('Not Found', { status: 404, headers: cors });
    }
}
