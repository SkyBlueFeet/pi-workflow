/**
 * Agent 创作服务。
 *
 * 职责：
 * 1. 接收自然语言描述，生成 Agent 草稿
 * 2. 提供预览、校验、确认、落盘的完整链路
 * 3. 复用 packages/pi-workflow/src/agents/ 中的 registry / spec 能力
 */

/** Agent 草稿。 */
export interface AgentDraft {
  readonly draftId: string;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly skills: string[];
  readonly tools: string[];
  readonly status: "draft" | "validated" | "confirmed" | "rejected";
}

/** Agent 创作服务接口。 */
export interface AgentAuthoringService {
  /** 根据自然语言描述生成草稿。 */
  generateDraft(description: string): Promise<AgentDraft>;
  /** 校验草稿。 */
  validateDraft(draftId: string): Promise<{ valid: boolean; errors: string[] }>;
  /** 预览草稿。 */
  previewDraft(draftId: string): Promise<AgentDraft>;
  /** 确认并保存草稿。 */
  confirmDraft(draftId: string): Promise<string>;
}

/** Agent 创作服务骨架实现。 */
export class AgentAuthoringServiceImpl implements AgentAuthoringService {
  private readonly drafts = new Map<string, AgentDraft>();

  /**
   * 骨架实现：生成占位草稿。
   * 后续阶段接入真实的 AI 生成与 agent spec 注册。
   */
  async generateDraft(description: string): Promise<AgentDraft> {
    const draftId = `agent-draft-${Date.now()}`;
    const draft: AgentDraft = {
      draftId,
      name: `草稿Agent_${draftId}`,
      description,
      systemPrompt: `你是一个 AI 助手。${description}`,
      skills: [],
      tools: [],
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
    // 骨架：仅检查是否有 systemPrompt
    if (!draft.systemPrompt || draft.systemPrompt.trim().length === 0) {
      return { valid: false, errors: ["Agent 必须有 systemPrompt"] };
    }
    return { valid: true, errors: [] };
  }

  async previewDraft(draftId: string): Promise<AgentDraft> {
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
    // TODO: 接入真实的文件落盘流程
    return draftId;
  }
}
