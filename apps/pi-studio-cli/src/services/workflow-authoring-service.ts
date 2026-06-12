/**
 * Workflow 创作服务。
 *
 * 职责：
 * 1. 接收自然语言描述，生成 Workflow 草稿
 * 2. 提供预览、校验、确认、落盘的完整链路
 * 3. 复用 packages/pi-workflow/src/authoring/ 中的 draft / template / validator 能力
 */

/** Workflow 草稿。 */
export interface WorkflowDraft {
  readonly draftId: string;
  readonly name: string;
  readonly description: string;
  readonly nodes: WorkflowDraftNode[];
  readonly status: "draft" | "validated" | "confirmed" | "rejected";
}

/** 草稿中的节点。 */
export interface WorkflowDraftNode {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
}

/** Workflow 创作服务接口。 */
export interface WorkflowAuthoringService {
  /** 根据自然语言描述生成草稿。 */
  generateDraft(description: string): Promise<WorkflowDraft>;
  /** 校验草稿。 */
  validateDraft(draftId: string): Promise<{ valid: boolean; errors: string[] }>;
  /** 预览草稿（返回可展示的结构化数据）。 */
  previewDraft(draftId: string): Promise<WorkflowDraft>;
  /** 确认并保存草稿。 */
  confirmDraft(draftId: string): Promise<string>;
}

/** Workflow 创作服务骨架实现。 */
export class WorkflowAuthoringServiceImpl implements WorkflowAuthoringService {
  private readonly drafts = new Map<string, WorkflowDraft>();

  /**
   * 骨架实现：生成占位草稿。
   * 后续阶段接入真实的 AI 生成与 template 注册。
   */
  async generateDraft(description: string): Promise<WorkflowDraft> {
    const draftId = `wf-draft-${Date.now()}`;
    const draft: WorkflowDraft = {
      draftId,
      name: `草稿_${draftId}`,
      description,
      nodes: [
        { id: "start", title: "开始", kind: "start" },
        { id: "end", title: "结束", kind: "end" },
      ],
      status: "draft",
    };
    this.drafts.set(draftId, draft);
    return draft;
  }

  async validateDraft(draftId: string): Promise<{ valid: boolean; errors: string[] }> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      return { valid: false, errors: [`草稿 ${draftId} 不存在`] };
    }
    // 骨架：仅检查是否至少有两个节点
    if (draft.nodes.length < 2) {
      return { valid: false, errors: ["Workflow 至少需要两个节点"] };
    }
    return { valid: true, errors: [] };
  }

  async previewDraft(draftId: string): Promise<WorkflowDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`草稿 ${draftId} 不存在`);
    }
    return draft;
  }

  async confirmDraft(draftId: string): Promise<string> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`草稿 ${draftId} 不存在`);
    }
    draft.status as unknown as "confirmed";
    // TODO: 接入真实的文件落盘流程
    return draftId;
  }
}
