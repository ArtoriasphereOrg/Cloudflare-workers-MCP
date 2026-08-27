## Deployment of a Model Context Protocol (MCP) Server on Cloudflare Workers

This document outlines the process for deploying a Model Context Protocol (MCP) server utilizing Cloudflare Workers. This method eliminates the necessity for a local toolchain, allowing for direct deployment via the Cloudflare Dashboard web editor.

---

### Project Overview

This initiative provides a pre-configured Cloudflare Worker script designed to function as a remote MCP server. Compatible AI clients, such as Claude Desktop and Cursor, can establish HTTP connections to this server. This enables the invocation of custom tools hosted and executed on Cloudflare's distributed global network. The deployment is streamlined, requiring no `wrangler` CLI or local Node.js installation.

---

### Key Features

*   **HTTP-based MCP Server:** Implements the full MCP protocol with streamable HTTP transport.
*   **Web-Based Deployment:** Facilitates complete deployment through the Cloudflare Dashboard's web editor.
*   **Global Edge Execution:** Leverages Cloudflare's global edge network for minimal latency, zero cold starts, and compatibility with the free tier.
*   **Extensibility:** Designed for straightforward integration of custom tools.
*   **Client Compatibility:** Supports standard MCP clients including Claude Desktop and Cursor.

---

### Implementation Guide

#### Step 1: Access the Cloudflare Dashboard

