import { AgentRegistry, createRegistryFromConfig, CustomAgentInvoker } from "../src/index.js";
import { MockPiHostAdapter } from "../src/adapters/pi/pi-mock-host.js";
import type { WorkflowConfig } from "../src/config/types.js";

async function main() {
  console.log("=== PI Agent Smoke Test ===\n");

  // 1. Registry: load from config
  const config: WorkflowConfig = {
    model: { provider: "openai", model: "gpt-4o-mini" },
    agents: {
      writer: {
        name: "Writer Agent",
        description: "Writing assistant",
        systemPrompt: "You are a professional writer.",
        model: { provider: "anthropic", model: "claude-3-7-sonnet" },
        temperature: 0.4,
        maxTokens: 4096,
        skills: [{ name: "outline", source: "@pi/writing" }],
        mcp: [{ server: "ctx7" }],
      },
    },
  };

  const registry = createRegistryFromConfig(config);
  console.log(`Registry agents: ${registry.list().length}`);
  console.log(`Has writer: ${registry.has("writer")}`);

  const def = registry.get("writer");
  console.log(`Agent name: ${def?.name}`);
  console.log(`System prompt: ${def?.systemPrompt?.slice(0, 40)}...`);

  // 2. Invoker with mock host
  const mockHost = new MockPiHostAdapter();
  mockHost.setResponse("writer", "Hello from independent custom agent!");

  const invoker = new CustomAgentInvoker({ host: mockHost, registry, config });

  console.log("\n--- Invoking custom agent ---");
  const gen = invoker.invoke({
    agentId: "writer",
    prompt: "Write a short paragraph.",
  });

  let content = "";
  for await (const event of gen) {
    if (event.type === "agent.text_delta") {
      content += event.delta;
      process.stdout.write(event.delta);
    }
  }
  console.log("\n");

  // 3. Verify result
  if (content.includes("Hello from independent custom agent")) {
    console.log("✓ Smoke test passed: custom agent invoked successfully");
  } else {
    console.log(`✗ Smoke test failed: unexpected output: ${content}`);
    process.exit(1);
  }

  // 4. Test non-existent agent
  console.log("\n--- Testing non-existent agent ---");
  const badGen = invoker.invoke({ agentId: "nonexistent", prompt: "test" });
  for await (const event of badGen) {
    if (event.type === "agent.error") {
      console.log(`✓ Correctly handled non-existent agent: ${event.error}`);
    }
  }

  console.log("\n=== Smoke test complete ===");
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
