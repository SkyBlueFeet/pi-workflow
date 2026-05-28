import type {
  WorkflowAuthoringHost,
  WorkflowDraftRequest,
  WorkflowDraftResult,
  WorkflowAuthoringHostEvent,
} from "./types.js";

export { WorkflowAuthoringHost, WorkflowDraftRequest, WorkflowDraftResult, WorkflowAuthoringHostEvent };

/**
 * 基于 WorkflowAuthoringHost 生成 DSL 草案。
 * 消费 AsyncGenerator 并返回最终的 WorkflowDraftResult。
 */
export class WorkflowDraftGenerator {
  constructor(private readonly authoringHost: WorkflowAuthoringHost) {}

  /**
   * 生成草案，消费所有中间事件并返回最终结果。
   *
   * @param request 草案请求
   * @returns 草案结果
   */
  async generate(request: WorkflowDraftRequest): Promise<WorkflowDraftResult> {
    const iterator = this.authoringHost.generateDraft(request);

    let result: WorkflowDraftResult | undefined;
    let done = false;

    while (!done) {
      const next = await iterator.next();
      done = next.done ?? false;

      if (done && next.value !== undefined) {
        result = next.value as WorkflowDraftResult;
      }
    }

    if (!result) {
      throw new Error("Draft generation produced no result");
    }

    return result;
  }
}

/**
 * 便捷函数：生成 workflow DSL 草案。
 *
 * @param authoringHost 创作主机
 * @param request 草案请求
 * @returns 草案结果
 */
export async function generateWorkflowDraft(
  authoringHost: WorkflowAuthoringHost,
  request: WorkflowDraftRequest,
): Promise<WorkflowDraftResult> {
  return new WorkflowDraftGenerator(authoringHost).generate(request);
}
