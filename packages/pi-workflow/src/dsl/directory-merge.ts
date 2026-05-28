import type {
  WorkflowDslDefaults,
  WorkflowDslExecutorConfig,
  WorkflowDslControlConfig,
  WorkflowDslResources,
  WorkflowDslSettings,
} from "./types.js";

/**
 * 合并父级与当前层级的 defaults 配置。
 * 子层级的值优先于父层级，未提供的字段从父层级继承。
 */
export function mergeDefaults(
  parent: WorkflowDslDefaults | undefined,
  current: WorkflowDslDefaults | undefined,
): WorkflowDslDefaults | undefined {
  if (!parent && !current) return undefined;
  return stripUndefined({
    executor: mergeExecutor(parent?.executor, current?.executor),
    control: mergeControl(parent?.control, current?.control),
    missingInput: current?.missingInput ?? parent?.missingInput,
    output: current?.output,
  }) as WorkflowDslDefaults;
}

/**
 * 合并 executor 配置，深合并 config 子字段。
 */
export function mergeExecutor(
  parent: WorkflowDslExecutorConfig | undefined,
  current: WorkflowDslExecutorConfig | undefined,
): WorkflowDslExecutorConfig | undefined {
  if (!parent && !current) return undefined;
  return stripUndefined({
    ...parent,
    ...current,
    config: mergeRecord(parent?.config, current?.config),
  }) as WorkflowDslExecutorConfig;
}

/**
 * 合并 control 配置，深合并 retry 子字段。
 */
export function mergeControl(
  parent: WorkflowDslControlConfig | undefined,
  current: WorkflowDslControlConfig | undefined,
): WorkflowDslControlConfig | undefined {
  if (!parent && !current) return undefined;
  return stripUndefined({
    ...parent,
    ...current,
    retry: stripUndefined({
      ...(parent?.retry ?? {}),
      ...(current?.retry ?? {}),
    }),
  }) as WorkflowDslControlConfig;
}

/**
 * 合并 resources 配置，子层级优先级高于父层级，piPackages 以子层级为准。
 */
export function mergeResources(
  parent: WorkflowDslResources | undefined,
  current: WorkflowDslResources | undefined,
): WorkflowDslResources | undefined {
  if (!parent && !current) return undefined;
  return stripUndefined({
    ...parent,
    ...current,
    piPackages: current?.piPackages ?? parent?.piPackages,
  }) as WorkflowDslResources;
}

/**
 * 合并 settings 配置，子层级完全覆盖父层级。
 */
export function mergeSettings(
  parent: WorkflowDslSettings | undefined,
  current: WorkflowDslSettings | undefined,
): WorkflowDslSettings | undefined {
  if (!parent && !current) return undefined;
  return stripUndefined({
    ...parent,
    ...current,
  }) as WorkflowDslSettings;
}

/**
 * 合并两个普通字典对象，子层级完全覆盖父层级。
 */
export function mergeRecord(
  parent: Readonly<Record<string, unknown>> | undefined,
  current: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  if (!parent && !current) return undefined;
  return stripUndefined({
    ...(parent ?? {}),
    ...(current ?? {}),
  });
}

/** 移除对象中值为 undefined 的键，用于合并时避免污染结果。 */
export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
