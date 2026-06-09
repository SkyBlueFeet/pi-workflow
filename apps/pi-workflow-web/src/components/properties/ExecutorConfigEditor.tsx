import type { WorkflowDslExecutorConfig } from "@pi-workflow/core";

interface ExecutorConfigEditorProps {
  executor?: WorkflowDslExecutorConfig;
  onChange: (executor: WorkflowDslExecutorConfig | undefined) => void;
}

const SOURCE_TYPE_OPTIONS = ["text", "html", "code", "json"];
const MODE_OPTIONS = ["extract", "summarize", "typed-object"];

export default function ExecutorConfigEditor({ executor, onChange }: ExecutorConfigEditorProps) {
  const config = executor?.config ?? {};

  const updateConfig = (key: string, value: unknown) => {
    onChange({
      type: "extractor",
      config: { ...config, [key]: value },
    });
  };

  return (
    <div>
      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>提取器配置</h4>

      <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 5 }}>
        源类型 (sourceType)
        <select
          value={String(config["sourceType"] ?? "text")}
          onChange={(e) => updateConfig("sourceType", e.target.value)}
          style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
        >
          {SOURCE_TYPE_OPTIONS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 5 }}>
        处理模式 (mode)
        <select
          value={String(config["mode"] ?? "extract")}
          onChange={(e) => updateConfig("mode", e.target.value)}
          style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
        >
          {MODE_OPTIONS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 5 }}>
        提取字段 (fields, 逗号分隔)
        <input
          value={(config["fields"] as string[])?.join(", ") ?? ""}
          onChange={(e) => updateConfig("fields", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
          style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
          placeholder="name, age"
        />
      </label>
    </div>
  );
}
