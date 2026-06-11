import type { WorkflowConfig } from "../config/types.js";
import { createAssemblySpecFromLegacyDefinition } from "./assembly-normalizer.js";
import {
  normalizeAgentAssembly,
  type NormalizeAgentAssemblyOptions,
  type NormalizeAgentAssemblyResult,
} from "./resolver.js";
import type {
  AgentAssemblyMeta,
  NormalizedPiAgentAssembly,
  PiAgentAssemblySpec,
} from "./types.js";

/** 当前配置文件装载后的 agent 索引接口。 */
export interface CustomAgentRegistry {
  list(): readonly NormalizedPiAgentAssembly[];
  get(id: string): NormalizedPiAgentAssembly | undefined;
  has(id: string): boolean;
  register(spec: PiAgentAssemblySpec, meta?: AgentAssemblyMeta): string;
  resolveReference(ref: string): NormalizedPiAgentAssembly | undefined;
  loadFromConfig(config: WorkflowConfig): void;
}

/** 统一装配 registry，只维护单个显式配置文件的定义域。 */
export class AgentRegistry implements CustomAgentRegistry {
  private readonly rawSpecs = new Map<string, PiAgentAssemblySpec>();
  private readonly normalized = new Map<string, NormalizedPiAgentAssembly>();

  constructor(private readonly normalizeOptions: NormalizeAgentAssemblyOptions = {}) {}

  register(spec: PiAgentAssemblySpec, meta?: AgentAssemblyMeta): string {
    const result = this.normalizeAndStore(spec, meta);
    this.rawSpecs.set(spec.id, spec);
    this.normalized.set(spec.id, result.assembly);
    return spec.id;
  }

  get(id: string): NormalizedPiAgentAssembly | undefined {
    return this.normalized.get(id);
  }

  resolveReference(ref: string): NormalizedPiAgentAssembly | undefined {
    return this.normalized.get(ref);
  }

  list(): readonly NormalizedPiAgentAssembly[] {
    return Array.from(this.normalized.values());
  }

  has(id: string): boolean {
    return this.normalized.has(id);
  }

  clear(): void {
    this.rawSpecs.clear();
    this.normalized.clear();
  }

  remove(id: string): boolean {
    this.rawSpecs.delete(id);
    return this.normalized.delete(id);
  }

  loadFromConfig(config: WorkflowConfig): void {
    if (!config.agents) {
      return;
    }

    for (const [id, spec] of Object.entries(config.agents)) {
      this.register(
        createAssemblySpecFromLegacyDefinition(id, {
          ...spec,
          metadata: {
            originPath: config.baseDir,
            extra: spec.metadata?.extra,
          },
        }),
        {
          originPath: config.baseDir,
          source: "workflow-config",
        },
      );
    }
  }

  private normalizeAndStore(
    spec: PiAgentAssemblySpec,
    meta?: AgentAssemblyMeta,
  ): NormalizeAgentAssemblyResult {
    return normalizeAgentAssembly(spec, {
      ...this.normalizeOptions,
      meta,
      resolveParent: (id) => this.rawSpecs.get(id),
    });
  }
}

/** 从配置文件创建并初始化 registry。 */
export function createRegistryFromConfig(
  config: WorkflowConfig,
  options?: NormalizeAgentAssemblyOptions,
): AgentRegistry {
  const registry = new AgentRegistry(options);
  registry.loadFromConfig(config);
  return registry;
}
