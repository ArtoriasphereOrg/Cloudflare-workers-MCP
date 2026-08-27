import { CONFIG, SERVER_INFO, SUPPORTED_PROTOCOL_VERSIONS } from "./config.js";
import { buildToolsList, dispatchToolCall } from "./tools.js";

export function handleDiscover() {
  return {
    supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
    capabilities: { tools: { listChanged: false } },
    instructions: CONFIG.SERVER_INSTRUCTIONS,
    ttlMs: CONFIG.DISCOVER_TTL_MS,
    cacheScope: CONFIG.CACHE_SCOPE,
  };
}

export function handleToolsList() {
  return {
    tools: buildToolsList(),
    ttlMs: CONFIG.TOOLS_LIST_TTL_MS,
    cacheScope: CONFIG.CACHE_SCOPE,
  };
}

export function handleLegacyInitialize(params) {
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

export { dispatchToolCall };
