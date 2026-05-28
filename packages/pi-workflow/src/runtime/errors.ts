/** 当工作流节点需要等待用户/外部输入时抛出的错误，用于暂停执行流程 */
export class AwaitInputError extends Error {
  /**
   * @param message - 错误描述
   * @param nodeInput - 暂停时节点的输入数据
   * @param pausedNodeId - 被暂停的节点 ID（可选）
   */
  constructor(
    message: string,
    public readonly nodeInput: Readonly<Record<string, unknown>>,
    public readonly pausedNodeId?: string,
  ) {
    super(message);
    this.name = "AwaitInputError";
  }
}
