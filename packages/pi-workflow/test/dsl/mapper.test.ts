import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFromObject } from "../../src/dsl/loader.js";
import { dslToIr } from "../../src/dsl/mapper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, "../fixtures");

function loadFixture(name: string): Record<string, unknown> {
  const path = resolve(fixturesDir, "dsl", `${name}.workflow.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

function loadGoldenIr(name: string): Record<string, unknown> {
  const path = resolve(fixturesDir, "ir", `${name}.ir.json`);
  return JSON.parse(readFileSync(path, "utf-8"));
}

describe("dslToIr", () => {
  const cases = [
    { name: "minimal-return" },
    { name: "manual-artifact" },
    { name: "subworkflow" },
  ];

  for (const { name } of cases) {
    it(`将 ${name} 转换为预期 IR`, () => {
      const dsl = loadFixture(name);
      const { document, diagnostics } = loadFromObject(dsl);
      expect(diagnostics.filter(d => d.severity === "error")).toHaveLength(0);

      const ir = dslToIr(document);
      const golden = loadGoldenIr(name);

      expect(ir.id).toBe(golden.id);
      expect(ir.version).toBe(golden.version);
      expect(ir.title).toBe(golden.title);
      expect([...ir.entryNodeIds]).toEqual(golden.entryNodeIds);
      expect(ir.nodes).toHaveLength((golden.nodes as Array<unknown>).length);

      for (const node of ir.nodes) {
        const expected = (golden.nodes as Array<Record<string, unknown>>).find(n => n.id === node.id);
        expect(expected).toBeDefined();
        expect(node.kind).toBe(expected!.kind);
        expect([...node.dependsOn]).toEqual(expected!.dependsOn ?? []);
        expect(node.children ? [...node.children] : undefined).toEqual(
          (expected!.children as string[]) ?? undefined,
        );
        expect(node.output ?? undefined).toEqual(
          expected!.output ? { ...(expected!.output as Record<string, unknown>) } : undefined,
        );
      }

      expect(ir.edges).toHaveLength((golden.edges as Array<unknown>).length);
      for (const edge of ir.edges) {
        expect((golden.edges as Array<Record<string, string>>).some(
          e => e.from === edge.from && e.to === edge.to,
        )).toBe(true);
      }
    });
  }
});
