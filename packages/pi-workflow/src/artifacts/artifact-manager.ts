import type { WorkflowArtifact } from "./types.js";

/** 转出物管理器，负责将工作流转出物按策略合并到共享上下文中。 */
export class ArtifactManager {
  /**
   * 将单个转出物按 targetPath 和 mergeStrategy 合并到共享上下文中。
   * targetPath 使用点分隔路径逐层创建中间对象。
   *
   * @param context 共享上下文对象（原地修改）
   * @param artifact 工作流转出物
   */
  merge(context: Record<string, unknown>, artifact: WorkflowArtifact): void {
    if (!artifact.targetPath) return;

    const keys = artifact.targetPath.split(".");
    let current = context;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    const strategy = artifact.mergeStrategy ?? "replace";

    switch (strategy) {
      case "replace":
        current[lastKey] = artifact.data;
        break;
      case "merge-object":
        if (typeof artifact.data === "object" && artifact.data !== null) {
          const existing = current[lastKey] as Record<string, unknown> ?? {};
          current[lastKey] = { ...existing, ...artifact.data as Record<string, unknown> };
        } else {
          current[lastKey] = artifact.data;
        }
        break;
      case "append-array":
        if (!Array.isArray(current[lastKey])) {
          current[lastKey] = [];
        }
        (current[lastKey] as unknown[]).push(artifact.data);
        break;
    }
  }

  /** 批量将多个转出物顺序合并到上下文中。 */
  mergeAll(context: Record<string, unknown>, artifacts: readonly WorkflowArtifact[]): void {
    for (const artifact of artifacts) {
      this.merge(context, artifact);
    }
  }
}
