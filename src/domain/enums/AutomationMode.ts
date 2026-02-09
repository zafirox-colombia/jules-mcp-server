/**
 * Enum: AutomationMode
 * 
 * Modos de automatización para sesiones de Jules.
 */

export enum AutomationMode {
    AUTOMATION_MODE_UNSPECIFIED = 'AUTOMATION_MODE_UNSPECIFIED',
    AUTO_CREATE_PR = 'AUTO_CREATE_PR',
}

/**
 * Descripciones de los modos de automatización.
 */
const MODE_DESCRIPTIONS: Record<AutomationMode, string> = {
    [AutomationMode.AUTOMATION_MODE_UNSPECIFIED]: 'No especificado',
    [AutomationMode.AUTO_CREATE_PR]: 'Crear PR automáticamente',
};

/**
 * Obtiene la descripción de un modo de automatización.
 */
export function getAutomationModeDescription(mode: AutomationMode): string {
    return MODE_DESCRIPTIONS[mode] ?? mode;
}
