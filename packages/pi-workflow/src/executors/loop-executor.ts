/**
 * @deprecated Loop 节点的实际实现在 WorkflowRuntime.executeLoopComposite 中。
 * 自定义 loop 逻辑请通过 executorRegistry.registerComposite("loop", myExecutor) 注册。
 */
export class LoopExecutor {}
