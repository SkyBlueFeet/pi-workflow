import { beforeEach, describe, expect, it, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  FileWorkflowRunStore: vi.fn(),
  WorkflowRuntime: vi.fn(),
  loadWorkflowConfigFile: vi.fn(),
}));

const hostMocks = vi.hoisted(() => ({
  createWorkflowHost: vi.fn(),
}));

const registryMocks = vi.hoisted(() => ({
  createWorkflowExecutorRegistry: vi.fn(),
}));

vi.mock("@pi-workflow/core", () => ({
  FileWorkflowRunStore: coreMocks.FileWorkflowRunStore,
  WorkflowRuntime: coreMocks.WorkflowRuntime,
  loadWorkflowConfigFile: coreMocks.loadWorkflowConfigFile,
}));

vi.mock("../src/runtime/create-workflow-host.js", () => ({
  createWorkflowHost: hostMocks.createWorkflowHost,
}));

vi.mock("../src/runtime/create-workflow-executor-registry.js", () => ({
  createWorkflowExecutorRegistry: registryMocks.createWorkflowExecutorRegistry,
}));

describe("createWorkflowRuntimeContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["PI_WORKFLOW_DEFAULT_MODEL"];
    coreMocks.FileWorkflowRunStore.mockImplementation(() => ({}));
    coreMocks.WorkflowRuntime.mockImplementation(() => ({ run: vi.fn() }));
    registryMocks.createWorkflowExecutorRegistry.mockReturnValue({});
    hostMocks.createWorkflowHost.mockResolvedValue({
      host: {},
      config: undefined,
      metadata: {
        isMock: false,
        scannedExtensions: false,
        registeredToolCount: 0,
      },
    });
  });

  it("未传 --config 时从 .env 注入默认模型", async () => {
    const { createWorkflowRuntimeContext } = await import("../src/runtime/create-workflow-runtime-context.js");
    process.env["PI_WORKFLOW_DEFAULT_MODEL"] = "deepseek/deepseek-v4-flash";

    await createWorkflowRuntimeContext({
      ir: {
        id: "wf",
        version: "1",
        title: "wf",
        entryNodeIds: ["agent1"],
        nodes: [{ id: "agent1", title: "Agent", kind: "agent", dependsOn: [], inputBindings: {} }],
        edges: [],
      },
      isMock: false,
      scanExtensions: false,
      yolo: false,
      debug: false,
    });

    expect(hostMocks.createWorkflowHost).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        model: {
          provider: "deepseek",
          model: "deepseek-v4-flash",
        },
      }),
    }));
  });

  it("配置文件已显式指定模型时不被 .env 覆盖", async () => {
    const { createWorkflowRuntimeContext } = await import("../src/runtime/create-workflow-runtime-context.js");
    process.env["PI_WORKFLOW_DEFAULT_MODEL"] = "deepseek/deepseek-v4-flash";
    coreMocks.loadWorkflowConfigFile.mockReturnValue({
      config: {
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
        },
      },
      baseDir: "E:/coder/pi-workflow",
    });

    await createWorkflowRuntimeContext({
      ir: {
        id: "wf",
        version: "1",
        title: "wf",
        entryNodeIds: ["agent1"],
        nodes: [{ id: "agent1", title: "Agent", kind: "agent", dependsOn: [], inputBindings: {} }],
        edges: [],
      },
      configPath: "workflow.toml",
      isMock: false,
      scanExtensions: false,
      yolo: false,
      debug: false,
    });

    expect(hostMocks.createWorkflowHost).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        model: {
          provider: "openai",
          model: "gpt-4o-mini",
        },
      }),
    }));
  });
});
