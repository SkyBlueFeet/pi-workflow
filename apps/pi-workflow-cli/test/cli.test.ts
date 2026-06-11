import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.hoisted(() => vi.fn());

vi.mock("../src/env.js", () => ({
  loadCliEnvFiles: vi.fn(),
}));

vi.mock("../src/commands/run.js", async () => {
  const actual = await vi.importActual<typeof import("../src/commands/run.js")>("../src/commands/run.js");
  return {
    ...actual,
    runCommand: runCommandMock,
  };
});

vi.mock("../src/commands/resume.js", () => ({
  resumeCommand: vi.fn(),
}));

vi.mock("../src/commands/trace.js", () => ({
  traceCommand: vi.fn(),
}));

vi.mock("../src/commands/inspect.js", () => ({
  inspectCommand: vi.fn(),
}));

vi.mock("../src/commands/pkg.js", () => ({
  pkgCommand: vi.fn(),
}));

vi.mock("../src/commands/agent.js", () => ({
  agentCommand: vi.fn(),
}));

vi.mock("../src/commands/policy.js", () => ({
  policyCommand: vi.fn(),
}));

vi.mock("../src/commands/build.js", () => ({
  buildCommand: vi.fn(),
}));

describe("cli main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  it("run 命令抛出 RunCommandExit 时仅设置退出码，不输出未处理异常", async () => {
    const { RunCommandExit } = await import("../src/commands/run.js");
    const { executeCli } = await import("../src/cli.js");
    runCommandMock.mockRejectedValueOnce(new RunCommandExit(1));

    await expect(executeCli(["node", "cli.js", "run", "--json", "workflow.json"])).resolves.toBeUndefined();
    expect(process.exitCode).toBe(1);
  });
});
