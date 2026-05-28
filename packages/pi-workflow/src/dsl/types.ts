import type { WorkflowNodeKind, ValueRef } from "../ir/types.js";

/** 工作流 DSL 文档的顶层结构，对应一个 flow.json 或等价源文档。 */
export interface WorkflowDslDocument {
  readonly $schema?: string;
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly entry: string;
  readonly nodes: readonly WorkflowDslNode[];
  readonly defaults?: WorkflowDslDefaults;
  readonly resources?: WorkflowDslResources;
  readonly settings?: WorkflowDslSettings;
}

/** DSL 中值字段的类型：可以是原始字符串表达式，也可以是已解析的 ValueRef 对象。 */
export type DslValue = string | ValueRef;

/** 工作流 DAG 中的单个节点定义。 */
export interface WorkflowDslNode {
  readonly id: string;
  readonly title?: string;
  readonly dependsOn?: readonly string[];
  readonly inputs?: Readonly<Record<string, DslValue>>;
  readonly output?: WorkflowDslOutputBinding;
  readonly children?: readonly string[];
  readonly control?: WorkflowDslControlConfig;
  readonly executor: WorkflowDslExecutorConfig;
  readonly capabilities?: WorkflowDslAgentConfig;
  readonly missingInput?: WorkflowDslMissingInput;
}

/** 工作流级别的默认配置，子节点可继承或覆盖。 */
export interface WorkflowDslDefaults {
  readonly executor?: WorkflowDslExecutorConfig;
  readonly control?: WorkflowDslControlConfig;
  readonly missingInput?: WorkflowDslMissingInput;
  readonly output?: WorkflowDslOutputBinding;
}

/** 工作流所需的外部资源声明。 */
export interface WorkflowDslResources {
  readonly piPackages?: readonly string[];
}

/** 工作流运行时的全局设置。 */
export interface WorkflowDslSettings {
  readonly maxDepth?: number;
  readonly maxConcurrency?: number;
}

/** 提示（prompt）的来源引用。 */
export interface WorkflowDslPromptRef {
  readonly from: "inline" | "pi.prompt" | "file";
  readonly inline?: string;
  readonly name?: string;
  readonly path?: string;
}

/** 节点输出到工作流上下文的绑定配置。 */
export interface WorkflowDslOutputBinding {
  readonly to?: string;
  readonly mergeStrategy?: "replace" | "merge-object" | "append-array";
  readonly artifactType?: string;
  readonly schemaRef?: string;
}

/** 对 PI 技能的引用。 */
export interface WorkflowDslSkillRef {
  readonly name: string;
  readonly source?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** 对工具的引用。 */
export interface WorkflowDslToolRef {
  readonly name: string;
  readonly source?: string;
  readonly description?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

/** MCP（Model Context Protocol）服务器的连接配置。 */
export interface WorkflowDslMcpConfig {
  readonly server: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

/** Agent 节点能力配置：可挂载技能、工具和 MCP 服务器。 */
export interface WorkflowDslAgentConfig {
  readonly skills?: readonly WorkflowDslSkillRef[];
  readonly tools?: readonly WorkflowDslToolRef[];
  readonly mcp?: readonly WorkflowDslMcpConfig[];
}

/** 节点的流程控制配置：条件、循环、超时与重试。 */
export interface WorkflowDslControlConfig {
  readonly condition?: DslValue;
  readonly loopOver?: DslValue;
  readonly itemName?: string;
  readonly maxConcurrency?: number;
  readonly timeoutMs?: number;
  readonly retry?: { readonly maxAttempts: number; readonly delayMs?: number; readonly backoff?: "fixed" | "exponential" };
}

/** 节点的执行器配置，指定节点类型及相关参数。 */
export interface WorkflowDslExecutorConfig {
  readonly type: WorkflowNodeKind;
  readonly skillId?: string;
  readonly promptFile?: string;
  readonly config?: Readonly<Record<string, unknown>>;
}

/** 输入缺失时的处理策略。 */
export type WorkflowDslMissingInputMode = "ask_user" | "fail" | "skip";

/** 输入缺失的兜底行为配置。 */
export interface WorkflowDslMissingInput {
  readonly mode: WorkflowDslMissingInputMode;
}
