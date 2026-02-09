import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { julesRequest, formatErrorForUser } from "./client.js";
import type {
    SourceList,
    SessionList,
    Session,
    ActivityList,
    CreateSessionRequest,
    SendMessageRequest,
    Activity,
    Source,
} from "./types.js";

// Helper functions (formerly in index.ts)
function translateState(state: string): string {
    const states: Record<string, string> = {
        STATE_UNSPECIFIED: "Desconocido",
        QUEUED: "En cola",
        PLANNING: "Planificando",
        IN_PROGRESS: "En progreso",
        AWAITING_PLAN_APPROVAL: "Esperando aprobación del plan",
        AWAITING_USER_FEEDBACK: "Esperando respuesta del usuario",
        COMPLETED: "Completada",
        FAILED: "Fallida",
        CANCELLED: "Cancelada",
    };
    return states[state] || state;
}

function cleanSessionId(sessionId: string): string {
    if (sessionId.includes("/")) {
        return sessionId.split("/").pop() || sessionId;
    }
    return sessionId;
}

function detectActivityType(activity: Activity): string {
    if (activity.planGenerated) return "Plan Generado";
    if (activity.planApproved) return "Plan Aprobado";
    if (activity.userMessaged) return "Mensaje del Usuario";
    if (activity.agentMessaged) return "Mensaje del Agente";
    if (activity.progressUpdated) return "Progreso Actualizado";
    if (activity.sessionCompleted) return "Sesión Completada";
    if (activity.sessionFailed) return "Sesión Fallida";
    return "Desconocido";
}

function formatActivityContent(activity: Activity, indent: string): string {
    let content = "";

    if (activity.description) {
        content += `\n${indent}  Descripción: ${activity.description}`;
    }

    if (activity.planGenerated?.plan) {
        const plan = activity.planGenerated.plan;
        if (plan.description) {
            content += `\n${indent}  Plan: ${plan.description}`;
        }
        if (plan.steps && plan.steps.length > 0) {
            content += `\n${indent}  Pasos:`;
            plan.steps.forEach((step, i) => {
                content += `\n${indent}    ${i + 1}. ${step.step || step.description || "Paso sin descripción"}`;
                if (step.description && step.step) {
                    content += ` - ${step.description}`;
                }
            });
        }
    }

    if (activity.planApproved) {
        content += `\n${indent}  Plan ID: ${activity.planApproved.planId || "desconocido"}`;
    }

    if (activity.userMessaged?.userMessage) {
        content += `\n${indent}  Mensaje: ${activity.userMessaged.userMessage}`;
    }

    if (activity.agentMessaged?.agentMessage) {
        content += `\n${indent}  Mensaje: ${activity.agentMessaged.agentMessage}`;
    }

    if (activity.progressUpdated) {
        if (activity.progressUpdated.title) {
            content += `\n${indent}  Título: ${activity.progressUpdated.title}`;
        }
        if (activity.progressUpdated.description) {
            content += `\n${indent}  Detalle: ${activity.progressUpdated.description}`;
        }
    }

    if (activity.sessionFailed?.reason) {
        content += `\n${indent}  Razón: ${activity.sessionFailed.reason}`;
    }

    // Artefactos
    if (activity.artifacts && activity.artifacts.length > 0) {
        content += `\n${indent}  Artefactos (${activity.artifacts.length}):`;
        activity.artifacts.forEach((artifact, i) => {
            if (artifact.changeSet?.gitPatch) {
                const patch = artifact.changeSet.gitPatch;
                content += `\n${indent}    ${i + 1}. Cambios de código`;
                if (patch.suggestedCommitMessage) {
                    content += ` - ${patch.suggestedCommitMessage}`;
                }
                if (patch.baseCommitId) {
                    content += `\n${indent}       Commit base: ${patch.baseCommitId}`;
                }
                if (patch.unidiffPatch) {
                    const patchPreview = patch.unidiffPatch.length > 500
                        ? patch.unidiffPatch.substring(0, 500) + "...(truncado)"
                        : patch.unidiffPatch;
                    content += `\n${indent}       Diff:\n${patchPreview}`;
                }
            }
            if (artifact.bashOutput) {
                content += `\n${indent}    ${i + 1}. Comando: ${artifact.bashOutput.command || "desconocido"}`;
                if (artifact.bashOutput.exitCode !== undefined) {
                    content += ` (código: ${artifact.bashOutput.exitCode})`;
                }
                if (artifact.bashOutput.output) {
                    const outputPreview = artifact.bashOutput.output.length > 300
                        ? artifact.bashOutput.output.substring(0, 300) + "...(truncado)"
                        : artifact.bashOutput.output;
                    content += `\n${indent}       Salida: ${outputPreview}`;
                }
            }
            if (artifact.media) {
                content += `\n${indent}    ${i + 1}. Media: ${artifact.media.mimeType || "tipo desconocido"}`;
            }
        });
    }

    return content;
}

