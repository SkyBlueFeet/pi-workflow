/**
 * @deprecated If 节点的实际实现在 WorkflowRuntime.executeIfComposite 中。
 * 自定义 if 逻辑请通过 executorRegistry.registerComposite("if", myExecutor) 注册。
 */
export class IfExecutor {}
