/** 值引用类型，表示从运行输入、上下文、节点输出、帧局部变量或字面量取值。 */
export type ValueRef =
  | { readonly from: "run.input"; readonly path?: string }
  | { readonly from: "context"; readonly path?: string }
  | { readonly from: "node.output"; readonly nodeId: string; readonly path?: string }
  | { readonly from: "frame.local"; readonly path?: string }
  | { readonly from: "literal"; readonly value: unknown };

/** 工作流节点类型：agent / workflow / manual / return / tool / http / if / parallel / loop。 */
export type WorkflowNodeKind =
  | "agent" | "workflow" | "manual" | "return"
  | "tool" | "http" | "if" | "parallel" | "loop";

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
