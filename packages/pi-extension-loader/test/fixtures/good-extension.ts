export default function (pi: any) {
  pi.registerTool({
    name: "test_tool_1",
    description: "A test tool",
    parameters: { type: "object", properties: { input: { type: "string" } } },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      return { content: [{ type: "text", text: `executed: ${JSON.stringify(params)}` }], details: {} };
    },
  });

  pi.registerTool({
    name: "test_tool_2",
    description: "Another test tool",
    execute: async () => {
      return { content: [{ type: "text", text: "ok" }], details: {} };
    },
  });
}
