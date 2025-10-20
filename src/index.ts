#!/usr/bin/env node

/**
 * Jules MCP Server
 * Model Context Protocol server for Google's Jules AI coding agent
 *
 * Exposes Jules API functionality through standardized MCP tools that
 * AI assistants like Claude can discover and invoke.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { julesRequest, formatErrorForUser, getApiKey } from "./client.js";
import type {
  Source,
  SourceList,
  SessionList,
  Session,
  ActivityList,
  CreateSessionRequest,
  SendMessageRequest,
} from "./types.js";

// ===== Server Setup =====
const server = new McpServer({
  name: "jules-mcp-server",
  version: "1.0.0",
});

// ===== Tool 1: List Sources =====
server.registerTool(
  "jules_list_sources",
  {
    title: "List Jules Sources",
    description:
      "List all GitHub repositories connected to Jules. You must install the Jules GitHub app at https://jules.google.com before repositories appear here.",
    inputSchema: {
      pageSize: z
        .number()
        .optional()
        .describe("Number of sources per page (default: 50)"),
      pageToken: z
        .string()
        .optional()
        .describe("Token for pagination to get next page"),
    },
  },
  async ({ pageSize, pageToken }) => {
    try {
      const params = new URLSearchParams();
      if (pageSize) params.append("pageSize", pageSize.toString());
      if (pageToken) params.append("pageToken", pageToken);

      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await julesRequest<SourceList>(`/sources${query}`);

      if (!data.sources || data.sources.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No repositories connected to Jules.\n\nTo connect repositories:\n1. Visit https://jules.google.com\n2. Click 'Connect to GitHub account'\n3. Authorize the Jules GitHub app\n4. Select repositories to grant access",
            },
          ],
        };
      }

      const sourcesList = data.sources
        .map((source) => {
          const repo = source.githubRepo;
          if (repo) {
            const privacy = repo.isPrivate ? "private" : "public";
            const branches = repo.branches?.join(", ") || "unknown";
            return `- ${repo.owner}/${repo.repo} (${privacy})\n  Branches: ${branches}\n  Source name: ${source.name}`;
          }
          return `- ${source.name} (${source.id})`;
        })
        .join("\n\n");

      let response = `Connected repositories (${data.sources.length}):\n\n${sourcesList}`;

      if (data.nextPageToken) {
        response += `\n\nMore results available. Use pageToken: ${data.nextPageToken}`;
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
            text: `Error listing sources: ${formatErrorForUser(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 2: Get Source =====
server.registerTool(
  "jules_get_source",
  {
    title: "Get Jules Source Details",
    description:
      "Get detailed information about a specific GitHub repository source connected to Jules. Provide the repository owner and name.",
    inputSchema: {
      repoOwner: z
        .string()
        .describe("GitHub repository owner (username or organization)"),
      repoName: z.string().describe("GitHub repository name"),
    },
  },
  async ({ repoOwner, repoName }) => {
    try {
      const sourceName = `sources/github/${repoOwner}/${repoName}`;
      const source = await julesRequest<Source>(`/${sourceName}`);

      const repo = source.githubRepo;
      if (!repo) {
        return {
          content: [
            {
              type: "text",
              text:
                `Source found but no GitHub repository information available.\n\n` +
                `Source ID: ${source.id}\n` +
                `Source name: ${source.name}`,
            },
          ],
        };
      }

      const privacy = repo.isPrivate ? "private" : "public";
      const branches = repo.branches?.join(", ") || "none listed";

      return {
        content: [
          {
            type: "text",
            text:
              `GitHub Repository Source:\n\n` +
              `Owner: ${repo.owner}\n` +
              `Repository: ${repo.repo}\n` +
              `Visibility: ${privacy}\n` +
              `Available branches: ${branches}\n\n` +
              `Source ID: ${source.id}\n` +
              `Source name: ${source.name}`,
          },
        ],
      };
    } catch (error) {
      console.error("[jules_get_source]", error);
      return {
        content: [
          {
            type: "text",
            text:
              `Error getting source: ${formatErrorForUser(error)}\n\n` +
              `Common issues:\n` +
              `- Repository not connected to Jules (run jules_list_sources)\n` +
              `- Invalid repository owner/name\n` +
              `- Repository access was revoked`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 3: Create Session =====
server.registerTool(
  "jules_create_session",
  {
    title: "Create Jules Coding Session",
    description:
      "Start a new asynchronous coding task with Jules. Provide a detailed task description and the repository to work on. Jules runs in an isolated cloud VM and typically completes tasks in 5-60 minutes depending on complexity.",
    inputSchema: {
      repoOwner: z
        .string()
        .describe("GitHub repository owner (username or organization)"),
      repoName: z.string().describe("GitHub repository name"),
      prompt: z
        .string()
        .describe(
          "Detailed task description - be specific about what needs to be done"
        ),
      branch: z
        .string()
        .default("main")
        .describe("Starting branch name (default: main)"),
      autoApprove: z
        .boolean()
        .default(true)
        .describe(
          "Automatically approve the execution plan (default: true). Set false to manually approve with jules_approve_plan"
        ),
      autoCreatePR: z
        .boolean()
        .default(false)
        .describe(
          "Automatically create pull request when task completes (default: false)"
        ),
      title: z
        .string()
        .optional()
        .describe("Optional custom title for the session"),
    },
  },
  async ({
    repoOwner,
    repoName,
    prompt,
    branch,
    autoApprove,
    autoCreatePR,
    title,
  }) => {
    try {
      const requestBody: CreateSessionRequest = {
        prompt,
        sourceContext: {
          source: `sources/github/${repoOwner}/${repoName}`,
          githubRepoContext: { startingBranch: branch },
        },
        title: title || `${repoName}: ${prompt.substring(0, 50)}`,
        requirePlanApproval: !autoApprove,
      };

      if (autoCreatePR) {
        requestBody.automationMode = "AUTO_CREATE_PR";
      }

      const session = await julesRequest<Session>("/sessions", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const approvalNote = autoApprove
        ? ""
        : "\n\nNote: Manual plan approval required. Use jules_list_activities to see the plan, then jules_approve_plan to proceed.";

      return {
        content: [
          {
            type: "text",
            text:
              `Session created successfully!\n\n` +
              `Session ID: ${session.id}\n` +
              `Title: ${session.title}\n` +
              `Repository: ${repoOwner}/${repoName}\n` +
              `Branch: ${branch}\n` +
              `State: ${session.state}\n` +
              `Auto-create PR: ${autoCreatePR}${approvalNote}\n\n` +
              `Jules is now working asynchronously in an isolated cloud VM.\n` +
              `Use jules_get_status with session ID "${session.id}" to check progress.`,
          },
        ],
      };
    } catch (error) {
      console.error("[jules_create_session]", error);
      return {
        content: [
          {
            type: "text",
            text: `Error creating session: ${formatErrorForUser(error)}\n\nCommon issues:\n- Repository not connected to Jules (run jules_list_sources)\n- Invalid repository owner/name\n- Branch does not exist`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 4: List Sessions =====
server.registerTool(
  "jules_list_sessions",
  {
    title: "List Jules Sessions",
    description:
      "List all your Jules sessions with their current states. Useful for finding session IDs or checking on multiple tasks.",
    inputSchema: {
      pageSize: z
        .number()
        .default(10)
        .describe("Number of sessions per page (default: 10)"),
      pageToken: z
        .string()
        .optional()
        .describe("Token for pagination to get next page"),
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
              text: "No sessions found. Create one with jules_create_session.",
            },
          ],
        };
      }

      const sessionsList = data.sessions
        .map((session, index) => {
          const prUrl = session.outputs?.[0]?.pullRequest?.url;
          const prInfo = prUrl ? `\n  PR: ${prUrl}` : "";
          return (
            `${index + 1}. ${session.title || "Untitled"}\n` +
            `   ID: ${session.id}\n` +
            `   State: ${session.state}\n` +
            `   Created: ${session.createTime || "unknown"}${prInfo}`
          );
        })
        .join("\n\n");

      let response = `Your Jules sessions (${data.sessions.length}):\n\n${sessionsList}`;

      if (data.nextPageToken) {
        response += `\n\nMore results available. Use pageToken: ${data.nextPageToken}`;
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
            text: `Error listing sessions: ${formatErrorForUser(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 5: Get Session Status =====
server.registerTool(
  "jules_get_status",
  {
    title: "Get Jules Session Status",
    description:
      "Check the current status and recent activity of a Jules session. Use this to poll for progress and completion. Sessions typically take 5-60 minutes to complete.",
    inputSchema: {
      sessionId: z.string().describe("Session ID to check"),
      includeActivities: z
        .number()
        .default(3)
        .describe("Number of recent activities to include (default: 3)"),
    },
  },
  async ({ sessionId, includeActivities }) => {
    try {
      const [session, activities] = await Promise.all([
        julesRequest<Session>(`/sessions/${sessionId}`),
        julesRequest<ActivityList>(
          `/sessions/${sessionId}/activities?pageSize=${includeActivities}`
        ),
      ]);

      let statusText = `Session: ${session.title || "Untitled"}\n`;
      statusText += `State: ${session.state}\n`;
      statusText += `Prompt: ${session.prompt}\n\n`;

      // Add PR information if completed
      const pr = session.outputs?.[0]?.pullRequest;
      if (pr) {
        statusText += `Pull Request Created:\n`;
        statusText += `  URL: ${pr.url}\n`;
        statusText += `  Title: ${pr.title}\n`;
        if (pr.description) {
          statusText += `  Description: ${pr.description}\n`;
        }
        statusText += `\n`;
      }

      // Add recent activities
      if (activities.activities && activities.activities.length > 0) {
        statusText += `Recent Activity (${activities.activities.length}):\n`;
        activities.activities.forEach((activity, index) => {
          const originator = activity.originator || "unknown";
          statusText += `\n${index + 1}. [${originator}] `;

          if (activity.planGenerated) {
            const steps = activity.planGenerated.plan?.steps?.length || 0;
            statusText += `Generated execution plan with ${steps} steps`;
          } else if (activity.messageSent) {
            const msg = activity.messageSent.message.substring(0, 100);
            statusText += `Message: ${msg}${activity.messageSent.message.length > 100 ? "..." : ""}`;
          } else if (activity.messageReceived) {
            const msg = activity.messageReceived.message.substring(0, 100);
            statusText += `Received: ${msg}${activity.messageReceived.message.length > 100 ? "..." : ""}`;
          } else if (activity.progressUpdate) {
            statusText += `Progress update`;
          } else if (activity.sessionCompleted) {
            statusText += `Session completed successfully`;
          } else if (activity.sessionFailed) {
            statusText += `Session failed: ${activity.sessionFailed.error || "unknown error"}`;
          } else {
            statusText += `Activity occurred`;
          }
        });
      } else {
        statusText += `No activities yet - session starting up.`;
      }

      // Add guidance based on state
      if (session.state === "COMPLETED") {
        statusText += `\n\nSession complete! Use jules_get_session_output for detailed results.`;
      } else if (session.state === "FAILED") {
        statusText += `\n\nSession failed. Use jules_list_activities to see detailed error information.`;
      } else if (session.state === "WAITING_FOR_PLAN_APPROVAL") {
        statusText += `\n\nSession awaiting plan approval. Use jules_list_activities to see the plan, then jules_approve_plan to proceed.`;
      } else if (
        ["QUEUED", "PLANNING", "IN_PROGRESS"].includes(session.state)
      ) {
        statusText += `\n\nSession still running. Poll again in 10-30 seconds for updates.`;
      }

      return {
        content: [{ type: "text", text: statusText }],
      };
    } catch (error) {
      console.error("[jules_get_status]", error);
      return {
        content: [
          {
            type: "text",
            text: `Error getting session status: ${formatErrorForUser(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 6: Send Message =====
server.registerTool(
  "jules_send_message",
  {
    title: "Send Message to Jules Session",
    description:
      "Send a follow-up message or instruction to a running Jules session. Jules will respond in the next activity, which you can see with jules_list_activities or jules_get_status.",
    inputSchema: {
      sessionId: z.string().describe("Session ID to send message to"),
      message: z
        .string()
        .describe("Message or instruction to send to Jules"),
    },
  },
  async ({ sessionId, message }) => {
    try {
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
              `Message sent successfully to session ${sessionId}.\n\n` +
              `Jules will respond in the next activity. ` +
              `Use jules_list_activities or jules_get_status to see the response.`,
          },
        ],
      };
    } catch (error) {
      console.error("[jules_send_message]", error);
      return {
        content: [
          {
            type: "text",
            text: `Error sending message: ${formatErrorForUser(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 7: List Activities =====
server.registerTool(
  "jules_list_activities",
  {
    title: "List Jules Session Activities",
    description:
      "Get detailed activity log for a Jules session. Activities include plan generation, progress updates, messages, and completion events. Most recent activities appear first.",
    inputSchema: {
      sessionId: z.string().describe("Session ID to get activities for"),
      limit: z
        .number()
        .default(10)
        .describe("Number of activities to retrieve (default: 10)"),
      pageToken: z
        .string()
        .optional()
        .describe("Token for pagination to get next page"),
    },
  },
  async ({ sessionId, limit, pageToken }) => {
    try {
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
              text: "No activities found for this session. The session may be just starting.",
            },
          ],
        };
      }

      let activitiesText = `Activities for session ${sessionId} (${data.activities.length}):\n\n`;

      data.activities.forEach((activity, index) => {
        const originator = activity.originator || "unknown";
        const timestamp = activity.timestamp || "no timestamp";

        activitiesText += `${index + 1}. [${originator}] ${timestamp}\n`;

        if (activity.planGenerated) {
          const plan = activity.planGenerated.plan;
          activitiesText += `   Generated execution plan:\n`;
          if (plan?.description) {
            activitiesText += `   ${plan.description}\n`;
          }
          if (plan?.steps && plan.steps.length > 0) {
            activitiesText += `   Steps:\n`;
            plan.steps.forEach((step, stepIndex) => {
              activitiesText += `   ${stepIndex + 1}. ${step.step}\n`;
              if (step.description) {
                activitiesText += `      ${step.description}\n`;
              }
            });
          }
        } else if (activity.messageSent) {
          activitiesText += `   Message sent: ${activity.messageSent.message}\n`;
        } else if (activity.messageReceived) {
          activitiesText += `   Message received: ${activity.messageReceived.message}\n`;
        } else if (activity.progressUpdate) {
          activitiesText += `   Progress update`;
          if (activity.progressUpdate.message) {
            activitiesText += `: ${activity.progressUpdate.message}`;
          }
          if (activity.progressUpdate.progress !== undefined) {
            activitiesText += ` (${activity.progressUpdate.progress}%)`;
          }
          activitiesText += `\n`;
        } else if (activity.sessionCompleted) {
          activitiesText += `   Session completed: ${activity.sessionCompleted.success ? "SUCCESS" : "FAILED"}\n`;
          if (activity.sessionCompleted.message) {
            activitiesText += `   ${activity.sessionCompleted.message}\n`;
          }
        } else if (activity.sessionFailed) {
          activitiesText += `   Session failed\n`;
          if (activity.sessionFailed.error) {
            activitiesText += `   Error: ${activity.sessionFailed.error}\n`;
          }
          if (activity.sessionFailed.message) {
            activitiesText += `   ${activity.sessionFailed.message}\n`;
          }
        } else {
          activitiesText += `   Activity occurred\n`;
        }

        activitiesText += `\n`;
      });

      if (data.nextPageToken) {
        activitiesText += `More activities available. Use pageToken: ${data.nextPageToken}\n`;
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
            text: `Error listing activities: ${formatErrorForUser(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 8: Approve Plan =====
server.registerTool(
  "jules_approve_plan",
  {
    title: "Approve Jules Execution Plan",
    description:
      "Approve the execution plan for a Jules session that has requirePlanApproval=true. Only needed when session state is WAITING_FOR_PLAN_APPROVAL. View the plan first with jules_list_activities.",
    inputSchema: {
      sessionId: z.string().describe("Session ID to approve plan for"),
    },
  },
  async ({ sessionId }) => {
    try {
      await julesRequest(`/sessions/${sessionId}:approvePlan`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      return {
        content: [
          {
            type: "text",
            text:
              `Plan approved for session ${sessionId}.\n\n` +
              `Jules will now execute the task. Use jules_get_status to monitor progress.`,
          },
        ],
      };
    } catch (error) {
      console.error("[jules_approve_plan]", error);
      return {
        content: [
          {
            type: "text",
            text: `Error approving plan: ${formatErrorForUser(error)}\n\nNote: This only works for sessions created with autoApprove=false and state WAITING_FOR_PLAN_APPROVAL.`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Tool 9: Get Session Output =====
server.registerTool(
  "jules_get_session_output",
  {
    title: "Get Jules Session Output",
    description:
      "Retrieve the final output and results from a completed Jules session, including pull request details. Use after session state is COMPLETED.",
    inputSchema: {
      sessionId: z.string().describe("Session ID to get output for"),
    },
  },
  async ({ sessionId }) => {
    try {
      const session = await julesRequest<Session>(`/sessions/${sessionId}`);

      if (session.state !== "COMPLETED") {
        return {
          content: [
            {
              type: "text",
              text:
                `Session ${sessionId} is not yet completed.\n\n` +
                `Current state: ${session.state}\n\n` +
                `Use jules_get_status to monitor progress until state is COMPLETED.`,
            },
          ],
        };
      }

      const pr = session.outputs?.[0]?.pullRequest;

      if (!pr) {
        return {
          content: [
            {
              type: "text",
              text:
                `Session completed but no pull request was created.\n\n` +
                `Title: ${session.title}\n` +
                `Prompt: ${session.prompt}\n\n` +
                `This may be expected if the task didn't require code changes, ` +
                `or if automationMode was not set to AUTO_CREATE_PR.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              `Session Output:\n\n` +
              `Session: ${session.title}\n` +
              `State: ${session.state}\n\n` +
              `Pull Request:\n` +
              `  URL: ${pr.url}\n` +
              `  Title: ${pr.title}\n` +
              (pr.number ? `  Number: #${pr.number}\n` : "") +
              (pr.description ? `  Description: ${pr.description}\n` : "") +
              `\n` +
              `Visit the PR URL to review changes and merge when ready.`,
          },
        ],
      };
    } catch (error) {
      console.error("[jules_get_session_output]", error);
      return {
        content: [
          {
            type: "text",
            text: `Error getting session output: ${formatErrorForUser(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ===== Start Server =====
async function main() {
  try {
    // Validate API key at startup
    getApiKey();

    // Connect stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Log to stderr (stdout is reserved for MCP protocol)
    console.error("Jules MCP server running");
    console.error("Connected tools: 9");
    console.error("  - jules_list_sources");
    console.error("  - jules_get_source");
    console.error("  - jules_create_session");
    console.error("  - jules_list_sessions");
    console.error("  - jules_get_status");
    console.error("  - jules_send_message");
    console.error("  - jules_list_activities");
    console.error("  - jules_approve_plan");
    console.error("  - jules_get_session_output");
  } catch (error) {
    console.error("Fatal error starting Jules MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
