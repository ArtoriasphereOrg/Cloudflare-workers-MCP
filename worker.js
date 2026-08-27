import { ERR, ALLOWED_ORIGINS, API_KEY } from "./config.js";
import { META } from "./config.js";
import { rpcError, corsHeaders, jsonResponse } from "./rpc.js";
import { handleLegacyMcpPost } from "./legacy.js";
import { handleNewMcpPost } from "./mcp.js";

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
