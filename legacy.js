import { ERR } from "./config.js";
import { rpcResultLegacy, rpcError, RpcErrorSignal, corsHeaders, jsonResponse } from "./rpc.js";
import { handleLegacyInitialize, handleToolsList, dispatchToolCall } from "./handlers.js";

export async function handleLegacyMcpPost(request, body) {
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
