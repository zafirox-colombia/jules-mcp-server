/**
 * Enum: ToolName
 * 
 * Nombres de las herramientas MCP de Jules.
 * Centraliza los identificadores para evitar magic strings.
 */

export enum ToolName {
    LIST_SOURCES = 'jules_list_sources',
    GET_SOURCE = 'jules_get_source',
    CREATE_SESSION = 'jules_create_session',
    LIST_SESSIONS = 'jules_list_sessions',
    GET_STATUS = 'jules_get_status',
    SEND_MESSAGE = 'jules_send_message',
    GET_ACTIVITY = 'jules_get_activity',
    LIST_ACTIVITIES = 'jules_list_activities',
    APPROVE_PLAN = 'jules_approve_plan',
    GET_SESSION_OUTPUT = 'jules_get_session_output',
    DELETE_SESSION = 'jules_delete_session',
}

/**
 * Descripciones en español de las herramientas.
 */
const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
    [ToolName.LIST_SOURCES]: 'Listar Fuentes de Jules',
    [ToolName.GET_SOURCE]: 'Obtener Fuente de Jules',
    [ToolName.CREATE_SESSION]: 'Crear Sesión de Codificación con Jules',
    [ToolName.LIST_SESSIONS]: 'Listar Sesiones de Jules',
    [ToolName.GET_STATUS]: 'Obtener Estado de Sesión de Jules',
    [ToolName.SEND_MESSAGE]: 'Enviar Mensaje a Sesión de Jules',
    [ToolName.GET_ACTIVITY]: 'Obtener Actividad Individual de Jules',
    [ToolName.LIST_ACTIVITIES]: 'Listar Actividades de Sesión de Jules',
    [ToolName.APPROVE_PLAN]: 'Aprobar Plan de Ejecución de Jules',
    [ToolName.GET_SESSION_OUTPUT]: 'Obtener Salida de Sesión de Jules',
    [ToolName.DELETE_SESSION]: 'Eliminar Sesión de Jules',
};

/**
 * Obtiene la descripción de una herramienta.
 */
export function getToolDescription(tool: ToolName): string {
    return TOOL_DESCRIPTIONS[tool];
}

/**
 * Lista todas las herramientas disponibles.
 */
export function getAllTools(): ToolName[] {
    return Object.values(ToolName);
}
