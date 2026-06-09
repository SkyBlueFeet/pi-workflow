/** 值引用类型，表示从运行输入、上下文、节点输出、帧局部变量或字面量取值。 */
export type ValueRef =
  | { readonly from: "run.input"; readonly path?: string }
  | { readonly from: "context"; readonly path?: string }
  | { readonly from: "node.output"; readonly nodeId: string; readonly path?: string }
  | { readonly from: "frame.local"; readonly path?: string }
  | { readonly from: "literal"; readonly value: unknown };

/** 工作流节点类型：agent / workflow / manual / return / tool / http / if / parallel / loop / extractor / template / assign / merge / code / delay / list-op。 */
export type WorkflowNodeKind =
  | "agent" | "workflow" | "manual" | "return"
  | "tool" | "http" | "if" | "parallel" | "loop" | "extractor"
  | "template" | "assign" | "merge" | "code" | "delay" | "list-op";

/** IR 执行器定义，指定执行类型、关联 skill 及自定义配置。 */
export interface WorkflowExecutorIR {
  readonly type: WorkflowNodeKind;
  readonly skillId?: string;
  readonly promptFile?: string;
  readonly config?: Readonly<Record<string, unknown>>;
}

/** 输出绑定定义，指定目标路径、合并策略及转出物类型。 */
export interface WorkflowOutputBindingIR {
  readonly to?: string;
  readonly mergeStrategy?: "replace" | "merge-object" | "append-array";
  readonly artifactType?: string;
  readonly schemaRef?: string;
}

/** 重试策略 IR，控制失败重试的最大次数、间隔及退避算法。 */
export interface WorkflowRetryPolicy {
  readonly maxAttempts: number;
  readonly delayMs?: number;
  readonly backoff?: "fixed" | "exponential";
}

/** Skill 引用 IR，通过名称引用已注册的 skill。 */
export interface WorkflowSkillRefIR {
  readonly name: string;
  readonly source?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** 工具引用 IR，支持按名称及来源引用工具。 */
export interface WorkflowToolRefIR {
  readonly name: string;
  readonly source?: string;
  readonly description?: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
}

/** MCP 服务器配置 IR，指定 server 名称、参数及环境变量。 */
export interface WorkflowMcpConfigIR {
  readonly server: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

/** 节点能力配置 IR，包含可用的 Skill、工具及 MCP 服务器列表。 */
export interface WorkflowAgentConfigIR {
  readonly skills?: readonly WorkflowSkillRefIR[];
  readonly tools?: readonly WorkflowToolRefIR[];
  readonly mcp?: readonly WorkflowMcpConfigIR[];
}

/** 节点控制流 IR，支持条件、循环、并发、超时、重试及失败策略。 */
export interface WorkflowControlIR {
  readonly condition?: ValueRef;
  readonly loopOver?: ValueRef;
  readonly itemName?: string;
  readonly maxConcurrency?: number;
  readonly timeoutMs?: number;
  readonly retry?: WorkflowRetryPolicy;
  readonly failStrategy?: "all" | "any";
}

/** Extractor 节点输入源类型：text / html / code / json。 */
export type ExtractorSourceType = "text" | "html" | "code" | "json";

/** Extractor 节点处理模式：extract（字段抽取）/ summarize（内容汇总）/ typed-object（对象类型约束输出）。 */
export type ExtractorMode = "extract" | "summarize" | "typed-object";

/** Extractor 节点配置。 */
export interface ExtractorConfig {
  readonly sourceType?: ExtractorSourceType;
  readonly mode?: ExtractorMode;
  readonly sourcePath?: string;
  readonly fields?: readonly string[];
  readonly schema?: Readonly<Record<string, unknown>>;
  readonly schemaRequired?: boolean;
  readonly summaryStyle?: "brief" | "detailed" | "bullet";
  readonly language?: string;
  readonly maxInputChars?: number;
}

/** Template 节点配置：使用 {{key}} 或 {{nested.path}} 占位符渲染字符串模板。 */
export interface TemplateConfig {
  readonly template: string;
}

/** Assign 节点单条赋值定义。 */
export interface AssignEntry {
  readonly key: string;
  readonly to: string;
  readonly mergeStrategy?: "replace" | "merge-object" | "append-array";
}

/** Assign 节点配置：将多个输入值显式写入 sharedContext 的指定路径。 */
export interface AssignConfig {
  readonly assignments: readonly AssignEntry[];
}

/** Merge 节点合并策略：first-defined 取第一个非 undefined / merge-object 浅合并 / concat-array 拼接数组。 */
export type MergeStrategy = "first-defined" | "merge-object" | "concat-array";

/** Merge 节点配置：将 if 分支的多路输出合并为单一值。 */
export interface MergeConfig {
  readonly strategy?: MergeStrategy;
}

/** Code 节点配置：在 Node.js vm 沙箱中执行 JavaScript 脚本，通过 return 返回结果。 */
export interface CodeConfig {
  readonly script: string;
  readonly timeout?: number;
  readonly language?: "javascript";
}

/** Delay 节点配置：等待指定毫秒数后继续，可被 AbortSignal 提前中断。 */
export interface DelayConfig {
  readonly delayMs: number;
}

/** ListOp 节点支持的操作类型。 */
export type ListOpOperation = "filter" | "sort" | "slice" | "map" | "unique";

/** ListOp 节点配置：对输入数组执行 filter/sort/slice/map/unique 操作。 */
export interface ListOpConfig {
  readonly operation: ListOpOperation;
  readonly expression?: string;
  readonly sortKey?: string;
  readonly sortOrder?: "asc" | "desc";
  readonly sliceStart?: number;
  readonly sliceEnd?: number;
}

/** 缺失输入处理模式：询问用户、失败、跳过的行为决策。 */
export type WorkflowMissingInputMode = "ask_user" | "fail" | "skip";

/** 缺失输入配置，指定缺失时的处理策略。 */
export interface WorkflowMissingInput {
  readonly mode: WorkflowMissingInputMode;
}

/** 工作流节点 IR，包含节点 ID、标题、类型、依赖、输入/输出绑定、控制流及能力配置。 */
export interface WorkflowNodeIR {
  readonly id: string;
  readonly title: string;
  readonly kind: WorkflowNodeKind;
  readonly dependsOn: readonly string[];
  readonly inputBindings: Readonly<Record<string, ValueRef>>;
  readonly executor?: WorkflowExecutorIR;
  readonly output?: WorkflowOutputBindingIR;
  readonly control?: WorkflowControlIR;
  readonly children?: readonly string[];
  readonly capabilities?: WorkflowAgentConfigIR;
  readonly missingInput?: WorkflowMissingInput;
}

/** 工作流边 IR，定义节点间的数据/控制流方向。 */
export interface WorkflowEdgeIR {
  readonly from: string;
  readonly to: string;
}

/** 工作流定义 IR，包含版本、入口节点、节点列表、边及最终输出绑定。 */
export interface WorkflowDefinitionIR {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly entryNodeIds: readonly string[];
  readonly nodes: readonly WorkflowNodeIR[];
  readonly edges: readonly WorkflowEdgeIR[];
  readonly finalOutput?: WorkflowOutputBindingIR;
}
