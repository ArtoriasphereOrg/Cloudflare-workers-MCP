const ALLOWED_ORIGINS = ["*"];
const API_KEY = "";
const CONFIG = {
  SERVER_NAME: "cloudflare-mcp-worker",
  SERVER_VERSION: "1.0.1",
  SERVER_INSTRUCTIONS:
    "Example MCP server template. Exposes a few demo tools (echo, get_time, calculate). Add your own tools in the TOOLS array in src/tools.js. from Artoriasphere",
  PROTOCOL_VERSION: "2026-07-28",
  LEGACY_PROTOCOL_VERSIONS: ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"],
  DISCOVER_TTL_MS: 3600000,
  TOOLS_LIST_TTL_MS: 300000,
  CACHE_SCOPE: "public",
};
const SUPPORTED_PROTOCOL_VERSIONS = [CONFIG.PROTOCOL_VERSION];
const SERVER_INFO = {
  name: CONFIG.SERVER_NAME,
  version: CONFIG.SERVER_VERSION,
};
const META = {
  PROTOCOL_VERSION: "protocolVersion",
  CLIENT_INFO: "clientInfo",
  CLIENT_CAPABILITIES: "clientCapabilities",
  SERVER_INFO: "serverInfo",
};
const ERR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  HEADER_MISMATCH: -32020,
  MISSING_CLIENT_CAPABILITY: -32021,
  UNSUPPORTED_PROTOCOL_VERSION: -32022,
};

function rpcResultNew(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resultType: "complete",
      ...result,
      _meta: {
        [META.SERVER_INFO]: SERVER_INFO,
        ...(result._meta || {}),
      },
    },
  };
}

function rpcResultLegacy(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  const response = { jsonrpc: "2.0", error };
  if (id !== undefined) response.id = id;
  return response;
}

class RpcErrorSignal extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(body, status, extraHeaders) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...(extraHeaders || {}),
    },
  });
}

function decodeHeaderValue(value) {
  if (typeof value !== "string") return value;
  const match = /^=\?base64\?([A-Za-z0-9+/=]+)\?=$/.exec(value);
  if (!match) return value;
  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

function evaluateArithmetic(expr) {
  if (expr.length === 0) throw new Error("expression is empty");
  if (expr.length > 200) throw new Error("expression is too long");
  let pos = 0;
  const peek = () => expr[pos];
  const skipSpace = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };

  function parseExpression() {
    skipSpace();
    let value = parseTerm();
    for (;;) {
      skipSpace();
      const op = peek();
      if (op === "+" || op === "-") {
        pos++;
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      } else break;
    }
    return value;
  }

  function parseTerm() {
    skipSpace();
    let value = parseFactor();
    for (;;) {
      skipSpace();
      const op = peek();
      if (op === "*" || op === "/") {
        pos++;
        const rhs = parseFactor();
        if (op === "/") {
          if (rhs === 0) throw new Error("division by zero");
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      } else break;
    }
    return value;
  }

  function parseFactor() {
    skipSpace();
    if (peek() === "+") { pos++; return parseFactor(); }
    if (peek() === "-") { pos++; return -parseFactor(); }
    if (peek() === "(") {
      pos++;
      const value = parseExpression();
      skipSpace();
      if (peek() !== ")") throw new Error("expected closing parenthesis");
      pos++;
      return value;
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    if (pos === start) {
      throw new Error(`unexpected character '${peek() ?? "end of input"}' at position ${pos}`);
    }
    const numStr = expr.slice(start, pos);
    const num = Number(numStr);
    if (Number.isNaN(num)) throw new Error(`invalid number '${numStr}'`);
    return num;
  }

  const result = parseExpression();
  skipSpace();
  if (pos !== expr.length) {
    throw new Error(`unexpected character '${peek()}' at position ${pos}`);
  }
  if (!Number.isFinite(result)) throw new Error("result is not a finite number");
  return result;
}

function toolText(text) {
  return { content: [{ type: "text", text }], isError: false };
}

function toolError(text) {
  return { content: [{ type: "text", text }], isError: true };
}

const TOOLS = [
  {
    name: "echo",
    description: "Echoes back whatever message you send it. Useful for testing the connection.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Text to echo back" },
      },
      required: ["message"],
      additionalProperties: false,
    },
    handler: async (args) => {
      if (typeof args.message !== "string") return toolError("`message` must be a string.");
      return toolText(args.message);
    },
  },
  {
    name: "get_time",
    description: "Returns the current date and time in UTC (ISO 8601).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
    },
    handler: async () => toolText(new Date().toISOString()),
  },
  {
    name: "calculate",
    description:
      'Evaluates a basic arithmetic expression using +, -, *, /, and parentheses. Example: "(3 + 4) * 2".',
    inputSchema: {
      type: "object",
      properties: {
        expression: { type: "string", description: 'e.g. "(3 + 4) * 2"' },
      },
      required: ["expression"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: { result: { type: "number" } },
      required: ["result"],
    },
    handler: async (args) => {
      if (typeof args.expression !== "string") return toolError("`expression` must be a string.");
      try {
        const result = evaluateArithmetic(args.expression);
        return {
          content: [{ type: "text", text: String(result) }],
          structuredContent: { result },
          isError: false,
        };
      } catch (err) {
        return toolError(`Could not evaluate expression: ${err.message}`);
      }
    },
  },
];

