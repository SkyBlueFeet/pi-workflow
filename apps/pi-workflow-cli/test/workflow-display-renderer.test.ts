import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorkflowDisplayRenderer,
} from "../src/display/workflow-display-renderer.js";

describe("workflow display renderer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("progress 模式创建进度渲染器", () => {
    const renderer = createWorkflowDisplayRenderer("progress");
    expect(renderer.constructor.name).toBe("WorkflowProgressRenderer");
  });

  it("plain 模式创建逐行渲染器", () => {
    const renderer = createWorkflowDisplayRenderer("plain");
    expect(renderer.constructor.name).toBe("WorkflowTextRenderer");
  });
});