function formatActivity(activity: Activity, indent: string = ""): string {
    const type = detectActivityType(activity);
    const originator = activity.originator ? ` [${activity.originator}]` : "";
    let text = `${indent}- [${activity.createTime || "hora desconocida"}] ${type}${originator}:`;
    text += formatActivityContent(activity, indent);
    return text;
}

export function registerTools(server: McpServer) {

    // ===== Herramienta 1: Listar Fuentes =====
    server.registerTool(
        "jules_list_sources",
        {
            title: "Listar Fuentes de Jules",
            description:
                "Lista todos los repositorios de GitHub conectados a Jules. Debes instalar la aplicación GitHub de Jules en https://jules.google.com antes de que los repositorios aparezcan aquí.",
            inputSchema: {
                pageSize: z
                    .number()
                    .optional()
                    .describe("Número de fuentes por página (predeterminado: 50)"),
                pageToken: z
                    .string()
                    .optional()
                    .describe("Token para paginación para obtener la siguiente página"),
                filter: z
                    .string()
                    .optional()
                    .describe("Expresión de filtro basada en AIP-160. Ejemplo: 'name=sources/source1 OR name=sources/source2'"),
            },
        },
        async ({ pageSize, pageToken, filter }) => {
            try {
                const params = new URLSearchParams();
                if (pageSize) params.append("pageSize", pageSize.toString());
                if (pageToken) params.append("pageToken", pageToken);
                if (filter) params.append("filter", filter);

                const query = params.toString() ? `?${params.toString()}` : "";
                const data = await julesRequest<SourceList>(`/sources${query}`);

                if (!data.sources || data.sources.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "No hay repositorios conectados a Jules.\n\nPara conectar repositorios:\n1. Visita https://jules.google.com\n2. Haz clic en 'Conectar cuenta de GitHub'\n3. Autoriza la aplicación GitHub de Jules\n4. Selecciona los repositorios a los que deseas dar acceso",
                            },
                        ],
                    };
                }

                const sourcesList = data.sources
                    .map((source) => {
                        const repo = source.githubRepo;
                        if (repo) {
                            const privacy = repo.isPrivate ? "privado" : "público";
                            const defaultBranch = repo.defaultBranch?.displayName || "desconocida";
                            const branches = repo.branches?.map(b => b.displayName).join(", ") || "desconocidas";
                            return `- ${repo.owner}/${repo.repo} (${privacy})\n  Rama principal: ${defaultBranch}\n  Ramas: ${branches}\n  Nombre del source: ${source.name}`;
                        }
                        return `- ${source.name} (${source.id})`;
                    })
                    .join("\n\n");

                let response = `Repositorios conectados (${data.sources.length}):\n\n${sourcesList}`;

                if (data.nextPageToken) {
                    response += `\n\nMás resultados disponibles. Usa pageToken: ${data.nextPageToken}`;
                }

                return {
                    content: [{ type: "text", text: response }],
                };
            } catch (error) {
                console.error("[jules_list_sources]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al listar fuentes: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 2: Obtener Fuente =====
    server.registerTool(
        "jules_get_source",
        {
            title: "Obtener Fuente de Jules",
            description:
                "Obtiene los detalles de un repositorio específico conectado a Jules por su ID.",
            inputSchema: {
                sourceId: z
                    .string()
                    .describe("ID del source a obtener (ej: github-owner-repo)"),
            },
        },
        async ({ sourceId }) => {
            try {
                // Si el ID ya comienza con 'sources/', no agregar el prefijo de nuevo
                const endpoint = sourceId.startsWith('sources/') ? `/${sourceId}` : `/sources/${sourceId}`;
                const source = await julesRequest<Source>(endpoint);

                const repo = source.githubRepo;
                let response = `Fuente: ${source.name}\nID: ${source.id}\n`;

                if (repo) {
                    const privacy = repo.isPrivate ? "privado" : "público";
                    const defaultBranch = repo.defaultBranch?.displayName || "desconocida";
                    response += `\nRepositorio GitHub:\n`;
                    response += `  Propietario: ${repo.owner}\n`;
                    response += `  Nombre: ${repo.repo}\n`;
                    response += `  Visibilidad: ${privacy}\n`;
                    response += `  Rama principal: ${defaultBranch}\n`;
                    if (repo.branches && repo.branches.length > 0) {
                        response += `  Ramas disponibles:\n`;
                        repo.branches.forEach((branch) => {
                            response += `    - ${branch.displayName}\n`;
                        });
                    }
                }

                return {
                    content: [{ type: "text", text: response }],
                };
            } catch (error) {
                console.error("[jules_get_source]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al obtener la fuente: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 3: Crear Sesión =====
    server.registerTool(
        "jules_create_session",
        {
            title: "Crear Sesión de Codificación con Jules",
            description:
                "Inicia una nueva tarea de codificación asíncrona con Jules. Proporciona una descripción detallada de la tarea y el repositorio donde trabajar. Jules se ejecuta en una VM aislada en la nube y típicamente completa las tareas en 5-60 minutos dependiendo de la complejidad.",
            inputSchema: {
                repoOwner: z
                    .string()
                    .describe("Propietario del repositorio GitHub (usuario u organización)"),
                repoName: z.string().describe("Nombre del repositorio GitHub"),
                prompt: z
                    .string()
                    .describe(
                        "Descripción detallada de la tarea - sé específico sobre lo que necesita hacerse"
                    ),
                branch: z
                    .string()
                    .default("main")
                    .describe("Nombre de la rama inicial (predeterminado: main)"),
                automationMode: z
                    .enum(["AUTOMATION_MODE_UNSPECIFIED", "AUTO_CREATE_PR"])
                    .optional()
                    .describe(
                        "Modo de automatización: AUTO_CREATE_PR crea PR automáticamente al completar"
                    ),
                autoApprove: z
                    .boolean()
                    .default(true)
                    .describe(
                        "[OBSOLETO: usar automationMode] Aprobar automáticamente el plan de ejecución (predeterminado: true). Establece false para aprobar manualmente con jules_approve_plan"
                    ),
                autoCreatePR: z
                    .boolean()
                    .default(true)
                    .describe(
                        "[OBSOLETO: usar automationMode] Crear pull request automáticamente cuando la tarea se complete (predeterminado: true)"
                    ),
                title: z
                    .string()
                    .optional()
                    .describe("Título personalizado opcional para la sesión"),
            },
        },
        async ({
            repoOwner,
            repoName,
            prompt,
            branch,
            automationMode,
            autoApprove,
            autoCreatePR,
            title,
        }) => {
            try {
                const systemPrompt = "IMPORTANTE: Toda la interacción, código, comentarios y documentación debe realizarse en ESPAÑOL. ";
                const fullPrompt = systemPrompt + prompt;

                const requestBody: CreateSessionRequest = {
                    prompt: fullPrompt,
                    sourceContext: {
                        source: `sources/github/${repoOwner}/${repoName}`,
                        githubRepoContext: { startingBranch: branch },
                    },
                    title: title || `${repoName}: ${prompt.substring(0, 50)}`,
                    requirePlanApproval: !autoApprove,
                };

                // AUTO_CREATE_PR por defecto. Solo se desactiva si explícitamente se pasa automationMode=UNSPECIFIED o autoCreatePR=false
                if (automationMode === "AUTOMATION_MODE_UNSPECIFIED") {
                    // El usuario explícitamente no quiere PR automático
                } else if (automationMode === "AUTO_CREATE_PR" || autoCreatePR !== false) {
                    requestBody.automationMode = "AUTO_CREATE_PR";
                }

                const session = await julesRequest<Session>("/sessions", {
                    method: "POST",
                    body: JSON.stringify(requestBody),
                });

                // Asegurar que tenemos un ID válido
                const sessionId = session.id || (session.name ? session.name.split("/").pop() : "unknown");

                const approvalNote = autoApprove
                    ? ""
                    : "\n\nNota: Se requiere aprobación manual del plan. Usa jules_list_activities para ver el plan, luego jules_approve_plan para proceder.";

                const effectiveAutoCreate = (requestBody.automationMode === "AUTO_CREATE_PR");

                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `¡Sesión creada exitosamente!\n\n` +
                                `ID de Sesión: ${sessionId}\n` +
                                `Título: ${session.title}\n` +
                                `Repositorio: ${repoOwner}/${repoName}\n` +
                                `Rama: ${branch}\n` +
                                `Estado: ${session.state}\n` +
                                `Crear PR automáticamente: ${effectiveAutoCreate ? "Sí" : "No"}${approvalNote}\n\n` +
                                `Jules ahora está trabajando asincrónicamente en una VM aislada en la nube.\n` +
                                `Usa jules_get_status con el ID de sesión "${sessionId}" para verificar el progreso.\n\n` +
                                `__JSON_START__\n{"session_id": "${sessionId}"}\n__JSON_END__`,
                        },
                    ],
                };
            } catch (error) {
                console.error("[jules_create_session]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al crear la sesión: ${formatErrorForUser(error)}\n\nProblemas comunes:\n- Repositorio no conectado a Jules (ejecuta jules_list_sources)\n- Propietario/nombre del repositorio inválido\n- La rama no existe`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 4: Listar Sesiones =====
    server.registerTool(
        "jules_list_sessions",
        {
            title: "Listar Sesiones de Jules",
            description:
                "Lista todas tus sesiones de Jules con sus estados actuales. Útil para encontrar IDs de sesión o verificar múltiples tareas.",
            inputSchema: {
                pageSize: z
                    .number()
                    .default(10)
                    .describe("Número de sesiones por página (predeterminado: 10)"),
                pageToken: z
                    .string()
                    .optional()
                    .describe("Token para paginación para obtener la siguiente página"),
            },
        },
        async ({ pageSize, pageToken }) => {
            try {
                const params = new URLSearchParams();
                params.append("pageSize", pageSize.toString());
                if (pageToken) params.append("pageToken", pageToken);

                const data = await julesRequest<SessionList>(
                    `/sessions?${params.toString()}`
                );

                if (!data.sessions || data.sessions.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "No se encontraron sesiones. Crea una con jules_create_session.",
                            },
                        ],
                    };
                }

                const sessionsList = data.sessions
                    .map((session, index) => {
                        const prOut = session.outputs?.find((o: any) => o?.pullRequest);
                        const prUrl = prOut?.pullRequest?.url;
                        const prInfo = prUrl ? `\n  PR: ${prUrl}` : "";
                        return (
                            `${index + 1}. ${session.title || "Sin título"}\n` +
                            `   ID: ${session.id}\n` +
                            `   Estado: ${translateState(session.state)}\n` +
                            `   Creada: ${session.createTime || "desconocido"}${prInfo}`
                        );
                    })
                    .join("\n\n");

                let response = `Tus sesiones de Jules (${data.sessions.length}):\n\n${sessionsList}`;

                if (data.nextPageToken) {
                    response += `\n\nMás resultados disponibles. Usa pageToken: ${data.nextPageToken}`;
                }

                return {
                    content: [{ type: "text", text: response }],
                };
            } catch (error) {
                console.error("[jules_list_sessions]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al listar sesiones: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 5: Obtener Estado de Sesión =====
    server.registerTool(
        "jules_get_status",
        {
            title: "Obtener Estado de Sesión de Jules",
            description:
                "Verifica el estado actual y la actividad reciente de una sesión de Jules. Usa esto para sondear el progreso y la finalización. Las sesiones típicamente toman de 5 a 60 minutos en completarse.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión a verificar"),
                includeActivities: z
                    .number()
                    .default(3)
                    .describe("Número de actividades recientes a incluir (predeterminado: 3)"),
            },
        },
        async ({ sessionId, includeActivities }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                const [session, activities] = await Promise.all([
                    julesRequest<Session>(`/sessions/${sessionId}`),
                    julesRequest<ActivityList>(
                        `/sessions/${sessionId}/activities?pageSize=${includeActivities}`
                    ),
                ]);

                let statusText = `Sesión: ${session.title || "Sin título"}\n`;
                statusText += `Estado: ${translateState(session.state)}\n`;
                statusText += `Prompt: ${session.prompt}\n`;
                if (session.url) {
                    statusText += `URL: ${session.url}\n`;
                }
                statusText += `\n`;

                // Agregar información del PR si está completado
                const prOutput = session.outputs?.find((o: any) => o?.pullRequest);
                const pr = prOutput?.pullRequest;
                if (pr) {
                    statusText += `Pull Request Creado:\n`;
                    statusText += `  URL: ${pr.url}\n`;
                    statusText += `  Título: ${pr.title}\n`;
                    if (pr.description) {
                        statusText += `  Descripción: ${pr.description}\n`;
                    }
                    statusText += `\n`;
                }

                // Agregar actividades recientes
                if (activities.activities && activities.activities.length > 0) {
                    statusText += `Actividades Recientes (últimas ${activities.activities.length}):\n`;
                    activities.activities.forEach((activity) => {
                        statusText += formatActivity(activity, "  ");
                    });
                }

                if (session.state === "AWAITING_PLAN_APPROVAL") {
                    statusText += `\n\nSesión esperando aprobación del plan. Usa jules_list_activities para ver el plan, luego jules_approve_plan para proceder.`;
                } else if (session.state === "AWAITING_USER_FEEDBACK") {
                    statusText += `\n\nSesión esperando respuesta del usuario. Usa jules_send_message para responder.`;
                } else if (
                    ["QUEUED", "PLANNING", "IN_PROGRESS"].includes(session.state)
                ) {
                    statusText += `\n\nSesión aún en ejecución. Consulta de nuevo en 10-30 segundos para actualizaciones.`;
                }

                statusText += `\n\n__JSON_START__\n${JSON.stringify({
                    status: session.state,
                    state: session.state,
                    session_id: session.name,
                })}\n__JSON_END__`;

                return {
                    content: [{ type: "text", text: statusText }],
                };
            } catch (error) {
                console.error("[jules_get_status]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al obtener el estado de la sesión: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 6: Enviar Mensaje =====
    server.registerTool(
        "jules_send_message",
        {
            title: "Enviar Mensaje a Sesión de Jules",
            description:
                "Envía un mensaje de seguimiento o instrucción a una sesión de Jules en ejecución. Jules responderá en la siguiente actividad, que puedes ver con jules_list_activities o jules_get_status.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión a la que enviar el mensaje"),
                message: z
                    .string()
                    .describe("Mensaje o instrucción para enviar a Jules"),
            },
        },
        async ({ sessionId, message }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                const requestBody: SendMessageRequest = {
                    prompt: message,
                };

                await julesRequest(`/sessions/${sessionId}:sendMessage`, {
                    method: "POST",
                    body: JSON.stringify(requestBody),
                });

                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `Mensaje enviado exitosamente a la sesión ${sessionId}.\n\n` +
                                `Jules responderá en la siguiente actividad. ` +
                                `Usa jules_list_activities o jules_get_status para ver la respuesta.`,
                        },
                    ],
                };
            } catch (error) {
                console.error("[jules_send_message]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al enviar mensaje: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 7: Obtener Actividad Individual =====
    server.registerTool(
        "jules_get_activity",
        {
            title: "Obtener Actividad Individual de Jules",
            description:
                "Obtiene una actividad específica de una sesión de Jules. Útil para recuperar información detallada sobre un plan, mensaje o evento de finalización.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión a la que pertenece la actividad"),
                activityId: z.string().describe("ID de la actividad a recuperar"),
            },
        },
        async ({ sessionId, activityId }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                const activity = await julesRequest<Activity>(
                    `/sessions/${sessionId}/activities/${activityId}`
                );

                const activityText = formatActivity(activity);

                return {
                    content: [{ type: "text", text: activityText }],
                };
            } catch (error) {
                console.error("[jules_get_activity]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al obtener la actividad: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 8: Listar Actividades =====
    server.registerTool(
        "jules_list_activities",
        {
            title: "Listar Actividades de Sesión de Jules",
            description:
                "Obtiene el registro detallado de actividades para una sesión de Jules. Las actividades incluyen generación de planes, actualizaciones de progreso, mensajes y eventos de finalización. Las actividades más recientes aparecen primero.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión para obtener actividades"),
                limit: z
                    .number()
                    .default(10)
                    .describe("Número de actividades a recuperar (predeterminado: 10)"),
                pageToken: z
                    .string()
                    .optional()
                    .describe("Token para paginación para obtener la siguiente página"),
            },
        },
        async ({ sessionId, limit, pageToken }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                const params = new URLSearchParams();
                params.append("pageSize", limit.toString());
                if (pageToken) params.append("pageToken", pageToken);

                const data = await julesRequest<ActivityList>(
                    `/sessions/${sessionId}/activities?${params.toString()}`
                );

                if (!data.activities || data.activities.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "No se encontraron actividades para esta sesión. La sesión puede estar recién iniciando.",
                            },
                        ],
                    };
                }

                let activitiesText = `Actividades para la sesión ${sessionId} (${data.activities.length}):\n\n`;

                data.activities.forEach((activity, index) => {
                    activitiesText += `${index + 1}. ${formatActivity(activity)}\n`;
                });

                if (data.nextPageToken) {
                    activitiesText += `Más actividades disponibles. Usa pageToken: ${data.nextPageToken}\n`;
                }

                return {
                    content: [{ type: "text", text: activitiesText }],
                };
            } catch (error) {
                console.error("[jules_list_activities]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al listar actividades: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 9: Aprobar Plan =====
    server.registerTool(
        "jules_approve_plan",
        {
            title: "Aprobar Plan de Ejecución de Jules",
            description:
                "Aprueba el plan de ejecución para una sesión de Jules que tiene requirePlanApproval=true. Solo se necesita cuando el estado de la sesión es AWAITING_PLAN_APPROVAL. Visualiza el plan primero con jules_list_activities.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión para aprobar el plan"),
            },
        },
        async ({ sessionId }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                await julesRequest(`/sessions/${sessionId}:approvePlan`, {
                    method: "POST",
                    body: JSON.stringify({}),
                });

                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `Plan aprobado para la sesión ${sessionId}.\n\n` +
                                `Jules ahora ejecutará la tarea. Usa jules_get_status para monitorear el progreso.`,
                        },
                    ],
                };
            } catch (error) {
                console.error("[jules_approve_plan]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al aprobar el plan: ${formatErrorForUser(error)}\n\nNota: Esto solo funciona para sesiones creadas con autoApprove=false y estado AWAITING_PLAN_APPROVAL.`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 10: Obtener Salida de Sesión =====
    server.registerTool(
        "jules_get_session_output",
        {
            title: "Obtener Salida de Sesión de Jules",
            description:
                "Recupera la salida final y los resultados de una sesión de Jules completada, incluyendo detalles del pull request. Usar después de que el estado de la sesión sea COMPLETED.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión para obtener la salida"),
            },
        },
        async ({ sessionId }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                const session = await julesRequest<Session>(`/sessions/${sessionId}`);

                if (session.state !== "COMPLETED") {
                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    `La sesión ${sessionId} aún no está completada.\n\n` +
                                    `Estado actual: ${translateState(session.state)}\n\n` +
                                    `Usa jules_get_status para monitorear el progreso hasta que el estado sea COMPLETED.`,
                            },
                        ],
                    };
                }

                // Buscar PR en CUALQUIER output (puede estar en [0], [1], etc.)
                const prOutput = session.outputs?.find((o: any) => o?.pullRequest);
                const pr = prOutput?.pullRequest || null;

                // También extraer changeSet si existe
                const csOutput = session.outputs?.find((o: any) => o?.changeSet);
                const changeSet = csOutput?.changeSet;

                if (!pr) {
                    // Diagnóstico: mostrar estructura de outputs si existe
                    const debugOutputs = session.outputs && session.outputs.length > 0
                        ? `\n\nDebug outputs (${session.outputs.length}):\n${JSON.stringify(session.outputs, null, 2)}`
                        : "";

                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    `Sesión completada pero no se detectó un pull request.${debugOutputs}\n\n` +
                                    `Título: ${session.title}\n` +
                                    `URL: ${session.url || "no disponible"}\n\n` +
                                    `Revisa la sesión directamente en Jules: https://jules.google.com/session/${sessionId}`,
                            },
                        ],
                    };
                }

                return {
                    content: [
                        {
                            type: "text",
                            text:
                                `Salida de la Sesión:\n\n` +
                                `Sesión: ${session.title}\n` +
                                `Estado: ${translateState(session.state)}\n\n` +
                                `Pull Request:\n` +
                                `  URL: ${pr.url}\n` +
                                `  Título: ${pr.title}\n` +
                                (pr.number ? `  Número: #${pr.number}\n` : "") +
                                (pr.description ? `  Descripción: ${pr.description}\n` : "") +
                                (changeSet?.gitPatch?.suggestedCommitMessage
                                    ? `\nCommit sugerido: ${changeSet.gitPatch.suggestedCommitMessage}\n`
                                    : "") +
                                `\n` +
                                `Visita la URL del PR para revisar los cambios y hacer merge cuando esté listo.`,
                        },
                    ],
                };
            } catch (error) {
                console.error("[jules_get_session_output]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al obtener la salida de la sesión: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ===== Herramienta 11: Eliminar Sesión =====
    server.registerTool(
        "jules_delete_session",
        {
            title: "Eliminar Sesión de Jules",
            description:
                "Elimina una sesión de Jules. Esto es permanente y no se puede deshacer.",
            inputSchema: {
                sessionId: z.string().describe("ID de la sesión a eliminar"),
            },
        },
        async ({ sessionId }) => {
            try {
                sessionId = cleanSessionId(sessionId);
                await julesRequest(`/sessions/${sessionId}`, {
                    method: "DELETE",
                });

                return {
                    content: [
                        {
                            type: "text",
                            text: `Sesión ${sessionId} eliminada exitosamente.`,
                        },
                    ],
                };
            } catch (error) {
                console.error("[jules_delete_session]", error);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error al eliminar la sesión: ${formatErrorForUser(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );
}
