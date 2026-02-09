/**
 * Barrel export para Enums del dominio
 */

export { SessionState, translateSessionState, isActiveState, requiresUserAction, isTerminalState } from './SessionState.js';
export { AutomationMode, getAutomationModeDescription } from './AutomationMode.js';
export { ToolName, getToolDescription, getAllTools } from './ToolName.js';
