import type { ValueRef } from "@pi-workflow/core";

interface InputBindingEditorProps {
  inputs: Record<string, ValueRef>;
  allNodeIds: string[];
  currentId: string;
  onUpdate: (key: string, ref: ValueRef) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
}

export default function InputBindingEditor({
  inputs,
  allNodeIds,
  currentId,
  onUpdate,
  onAdd,
  onRemove,
}: InputBindingEditorProps) {
  const entries = Object.entries(inputs);

  const fromOptions = [
    { value: "literal", label: "字面量" },
    { value: "run.input", label: "run.input" },
    { value: "node.output", label: "node.output" },
    { value: "context", label: "context" },
    { value: "frame.local", label: "frame.local" },
  ];

  return (
    <div>
      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>输入绑定</h4>
      {entries.map(([key, ref]) => (
        <div key={key} style={{ marginBottom: 8, padding: "6px 8px", background: "#fff", borderRadius: 6, border: "1px solid #E2E8F0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{key}</span>
            <button
              onClick={() => onRemove(key)}
              style={{
                marginLeft: "auto", border: "none", background: "transparent",
                color: "#EF4444", cursor: "pointer", fontSize: 14, lineHeight: 1,
              }}
              title="移除"
            >
              ×
            </button>
          </div>
          <select
            value={ref.from}
            onChange={(e) => {
              const newFrom = e.target.value as ValueRef["from"];
              const next: ValueRef = { from: newFrom } as any;
              if (newFrom === "node.output") (next as any).nodeId = allNodeIds[0] ?? "";
              if (newFrom === "literal") (next as any).value = "";
              onUpdate(key, next);
            }}
            style={{ width: "100%", padding: "2px 4px", marginBottom: 3, fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
          >
            {fromOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {ref.from === "literal" && (
            <input
              value={String((ref as any).value ?? "")}
              onChange={(e) => onUpdate(key, { ...ref, from: "literal", value: e.target.value } as any)}
              style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
              placeholder="输入值..."
            />
          )}
          {(ref.from === "run.input" || ref.from === "context" || ref.from === "frame.local") && (
            <input
              value={(ref as any).path ?? ""}
              onChange={(e) => onUpdate(key, { ...ref, path: e.target.value } as any)}
              style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
              placeholder="path..."
            />
          )}
          {ref.from === "node.output" && (
            <div style={{ display: "flex", gap: 4 }}>
              <select
                value={(ref as any).nodeId ?? ""}
                onChange={(e) => onUpdate(key, { ...ref, nodeId: e.target.value } as any)}
                style={{ flex: 1, padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
              >
                {allNodeIds.filter(id => id !== currentId).map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
              <input
                value={(ref as any).path ?? ""}
                onChange={(e) => onUpdate(key, { ...ref, path: e.target.value } as any)}
                style={{ width: 60, padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
                placeholder="path"
              />
            </div>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        <input
          id="new-input-key"
          placeholder="新参数名..."
          style={{ flex: 1, padding: "3px 6px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAdd((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
        <button
          onClick={() => {
            const el = document.getElementById("new-input-key") as HTMLInputElement;
            if (el?.value) { onAdd(el.value); el.value = ""; }
          }}
          style={{
            padding: "3px 8px", background: "#6366F1", color: "#fff", border: "none",
            borderRadius: 4, cursor: "pointer", fontSize: 12,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
