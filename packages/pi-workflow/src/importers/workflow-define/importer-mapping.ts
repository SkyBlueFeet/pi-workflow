import type { DslValue, WorkflowDslOutputBinding } from "../../dsl/types.js";
import type { ValueRef } from "../../ir/types.js";
import { parsePathExpression, isPathExpression } from "../../dsl/path-expr.js";
import { asRecord, asString, asMergeStrategy } from "./importer-helpers.js";

function isValueRefLike(value: unknown): value is ValueRef {
  return !!value && typeof value === "object" && "from" in (value as Record<string, unknown>);
}

function mapDslValue(value: unknown): DslValue {
  if (isValueRefLike(value)) {
    return value;
  }

  if (typeof value === "string" && isPathExpression(value)) {
    return parsePathExpression(value);
  }

  return { from: "literal", value } satisfies ValueRef;
}

function mapInputs(value: unknown): Readonly<Record<string, DslValue>> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const inputs: Record<string, DslValue> = {};
  for (const [key, inputValue] of Object.entries(record)) {
    inputs[key] = mapDslValue(inputValue);
  }
  return inputs;
}

function mapOutput(value: unknown): WorkflowDslOutputBinding | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  return {
    to: asString(record["to"]),
    mergeStrategy: asMergeStrategy(record["mergeStrategy"]),
    artifactType: asString(record["artifactType"]),
    schemaRef: asString(record["schemaRef"]),
  };
}

export { mapInputs, mapOutput };
