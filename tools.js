import { evaluateArithmetic } from "./arithmetic.js";
import { RpcErrorSignal } from "./rpc.js";
import { ERR } from "./config.js";

function toolText(text) {
  return { content: [{ type: "text", text }], isError: false };
}

function toolError(text) {
  return { content: [{ type: "text", text }], isError: true };
}

export const TOOLS = [
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
      "Evaluates a basic arithmetic expression using +, -, *, /, and parentheses. " +
      'Example: "(3 + 4) * 2".',
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

export function buildToolsList() {
  return TOOLS.map(({ name, description, inputSchema, outputSchema }) => ({
    name,
    description,
    inputSchema,
    ...(outputSchema ? { outputSchema } : {}),
  }));
}

export async function dispatchToolCall(params) {
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
