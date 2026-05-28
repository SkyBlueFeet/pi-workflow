/**
 * @deprecated Parallel 节点的实际实现在 WorkflowRuntime.executeParallelComposite 中。
 * 自定义 parallel 逻辑请通过 executorRegistry.registerComposite("parallel", myExecutor) 注册。
 */
export class ParallelExecutor {}
