# Jules MCP Server

Model Context Protocol (MCP) server for Google's Jules AI coding agent. Enables AI assistants like Claude to create and manage asynchronous coding tasks through the Jules API.

## Overview

Jules is Google's AI coding agent that executes development tasks in isolated cloud VMs. This MCP server exposes Jules functionality through 8 standardized tools that AI assistants can discover and invoke automatically.

**What Jules can do:**
- Generate code from natural language descriptions
- Fix bugs including race conditions and logic errors
- Create comprehensive test suites with mocking
- Update dependencies and handle breaking changes
- Refactor code across multiple files
- Search documentation and perform code reviews

Tasks run asynchronously and typically complete in 5-60 minutes depending on complexity.

## Prerequisites

1. **Google Account** with Jules access
2. **Jules API Key** - Get from https://jules.google.com/settings#api (up to 3 keys allowed)
3. **GitHub Integration** - Install Jules GitHub app at https://jules.google.com to connect repositories
4. **Node.js** 18+ installed on your system

## Quick Start

### 1. Installation

```bash
cd jules-mcp-server
npm install
npm run build
```

### 2. Configure API Key

Create a `.env` file (never commit this):

```bash
cp .env.example .env
# Edit .env and add your Jules API key
```

Or pass the key directly in Claude Desktop config (recommended - see below).

### 3. Configure Claude Desktop

Edit your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "jules": {
      "command": "node",
      "args": ["/absolute/path/to/jules-mcp-server/build/index.js"],
      "env": {
        "JULES_API_KEY": "your_actual_jules_api_key_here"
      }
    }
  }
}
```

**Important:**
- Use the absolute path to `build/index.js` (not relative)
- Replace `your_actual_jules_api_key_here` with your real API key
- Restart Claude Desktop completely after making changes

### 4. Verify Installation

1. Restart Claude Desktop
2. Look for the 🔌 icon in the Claude interface
3. You should see "jules" server with 8 tools available
4. Try asking Claude: "List my Jules repositories"

## Available Tools

### 1. `jules_list_sources`
List all GitHub repositories connected to Jules.

**Example prompt:** "Show me my Jules repositories"

### 2. `jules_create_session`
Start a new asynchronous coding task.

**Parameters:**
- `repoOwner` - GitHub repository owner/org
- `repoName` - Repository name
- `prompt` - Detailed task description
- `branch` - Starting branch (default: "main")
- `autoApprove` - Auto-approve plan (default: true)
- `autoCreatePR` - Auto-create PR when done (default: false)

**Example prompt:** "Create a Jules session for myorg/myrepo to add unit tests for the authentication module"

### 3. `jules_list_sessions`
List all your Jules sessions with their states.

**Example prompt:** "Show all my Jules sessions"

### 4. `jules_get_status`
Check session status and recent activity. Use this to poll for completion.

**Example prompt:** "Check status of Jules session abc123"

### 5. `jules_send_message`
Send a follow-up message to a running session.

**Example prompt:** "Tell Jules session abc123 to also add error handling"

### 6. `jules_list_activities`
Get detailed activity log including plan steps and progress updates.

**Example prompt:** "Show me the detailed activities for session abc123"

### 7. `jules_approve_plan`
Approve execution plan (only needed if `autoApprove=false`).

**Example prompt:** "Approve the plan for Jules session abc123"

### 8. `jules_get_session_output`
Retrieve final results and PR URL from completed session.

**Example prompt:** "Get the results from Jules session abc123"

## Usage Examples

### Basic Workflow

```
You: "I need to add authentication tests to my project"

Claude: I'll help you create a Jules session for that.
[Uses jules_list_sources to find your repos]
[Uses jules_create_session with your requirements]

Claude: Session created! ID: ses_abc123. Jules is working on this task.
I'll check back in 30 seconds.
[Waits, then uses jules_get_status periodically]

Claude: Jules completed the task! Here's the pull request: [URL]
```

### Manual Plan Approval Workflow

```
You: "Create a Jules session to refactor the database layer, but I want to approve the plan first"

Claude: I'll create a session with manual approval.
[Uses jules_create_session with autoApprove=false]

Claude: Session created and waiting for plan approval.
[Uses jules_list_activities to show the plan]

You: "Looks good, approve it"

Claude: [Uses jules_approve_plan]
Plan approved! Jules is now executing.
```

### Sending Follow-up Instructions

```
You: "Check on my Jules session ses_abc123"

Claude: [Uses jules_get_status]
Jules is working on adding tests. Currently implementing auth tests.

You: "Tell Jules to also add integration tests"

