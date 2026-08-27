import { SERVER_INFO, META } from "./config.js";
export function rpcResultNew(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resultType: "complete",
      ...result,
      _meta: {
        [META.SERVER_INFO]: SERVER_INFO,
        ...(result._meta || {})
      }
    }
  };
}
export function rpcResultLegacy(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}
export function rpcError(id, code, message, data) {
  const error = {
    code,
    message
  };
  if (data !== undefined) error.data = data;
  const response = {
    jsonrpc: "2.0",
    error
  };
  if (id !== undefined) response.id = id;
  return response;
}
export class RpcErrorSignal extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}
export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400"
  };
}
export function jsonResponse(body, status, extraHeaders) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...(extraHeaders || {})
    }
  });
}
export function decodeHeaderValue(value) {
  if (typeof value !== "string") return value;
  const match = /^=\?base64\?([A-Za-z0-9+/=]+)\?=$/.exec(value);
  if (!match) return value;
  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}
