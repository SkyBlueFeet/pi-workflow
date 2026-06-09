import type { WorkflowDslOutputBinding } from "@pi-workflow/core";

interface OutputConfigEditorProps {
  output?: WorkflowDslOutputBinding;
  onChange: (output: WorkflowDslOutputBinding | undefined) => void;
}

export default function OutputConfigEditor({ output, onChange }: OutputConfigEditorProps) {
  return (
    <div>
      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>输出配置</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 11, color: "#64748B" }}>
          目标路径 (to)
          <input
            value={output?.to ?? ""}
            onChange={(e) => onChange({ ...output, to: e.target.value || undefined, mergeStrategy: output?.mergeStrategy ?? "replace" })}
            style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
            placeholder="如: result"
          />
        </label>
        <label style={{ fontSize: 11, color: "#64748B" }}>
          合并策略
          <select
            value={output?.mergeStrategy ?? "replace"}
            onChange={(e) => onChange({ ...output, mergeStrategy: e.target.value as any, to: output?.to ?? "" })}
            style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
          >
            <option value="replace">replace</option>
            <option value="merge-object">merge-object</option>
            <option value="append-array">append-array</option>
          </select>
        </label>
      </div>
    </div>
  );
}