Claude: [Uses jules_send_message]
Message sent. Jules will incorporate this in the next steps.
```

## Rate Limits and Quotas

Jules enforces task quotas based on subscription tier:

- **Free**: 15 daily tasks, 3 concurrent tasks
- **Google AI Pro** ($19.99/mo): ~75 daily tasks, 15 concurrent tasks
- **Google AI Ultra** ($124.99/mo): ~300 daily tasks, 60 concurrent tasks

Tasks count against your quota even if they fail. The quota resets on a rolling 24-hour window.

## Async Workflow Pattern

Jules sessions run asynchronously in cloud VMs. The typical workflow:

1. **Create session** - Returns immediately with session ID
2. **Poll for status** - Check every 10-30 seconds using `jules_get_status`
3. **Monitor activities** - View detailed progress with `jules_list_activities`
4. **Retrieve results** - Get PR URL when state is COMPLETED

Claude handles this polling automatically when you ask to monitor a task.

## Troubleshooting

### Tools not appearing in Claude Desktop

1. Verify absolute path in config (not relative)
2. Check that `build/index.js` exists after running `npm run build`
3. Ensure API key is set correctly
4. Restart Claude Desktop completely (not just reload)
5. Check Console logs for error messages

### "JULES_API_KEY environment variable required" error

- API key not set in Claude Desktop config
- Make sure the `env` object in config contains `JULES_API_KEY`

### "No repositories connected to Jules" error

1. Visit https://jules.google.com
2. Click "Connect to GitHub account"
3. Authorize the Jules GitHub app
4. Select repositories to grant access
5. Refresh the Jules web app to sync

### Session fails immediately

- Check repository is connected to Jules
- Verify branch name exists
- Ensure repository has proper access permissions
- Check Jules web interface for detailed error messages

### API errors (401, 403, 404)

- **401**: Invalid API key - regenerate at https://jules.google.com/settings#api
- **403**: Insufficient permissions or quota exceeded
- **404**: Session ID or repository not found

## Development

### Run in Development Mode

```bash
npm run dev  # Watch mode - rebuilds on changes
```

### Test with MCP Inspector

```bash
npm run inspector
```

This opens a web interface where you can test tools interactively without Claude Desktop.

### Project Structure

```
jules-mcp-server/
├── src/
│   ├── index.ts      # Main server and tool implementations
│   ├── client.ts     # Jules API client helper
│   └── types.ts      # TypeScript type definitions
├── build/            # Compiled JavaScript (git-ignored)
├── package.json      # Dependencies and scripts
├── tsconfig.json     # TypeScript configuration
└── .env              # API key (git-ignored, create from .env.example)
```

### Adding New Tools

1. Define types in `src/types.ts`
2. Add tool registration in `src/index.ts` following the existing pattern
3. Use Zod schemas for input validation
4. Wrap implementation in try-catch with proper error responses
5. Rebuild: `npm run build`

## Security Best Practices

1. **Never commit API keys** - Use `.env` or Claude Desktop config only
2. **Use .gitignore** - Ensure `.env` and `build/` are excluded
3. **Rotate keys regularly** - Regenerate at https://jules.google.com/settings#api
4. **Monitor usage** - Check Jules web interface for unexpected activity
5. **Limit repository access** - Only grant Jules access to necessary repos

## Claude Desktop Configuration Tips

**Use absolute paths:**
```json
✅ "/Users/username/jules-mcp-server/build/index.js"
❌ "~/jules-mcp-server/build/index.js"
❌ "./jules-mcp-server/build/index.js"
```

**Multiple servers:**
```json
{
  "mcpServers": {
    "jules": { ... },
    "other-server": { ... }
  }
}
```

**Debug logging:**
Check Claude Desktop logs:
- **macOS**: `~/Library/Logs/Claude/`
- **Windows**: `%APPDATA%\Claude\logs\`

## API Reference

This server implements the Jules API v1alpha:
- **Base URL**: `https://jules.googleapis.com/v1alpha`
- **Authentication**: `X-Goog-Api-Key` header
- **Documentation**: https://jules.google.com (requires account)

## Resources

- **Jules Web Interface**: https://jules.google.com
- **Get API Key**: https://jules.google.com/settings#api
- **Connect GitHub**: https://jules.google.com (GitHub integration section)
- **MCP Documentation**: https://modelcontextprotocol.io
- **Claude Desktop**: https://claude.ai/download

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- TypeScript compiles without errors
- All tools follow the error handling pattern
- Documentation is updated for new features
- No API keys or secrets in commits

## Changelog

### v1.0.0 (2025-01-15)
- Initial release
- 8 core tools for Jules API integration
- Stdio transport for Claude Desktop
- Comprehensive error handling and logging
- Full TypeScript type safety