Navigate to [dash.cloudflare.com](https://dash.cloudflare.com). Within the dashboard, select **Workers & Pages**, then **Create**, and subsequently **Create Worker**.

#### Step 2: Code Integration

In the web editor interface, select **Edit code**. Replace the entirety of the existing content with the contents of the `worker.js` file from this repository.

*   **Note:** The dashboard web editor directly accepts JavaScript code, negating the need for a build process or CLI.

#### Step 3: Save and Deploy

Click the **Deploy** button. Your worker will become accessible at the following URL format:

```
https://<your-worker-name>.<your-subdomain>.workers.dev
```

#### Step 4: MCP Client Configuration

Integrate the deployed worker URL into your MCP client's configuration. For instance, within **Claude Desktop**, update the `claude_desktop_config.json` file as follows:

```json
{
  "mcpServers": {
    "my-cf-worker": {
      "type": "http",
      "url": "https://<your-worker-name>.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

Upon restarting Claude Desktop, your tools should be automatically recognized.

---

### Testing Without Local Installation

The deployed MCP server can be tested directly from a web browser, eliminating the need for any local software installation.

#### Method 1: MCP Inspector (Browser Interface)

Access the hosted MCP Inspector via your web browser:

```
https://inspector.tools.mcp.run/
```

Input your worker URL:

```
https://<your-worker-name>.<your-subdomain>.workers.dev/mcp
```

Click **Connect** to view and interact with your listed tools.

#### Method 2: Hoppscotch (Browser-Based REST Client)

Utilize [hoppscotch.io](https://hoppscotch.io) without requiring an account or installation:

1.  Set the HTTP method to **POST**.
2.  Specify the URL as `https://<your-worker-name>.<your-subdomain>.workers.dev/mcp`.
3.  Add the `Content-Type: application/json` header.
4.  In the **Body** section, insert one of the following JSON payloads:

    ```json
    // To list all available tools:
    { "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }

    // To invoke a tool:
    { "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": "my_tool", "arguments": { "query": "hello" } } }
    ```
5.  Click **Send**.

#### Method 3: Cloudflare Dashboard Logs (Zero Setup)

Navigate to your Worker in the Cloudflare Dashboard, select the **Logs** tab, and initiate a log stream. Subsequently, send a request to your worker URL from another browser tab or Hoppscotch. The full request and response will be visible in real-time within the logs.

#### Method 4: Online Terminal (curl)

Employ services like [repl.it](https://repl.it) or [CodeSandbox](https://codesandbox.io) to execute `curl` commands without local installation:

```bash
# List available tools
curl -X POST https://<your-worker-name>.<your-subdomain>.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Invoke a tool
curl -X POST https://<your-worker-name>.<your-subdomain>.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"my_tool","arguments":{"query":"hello"}}}'
```

---

### Project Directory Structure

The project comprises the following files:

```
.
├── worker.js          # Primary Worker script for web editor integration
├── wrangler.toml      # Optional: for local development and CLI deployment
└── README.md
```

---

### Integrating Custom Tools

To incorporate custom tools, modify the `worker.js` file. Tools are defined within the MCP server handler and require a unique **name**, a descriptive **description**, and a defined **input schema**:

```javascript
server.tool(
  "my_tool",
  "Performs a specific function",
  {
    input: {
      type: "object",
      properties: {
        query: { type: "string", description: "Input for processing" }
      },
      required: ["query"]
    }
  },
  async ({ input }) => {
    // Custom tool logic
    return {
      content: [{ type: "text", text: `Processed: ${input.query}` }],
    };
  }
);
```

Following modifications, simply **Save and Deploy** from the web editor.

---

### Optional: Local Development with Wrangler

For iterative local development prior to deployment:

```bash
# Install project dependencies
npm install

# Initiate local development server
npx wrangler dev

# Deploy using the CLI
npx wrangler deploy
```

This process requires [Node.js](https://nodejs.org) and a [Cloudflare account](https://dash.cloudflare.com/sign-up).

---

### Interfacing with Other MCP Clients

For clients such as Cursor, VS Code, or other HTTP-compatible applications:

```json
{
  "mcpServers": {
    "cloudflare-worker": {
      "type": "http",
      "url": "https://<your-worker>.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

---

### Error Code Reference

#### MCP Protocol Errors (JSON-RPC Standard)

These errors are returned within the JSON-RPC response body for MCP operation failures.

| Code   | Name           | Meaning                                          | Resolution                                              |
| :----- | :------------- | :----------------------------------------------- | :------------------------------------------------------ |
| -32700 | Parse error    | Invalid JSON syntax in the request.              | Validate JSON structure before submission.              |
| -32600 | Invalid request| Valid JSON, but not a valid JSON-RPC 2.0 request. | Ensure `jsonrpc`, `id`, and `method` fields are present. |
| -32601 | Method not found| The requested MCP method does not exist.         | Verify the method name (e.g., `tools/list`, `tools/call`). |
| -32602 | Invalid params | Method arguments are incorrect or missing.         | Consult the tool's input schema for required fields.    |
| -32603 | Internal error | Unexpected server-side error during processing.  | Examine Worker logs for the root cause exception.       |
| -32000 | Server error   | Generic server-defined error.                    | Review `message` and `data` fields for specifics.       |

#### MCP Tool Call Errors

These manifest as `content[].type === "error"` within a successful `tools/call` response.

| Scenario                     | Observed Output                      | Resolution                                             |
| :--------------------------- | :----------------------------------- | :----------------------------------------------------- |
| Tool name non-existent       | `Unknown tool: <name>`               | Confirm the tool name matches the `tools/list` output. |
| Missing required argument    | Validation error on required field.  | Include all fields designated as `required`.           |
| Tool exception               | Error message from tool handler.     | Debug the tool handler logic; review Worker logs.      |
| Input schema validation failure| JSON Schema validation error.        | Align arguments with the tool's defined schema.        |

#### Runtime Errors (Client-Facing Error Pages)

These occur when a Worker fails to produce a response.

| Code  | Meaning                                                 | Resolution                                                                 |
| :---- | :------------------------------------------------------ | :------------------------------------------------------------------------- |
| 1019  | Worker recursive call limit exceeded.                   | Prevent circular Worker-to-Worker invocations.                             |
| 1021  | Worker attempted to access unauthorized host.           | Verify `fetch()` targets and allowed outbound hosts.                       |
| 1022  | Cloudflare request routing failure to Worker.           | Temporary issue; attempt retry or check [cloudflarestatus.com](https://www.cloudflarestatus.com). |
| 1024  | Worker fetched a Cloudflare-owned IP.                   | Avoid direct fetching of Cloudflare infrastructure IP addresses.           |
| 1027  | Worker exceeded daily request limit.                    | Wait for reset or upgrade to a paid plan.                                  |
| 1042  | Cross-Zone Worker fetch requires compatibility flag.    | Add the `global_fetch_strictly_public` compatibility flag.                 |
| 1101  | Unhandled JavaScript exception in Worker.               | Address uncaught errors, Promises, or unclosed WebSockets.                 |
| 1102  | Worker exceeded CPU time limit.                         | Optimize handler or delegate intensive tasks to an external API.           |
| 1103  | Account-level issue requiring Cloudflare Support.       | Contact [Cloudflare Support](https://developers.cloudflare.com/support/contacting-cloudflare-support/). |
| 10162 | Unsupported Content-Type for module.                    | Verify Worker module format and associated headers.                        |
| 11xx  | Other internal Workers runtime error.                   | Check [cloudflarestatus.com](https://www.cloudflarestatus.com) for incidents. |

#### Upload / Deploy Errors (Dashboard/CLI)

These errors occur during the Worker upload or deployment process.

| Code  | Meaning                                    | Resolution                                                         |
| :---- | :----------------------------------------- | :----------------------------------------------------------------- |
| 10006 | Worker code parsing failure.               | Correct syntax errors in `worker.js`.                              |
| 10007 | Worker or workers.dev subdomain not found. | Verify the Worker name and subdomain status.                       |
| 10015 | Account not entitled to use Workers.       | Confirm your Cloudflare account plan.                              |
| 10016 | Invalid Worker name.                       | Use alphanumeric characters and hyphens only.                      |
| 10021 | Startup validation error (CPU/memory).     | Initialize heavy tasks within the request handler, not top-level.  |
| 10026 | Request body parsing failure.              | Ensure the deploy request body is valid JSON.                      |
| 10027 | Script size limit exceeded.                | Reduce script size or partition into multiple Workers.             |
| 10035 | Concurrent deployment conflict.            | Wait for the prior deployment to complete.                         |
| 10037 | Maximum Worker count exceeded.             | Remove unused Workers or upgrade your plan.                        |
| 10052 | Binding uploaded without a name.           | Assign a unique name to each binding in the dashboard or `wrangler.toml`. |
| 10054 | Environment variable/secret size limit.    | Shorten values or utilize KV/R2 for large data.                    |
| 10055 | Excessive environment variables/secrets.   | Consolidate or remove unused variables.                            |
| 10056 | Binding not found.                         | Verify binding existence and naming.                               |
| 10068 | No event handlers registered.              | Include a `fetch` handler (e.g., `export default { fetch(req) { … } }`). |
| 10069 | Unsupported event handlers in Worker.      | Replace or remove unsupported handlers.                            |

#### Runtime Errors (Internal - Logs Only)

These errors are visible solely within **Workers Logs** and do not generate user-facing error pages.

| Message                  | Meaning                                       | Resolution                                          |
| :----------------------- | :-------------------------------------------- | :-------------------------------------------------- |
| `Network connection lost`| `fetch()` or binding call connection failure. | Implement `try/catch` blocks and retry mechanisms.  |
| `Memory limit would be exceeded before EOF` | Stream/buffer read exceeds 128 MB limit. | Stream data in smaller segments.                    |
| `daemonDown`             | Temporary internal Worker invocation issue.   | Retry the request; typically self-resolves.         |

#### Common HTTP Status Errors (Cloudflare Proxy)

| Status | Meaning                                     |
| :----- | :------------------------------------------ |
| 400    | Bad request (origin/Worker rejected input). |
| 403    | Blocked by Cloudflare security rule.        |
| 404    | Worker route or Worker not found.           |
| 409    | DNS conflict (underlying 1xxx error).       |
| 429    | Rate limited.                               |
| 500    | Unhandled Worker exception.                 |
| 502    | Worker failed to connect to upstream.       |
| 504    | Worker or upstream timeout.                 |
| 530    | Cloudflare-generated error (see body).      |

---

### Troubleshooting Guidance

**Tools not appearing in Claude Desktop:**
*   Ensure the worker URL correctly appends `/mcp`.
*   Restart Claude Desktop after configuration updates.
*   Review the Worker's **Logs** tab in the Cloudflare Dashboard for diagnostics.

**Encountering Error 1101:**
*   Investigate unhandled Promise rejections or missing `await` in asynchronous functions.
*   Verify that all execution paths return a `Response` object.

**Receiving Error 1102:**
*   Your handler's CPU execution time exceeds the 10 ms limit.
*   Relocate computationally intensive operations to an external API.

**Experiencing MCP `-32602` errors:**
*   A required argument is either missing or of an incorrect type. Refer to the tool's input schema via `tools/list`.

**CORS policy violations:**
*   The Worker must include `Access-Control-Allow-Origin` headers.
*   Implement handling for `OPTIONS` preflight requests, returning appropriate headers and a `200` status.

---

### Supplementary Resources

*   [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
*   [Cloudflare Workers Errors Reference](https://developers.cloudflare.com/workers/observability/errors/)
*   [Model Context Protocol Specification](https://modelcontextprotocol.io/)
*   [Cloudflare Remote MCP Server Guide](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
*   [Hoppscotch - Browser REST Client](https://hoppscotch.io)
*   [MCP Inspector](https://inspector.tools.mcp.run/)

---

Document by Claude & ChatGPT
