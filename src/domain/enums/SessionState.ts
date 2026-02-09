/**
 * Enum: SessionState
 * 
 * Estados posibles de una sesión de Jules.
 * Reemplaza los magic strings del código original.
 */

export enum SessionState {
    STATE_UNSPECIFIED = 'STATE_UNSPECIFIED',
    QUEUED = 'QUEUED',
    PLANNING = 'PLANNING',
    AWAITING_PLAN_APPROVAL = 'AWAITING_PLAN_APPROVAL',
    AWAITING_USER_FEEDBACK = 'AWAITING_USER_FEEDBACK',
    IN_PROGRESS = 'IN_PROGRESS',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

/**
 * Traducciones de estados de sesión al español.
 */
const STATE_TRANSLATIONS: Record<SessionState, string> = {
    [SessionState.STATE_UNSPECIFIED]: 'No especificado',
    [SessionState.QUEUED]: 'En cola',
    [SessionState.PLANNING]: 'Planificando',
    [SessionState.AWAITING_PLAN_APPROVAL]: 'Esperando aprobación del plan',
    [SessionState.AWAITING_USER_FEEDBACK]: 'Esperando respuesta del usuario',
    [SessionState.IN_PROGRESS]: 'En progreso',
    [SessionState.PAUSED]: 'Pausada',
    [SessionState.COMPLETED]: 'Completada',
    [SessionState.FAILED]: 'Fallida',
    [SessionState.CANCELLED]: 'Cancelada',
};

/**
 * Traduce un estado de sesión al español.
 */
export function translateSessionState(state: SessionState | string): string {
    const enumState = state as SessionState;
    return STATE_TRANSLATIONS[enumState] ?? state;
}

/**
 * Verifica si un estado indica que la sesión está activa.
 */
export function isActiveState(state: SessionState): boolean {
    return [
        SessionState.QUEUED,
        SessionState.PLANNING,
        SessionState.IN_PROGRESS,
    ].includes(state);
}

/**
 * Verifica si un estado indica que la sesión requiere acción del usuario.
 */
export function requiresUserAction(state: SessionState): boolean {
    return [
        SessionState.AWAITING_PLAN_APPROVAL,
        SessionState.AWAITING_USER_FEEDBACK,
    ].includes(state);
}

/**
 * Verifica si un estado indica que la sesión ha terminado.
 */
export function isTerminalState(state: SessionState): boolean {
    return [
        SessionState.COMPLETED,
        SessionState.FAILED,
        SessionState.CANCELLED,
    ].includes(state);
}
