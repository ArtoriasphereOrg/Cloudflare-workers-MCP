import { ERR, META, SUPPORTED_PROTOCOL_VERSIONS } from "./config.js";
import { rpcResultNew, rpcError, RpcErrorSignal, jsonResponse, decodeHeaderValue } from "./rpc.js";
import { handleDiscover, handleToolsList, dispatchToolCall } from "./handlers.js";

export async function handleNewMcpPost(request, body) {
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