function buildToolsList() {
  return TOOLS.map(({ name, description, inputSchema, outputSchema }) => ({
    name,
    description,
    inputSchema,
    ...(outputSchema ? { outputSchema } : {}),
  }));
}

async function dispatchToolCall(params) {
  const name = params?.name;
  const args = params?.arguments ?? {};
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new RpcErrorSignal(ERR.INVALID_PARAMS, `Unknown tool: ${name}`);
  try {
    const result = await tool.handler(args);
    return {
      content: result.content,
      ...(result.structuredContent !== undefined
        ? { structuredContent: result.structuredContent }
        : {}),
      isError: Boolean(result.isError),
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Tool "${name}" threw an error: ${err.message}` }],
      isError: true,
    };
  }
}

function handleDiscover() {
  return {
    supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
    capabilities: { tools: { listChanged: false } },
    instructions: CONFIG.SERVER_INSTRUCTIONS,
    ttlMs: CONFIG.DISCOVER_TTL_MS,
    cacheScope: CONFIG.CACHE_SCOPE,
  };
}

function handleToolsList() {
  return {
    tools: buildToolsList(),
    ttlMs: CONFIG.TOOLS_LIST_TTL_MS,
    cacheScope: CONFIG.CACHE_SCOPE,
  };
}

function handleLegacyInitialize(params) {
  const requestedVersion = params?.protocolVersion;
  const negotiated = CONFIG.LEGACY_PROTOCOL_VERSIONS.includes(requestedVersion)
    ? requestedVersion
    : CONFIG.LEGACY_PROTOCOL_VERSIONS[0];
  return {
    protocolVersion: negotiated,
    capabilities: { tools: { listChanged: false } },
    serverInfo: SERVER_INFO,
    instructions: CONFIG.SERVER_INSTRUCTIONS,
  };
}

async function handleLegacyMcpPost(request, body) {
  const { id, method, params } = body;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize":
        if (isNotification) return new Response(null, { status: 202, headers: corsHeaders() });
        return jsonResponse(rpcResultLegacy(id, handleLegacyInitialize(params)), 200);

      case "notifications/initialized":
        return new Response(null, { status: 202, headers: corsHeaders() });

      case "ping":
        if (isNotification) return new Response(null, { status: 202, headers: corsHeaders() });
        return jsonResponse(rpcResultLegacy(id, {}), 200);

      case "tools/list":
        if (isNotification) return new Response(null, { status: 202, headers: corsHeaders() });
        return jsonResponse(rpcResultLegacy(id, handleToolsList()), 200);

      case "tools/call": {
        if (isNotification) return new Response(null, { status: 202, headers: corsHeaders() });
        const result = await dispatchToolCall(params);
        return jsonResponse(rpcResultLegacy(id, result), 200);
      }

      default:
        if (isNotification) return new Response(null, { status: 202, headers: corsHeaders() });
        return jsonResponse(rpcError(id, ERR.METHOD_NOT_FOUND, `Method not found: ${method}`), 404);
    }
  } catch (err) {
    if (err instanceof RpcErrorSignal) {
      return jsonResponse(rpcError(id, err.code, err.message, err.data), 400);
    }
    return jsonResponse(rpcError(id, ERR.INTERNAL_ERROR, `Internal error: ${err.message}`), 500);
  }
}

async function handleNewMcpPost(request, body) {
  const { id, method, params } = body;

  if (id === undefined || id === null) {
    return jsonResponse(
      rpcError(id, ERR.INVALID_REQUEST, "Invalid Request: 2026-07-28 requests must include an id"),
      400
    );
  }

  const meta = params?._meta ?? {};
  const clientProtocolVersion = meta[META.PROTOCOL_VERSION];

  const headerProtocolVersion = request.headers.get("MCP-Protocol-Version");
  const headerMethod = request.headers.get("Mcp-Method");
  const headerNameRaw = request.headers.get("Mcp-Name");
  const headerName = headerNameRaw !== null ? decodeHeaderValue(headerNameRaw) : null;

  if (!headerProtocolVersion || headerProtocolVersion !== clientProtocolVersion) {
    return jsonResponse(
      rpcError(
        id,
        ERR.HEADER_MISMATCH,
        "Header mismatch: MCP-Protocol-Version header is missing or does not match _meta protocolVersion in the body"
      ),
      400
    );
  }

  if (!headerMethod || headerMethod !== method) {
    return jsonResponse(
      rpcError(
        id,
        ERR.HEADER_MISMATCH,
        "Header mismatch: Mcp-Method header is missing or does not match the body's method"
      ),
      400
    );
  }

  const methodsRequiringName = new Set(["tools/call"]);
  if (methodsRequiringName.has(method)) {
    const bodyName = params?.name;
    if (!headerNameRaw || headerName !== bodyName) {
      return jsonResponse(
        rpcError(
          id,
          ERR.HEADER_MISMATCH,
          "Header mismatch: Mcp-Name header is missing or does not match params.name in the body"
        ),
        400
      );
    }
  }

  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(clientProtocolVersion)) {
    return jsonResponse(
      rpcError(
        id,
        ERR.UNSUPPORTED_PROTOCOL_VERSION,
        `Unsupported protocol version: ${clientProtocolVersion}`,
        { supported: SUPPORTED_PROTOCOL_VERSIONS }
      ),
      400
    );
  }

  try {
    switch (method) {
      case "server/discover":
        return jsonResponse(rpcResultNew(id, handleDiscover()), 200);

      case "tools/list":
        return jsonResponse(rpcResultNew(id, handleToolsList()), 200);

      case "tools/call": {
        const result = await dispatchToolCall(params);
        return jsonResponse(rpcResultNew(id, result), 200);
      }

      default:
        return jsonResponse(rpcError(id, ERR.METHOD_NOT_FOUND, `Method not found: ${method}`), 404);
    }
  } catch (err) {
    if (err instanceof RpcErrorSignal) {
      return jsonResponse(rpcError(id, err.code, err.message, err.data), 400);
    }
    return jsonResponse(rpcError(id, ERR.INTERNAL_ERROR, `Internal error: ${err.message}`), 500);
  }
}

async function handleMcpPost(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(rpcError(undefined, ERR.PARSE_ERROR, "Parse error: invalid JSON"), 400);
  }

  if (Array.isArray(body) || typeof body !== "object" || body === null) {
    return jsonResponse(
      rpcError(
        undefined,
        ERR.INVALID_REQUEST,
        "Invalid Request: body must be a single JSON-RPC request object"
      ),
      400
    );
  }

  const { jsonrpc, method } = body;
  if (jsonrpc !== "2.0" || typeof method !== "string") {
    return jsonResponse(
      rpcError(
        body.id,
        ERR.INVALID_REQUEST,
        "Invalid Request: expected a JSON-RPC 2.0 request with jsonrpc and method"
      ),
      400
    );
  }

  const meta = body.params?._meta ?? {};
  const hasNewMeta =
    typeof meta[META.PROTOCOL_VERSION] === "string" &&
    typeof meta[META.CLIENT_CAPABILITIES] === "object" &&
    meta[META.CLIENT_CAPABILITIES] !== null;

  return hasNewMeta ? handleNewMcpPost(request, body) : handleLegacyMcpPost(request, body);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname !== "/mcp") {
      return jsonResponse(rpcError(undefined, ERR.METHOD_NOT_FOUND, "Not found"), 404);
    }

    if (request.method === "GET" || request.method === "DELETE") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }

    const origin = request.headers.get("Origin");
    if (origin && ALLOWED_ORIGINS.length > 0) {
      if (!ALLOWED_ORIGINS.includes("*") && !ALLOWED_ORIGINS.includes(origin)) {
        return jsonResponse(rpcError(undefined, ERR.INVALID_REQUEST, "Forbidden origin"), 403);
      }
    }

    if (API_KEY) {
      const authHeader = request.headers.get("Authorization") || "";
      if (authHeader !== `Bearer ${API_KEY}`) {
        return jsonResponse(rpcError(undefined, ERR.INVALID_REQUEST, "Unauthorized"), 401);
      }
    }

    return handleMcpPost(request);
  },
};
