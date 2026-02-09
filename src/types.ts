/**
 * Definiciones de tipos para la API de Google Jules v1alpha
 * https://jules.googleapis.com/v1alpha
 */

// ===== Estados de Sesión =====
export type SessionState =
  | "STATE_UNSPECIFIED"
  | "QUEUED"
  | "PLANNING"
  | "AWAITING_PLAN_APPROVAL"
  | "AWAITING_USER_FEEDBACK"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

// ===== Modos de Automatización =====
export type AutomationMode =
  | "AUTOMATION_MODE_UNSPECIFIED"
  | "AUTO_CREATE_PR";

// ===== Tipos de Fuentes (Sources) =====
export interface GitHubBranch {
  displayName: string;
}

export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate?: boolean;
  defaultBranch?: GitHubBranch;
  branches?: GitHubBranch[];
}

export interface Source {
  name: string;
  id: string;
  githubRepo?: GitHubRepo;
}

export interface SourceList {
  sources?: Source[];
  nextPageToken?: string;
}

// ===== Tipos de Sesión =====
export interface GitHubRepoContext {
  startingBranch?: string;
}

export interface SourceContext {
  source: string;
  githubRepoContext?: GitHubRepoContext;
}

export interface PullRequest {
  url: string;
  title: string;
  description?: string;
  number?: number;
  baseRef?: string;
  headRef?: string;
}

export interface GitPatch {
  unidiffPatch?: string;
  baseCommitId?: string;
  suggestedCommitMessage?: string;
}

export interface ChangeSet {
  source?: string;
  gitPatch?: GitPatch;
}

export interface SessionOutput {
  pullRequest?: PullRequest;
  changeSet?: ChangeSet;
}

export interface Session {
  name?: string;
  id: string;
  title?: string;
  prompt: string;
  state: SessionState;
  url?: string;
  sourceContext?: SourceContext;
  createTime?: string;
  updateTime?: string;
  outputs?: SessionOutput[];
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
}

export interface SessionList {
  sessions?: Session[];
  nextPageToken?: string;
}

// ===== Tipos de Artefactos =====
export interface GitPatch {
  baseCommitId?: string;
  unidiffPatch?: string;
  suggestedCommitMessage?: string;
}

export interface ChangeSet {
  source?: string;
  gitPatch?: GitPatch;
}

export interface BashOutput {
  command?: string;
  output?: string;
  exitCode?: number;
}

export interface Media {
  mimeType?: string;
  data?: string;
}

export interface Artifact {
  changeSet?: ChangeSet;
  bashOutput?: BashOutput;
  media?: Media;
}

// ===== Tipos de Actividad =====
export interface PlanStep {
  step: string;
  description?: string;
}

export interface Plan {
  steps?: PlanStep[];
  description?: string;
}

export interface PlanGenerated {
  plan?: Plan;
}

export interface PlanApproved {
  planId?: string;
}

export interface UserMessaged {
  userMessage?: string;
}

export interface AgentMessaged {
  agentMessage?: string;
}

export interface ProgressUpdated {
  title?: string;
  description?: string;
}

export interface SessionCompleted {
  // Sin propiedades adicionales según la documentación
}

export interface SessionFailed {
  reason?: string;
}

export type ActivityOriginator = "agent" | "user" | "system";

export interface Activity {
  name: string;
  id?: string;
  timestamp?: string;
  createTime?: string;
  originator?: ActivityOriginator;
  description?: string;
  artifacts?: Artifact[];
  planGenerated?: PlanGenerated;
  planApproved?: PlanApproved;
  userMessaged?: UserMessaged;
  agentMessaged?: AgentMessaged;
  progressUpdated?: ProgressUpdated;
  sessionCompleted?: SessionCompleted;
  sessionFailed?: SessionFailed;
}

export interface ActivityList {
  activities?: Activity[];
  nextPageToken?: string;
}

// ===== Tipos de Solicitud =====
export interface CreateSessionRequest {
  prompt: string;
  sourceContext: SourceContext;
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
}

export interface SendMessageRequest {
  prompt: string;
}

// ===== Tipos de Error =====
export interface JulesApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}
