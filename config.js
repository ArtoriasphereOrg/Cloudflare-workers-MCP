export const ALLOWED_ORIGINS = ["*"];
export const API_KEY = "";
export const CONFIG = {
  SERVER_NAME: "cloudflare-mcp-worker",
  SERVER_VERSION: "1.0.1",
  SERVER_INSTRUCTIONS: "Example MCP server template. Exposes a few demo tools (echo, get_time, calculate). Add your own tools in the TOOLS array in src/tools.js. from Artoriasphere",
  PROTOCOL_VERSION: "2026-07-28",
  LEGACY_PROTOCOL_VERSIONS: ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"],
  DISCOVER_TTL_MS: 3600000,
  TOOLS_LIST_TTL_MS: 300000,
  CACHE_SCOPE: "public"
};
export const SUPPORTED_PROTOCOL_VERSIONS = [CONFIG.PROTOCOL_VERSION];
export const SERVER_INFO = {
  name: CONFIG.SERVER_NAME,
  version: CONFIG.SERVER_VERSION
};
export const META = {
  PROTOCOL_VERSION: "protocolVersion",
  CLIENT_INFO: "clientInfo",
  CLIENT_CAPABILITIES: "clientCapabilities",
  SERVER_INFO: "serverInfo"
};
export const ERR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  HEADER_MISMATCH: -32020,
  MISSING_CLIENT_CAPABILITY: -32021,
  UNSUPPORTED_PROTOCOL_VERSION: -32022
};
