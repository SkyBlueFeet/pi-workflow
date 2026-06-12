import { describe, expect, it, vi } from "vitest";
import { NodeExecutor } from "../../src/runtime/runtime-node-executor.js";
import { ExecutorRegistry } from "../../src/runtime/executor-registry.js";
import { ValueResolver } from "../../src/runtime/value-resolver.js";
import { Scheduler } from "../../src/runtime/scheduler.js";
import { Planner } from "../../src/runtime/planner.js";
import { ArtifactManager } from "../../src/artifacts/artifact-manager.js";
import { EventRecorder } from "../../src/events/recorder.js";
import { SecurityAuditor } from "../../src/security/auditor.js";

describe("NodeExecutor checkNodePermission", () => {
  it("以绑定后的宿主上下文调用 requestUserInput", async () => {
    const host = {
      tag: "host-instance",
      requestUserInput: vi.fn(function (this: { tag: string }) {
        if (this.tag !== "host-instance") {
          throw new Error("this 丢失");
        }
        return Promise.resolve({
          input: {
            approved: true,
            answer: "允许一次",
            selected: "允许一次",
          },
        });
      }),
    };

    const executor = new NodeExecutor({
      host,
      valueResolver: new ValueResolver(),
      scheduler: new Scheduler(new Planner()),
      executorRegistry: new ExecutorRegistry(),
      artifactManager: new ArtifactManager(),
      eventRecorder: new EventRecorder(),
      securityAuditor: new SecurityAuditor(),
      runtime: {} as never,
      executeCompositeNode: async function* () {},
    });

    const result = await executor.checkNodePermission(
      { id: "task-http", kind: "http", dependsOn: [], inputBindings: {} } as never,
      undefined,
      "run-1",
    );

    expect(result.allowed).toBe(true);
    expect(host.requestUserInput).toHaveBeenCalled();
  });
});
