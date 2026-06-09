import type { ValueRef } from "@pi-workflow/core";

interface CapabilitiesEditorProps {
  capabilities?: Record<string, unknown>;
  onChange: (capabilities: Record<string, unknown> | undefined) => void;
}

export default function CapabilitiesEditor({ capabilities, onChange }: CapabilitiesEditorProps) {
  const skills: Array<{ name: string }> = (capabilities as any)?.skills ?? [];
  const tools: Array<{ name: string }> = (capabilities as any)?.tools ?? [];
  const mcp: Array<{ server: string }> = (capabilities as any)?.mcp ?? [];

  return (
    <div>
      <h4 style={{ margin: "0 0 8px", fontSize: 12, color: "#475569" }}>智能体能力</h4>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Skills</span>
          <button onClick={() => onChange({ ...capabilities as any, skills: [...skills, { name: "" }] })}
            style={{ marginLeft: "auto", border: "none", background: "#6366F1", color: "#fff", borderRadius: 3, cursor: "pointer", fontSize: 11 }}>+</button>
        </div>
        {skills.map((skill: { name: string }, i: number) => (
          <input key={i} value={skill.name}
            onChange={(e) => {
              const next = [...skills]; next[i] = { ...next[i], name: e.target.value };
              onChange({ ...capabilities as any, skills: next });
            }}
            placeholder="skill 名称"
            style={{ width: "100%", padding: "2px 4px", fontSize: 11, marginBottom: 2, borderRadius: 3, border: "1px solid #E2E8F0" }} />
        ))}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Tools</span>
          <button onClick={() => onChange({ ...capabilities as any, tools: [...tools, { name: "" }] })}
            style={{ marginLeft: "auto", border: "none", background: "#6366F1", color: "#fff", borderRadius: 3, cursor: "pointer", fontSize: 11 }}>+</button>
        </div>
        {tools.map((tool: { name: string }, i: number) => (
          <input key={i} value={tool.name}
            onChange={(e) => {
              const next = [...tools]; next[i] = { ...next[i], name: e.target.value };
              onChange({ ...capabilities as any, tools: next });
            }}
            placeholder="tool 名称"
            style={{ width: "100%", padding: "2px 4px", fontSize: 11, marginBottom: 2, borderRadius: 3, border: "1px solid #E2E8F0" }} />
        ))}
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>MCP</span>
          <button onClick={() => onChange({ ...capabilities as any, mcp: [...mcp, { server: "" }] })}
            style={{ marginLeft: "auto", border: "none", background: "#6366F1", color: "#fff", borderRadius: 3, cursor: "pointer", fontSize: 11 }}>+</button>
        </div>
        {mcp.map((m: { server: string }, i: number) => (
          <input key={i} value={m.server}
            onChange={(e) => {
              const next = [...mcp]; next[i] = { ...next[i], server: e.target.value };
              onChange({ ...capabilities as any, mcp: next });
            }}
            placeholder="server 名称"
            style={{ width: "100%", padding: "2px 4px", fontSize: 11, marginBottom: 2, borderRadius: 3, border: "1px solid #E2E8F0" }} />
        ))}
      </div>
    </div>
  );
}
