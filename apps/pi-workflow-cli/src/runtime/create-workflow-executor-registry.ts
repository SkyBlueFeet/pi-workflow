import {
  AgentExecutor,
  AssignExecutor,
  CodeExecutor,
  DelayExecutor,
  ExecutorRegistry,
  ExtractorExecutor,
  HttpExecutor,
  ListOpExecutor,
  ManualExecutor,
  MergeExecutor,
  ReturnExecutor,
  TemplateExecutor,
  ToolExecutor,
  UnsupportedExecutor,
} from "@pi-workflow/core";

/** 统一创建 workflow CLI 使用的执行器注册表，保证 run 与 resume 能力集一致。 */
export function createWorkflowExecutorRegistry(): ExecutorRegistry {
  const registry = new ExecutorRegistry();
  registry.register("manual", new ManualExecutor((input) => input));
  registry.register("return", new ReturnExecutor());
  registry.register("agent", new AgentExecutor());
  registry.register("tool", new ToolExecutor());
  registry.register("http", new HttpExecutor());
  registry.register("extractor", new ExtractorExecutor());
  registry.register("template", new TemplateExecutor());
  registry.register("assign", new AssignExecutor());
  registry.register("merge", new MergeExecutor());
  registry.register("code", new CodeExecutor());
  registry.register("delay", new DelayExecutor());
  registry.register("list-op", new ListOpExecutor());
  registry.registerFallback(new UnsupportedExecutor());
  return registry;
}
