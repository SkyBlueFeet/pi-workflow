import type { WorkflowDslControlConfig } from "@pi-workflow/core";
import type { WorkflowNodeKind } from "@pi-workflow/core";

interface ControlEditorProps {
  control?: WorkflowDslControlConfig;
  kind: WorkflowNodeKind;
  onChange: (control: WorkflowDslControlConfig | undefined) => void;
}

export default function ControlEditor({ control, kind, onChange }: ControlEditorProps) {
  const isIf = kind === "if";
  const isLoop = kind === "loop";

  return (
    <div>
      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>
        {isIf ? "条件配置" : "循环配置"}
      </h4>

      {isIf && (
        <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 6 }}>
          条件值 (condition)
          <input
            value={String((control?.condition as any)?.value ?? "true")}
            onChange={(e) => {
              let val: any = e.target.value;
              if (val === "true") val = true;
              else if (val === "false") val = false;
              onChange({
                ...control,
                condition: { from: "literal", value: val },
              });
            }}
            style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
            placeholder="true / false"
          />
        </label>
      )}

      {isLoop && (
        <>
          <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 6 }}>
            循环数据 (loopOver)
            <input
              value={(control?.loopOver as any)?.value
                ? JSON.stringify((control?.loopOver as any).value)
                : "[]"}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange({
                    ...control,
                    loopOver: { from: "literal", value: parsed },
                  });
                } catch { /* ignore parse error */ }
              }}
              style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
              placeholder='["a", "b", "c"]'
            />
          </label>
          <label style={{ fontSize: 11, color: "#64748B", display: "block", marginBottom: 6 }}>
            项名称 (itemName)
            <input
              value={control?.itemName ?? "item"}
              onChange={(e) => onChange({ ...control, itemName: e.target.value || "item" })}
              style={{ width: "100%", padding: "2px 4px", fontSize: 12, borderRadius: 4, border: "1px solid #E2E8F0" }}
            />
          </label>
        </>
      )}
    </div>
  );
}
