/**
 * Type definitions for Google Jules API v1alpha
 * https://jules.googleapis.com/v1alpha
 */

// ===== Session States =====
export type SessionState =
  | "STATE_UNSPECIFIED"
  | "QUEUED"
  | "PLANNING"
  | "WAITING_FOR_PLAN_APPROVAL"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

// ===== Source Types =====
export interface GitHubRepo {
  owner: string;
  repo: string;
  isPrivate?: boolean;
  branches?: string[];
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

// ===== Session Types =====
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
}

export interface SessionOutput {
  pullRequest?: PullRequest;
}

export interface Session {
  id: string;
  title?: string;
  prompt: string;
  state: SessionState;
  sourceContext?: SourceContext;
  createTime?: string;
  updateTime?: string;
  outputs?: SessionOutput[];
  requirePlanApproval?: boolean;
  automationMode?: string;
}

export interface SessionList {
  sessions?: Session[];
  nextPageToken?: string;
}

// ===== Activity Types =====
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

export interface MessageSent {
  message: string;
}

export interface MessageReceived {
  message: string;
}

export interface ProgressUpdate {
  message?: string;
  progress?: number;
}

export interface SessionCompleted {
  success: boolean;
  message?: string;
}

export interface SessionFailed {
  error?: string;
  message?: string;
}

export type ActivityOriginator = "agent" | "user";

export interface Activity {
  name: string;
  timestamp?: string;
  originator?: ActivityOriginator;
  planGenerated?: PlanGenerated;
  messageSent?: MessageSent;
  messageReceived?: MessageReceived;
  progressUpdate?: ProgressUpdate;
  sessionCompleted?: SessionCompleted;
  sessionFailed?: SessionFailed;
}

export interface ActivityList {
  activities?: Activity[];
  nextPageToken?: string;
}

// ===== Request Types =====
export interface CreateSessionRequest {
  prompt: string;
  sourceContext: SourceContext;
  title?: string;
  requirePlanApproval?: boolean;
  automationMode?: "AUTO_CREATE_PR" | string;
}

export interface SendMessageRequest {
  prompt: string;
}

// ===== Error Types =====
export interface JulesApiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}
