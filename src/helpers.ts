type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export function nullableJsonResult(
  data: unknown,
  notFoundMessage: string
): ToolResult {
  if (data === null || data === undefined) {
    return errorResult(notFoundMessage);
  }
  return jsonResult(data);
}

export async function safeHandler<T>(
  errorPrefix: string,
  fn: () => Promise<T>
): Promise<ToolResult> {
  try {
    const data = await fn();
    return jsonResult(data);
  } catch (error) {
    return errorResult(`${errorPrefix}: ${error}`);
  }
}
