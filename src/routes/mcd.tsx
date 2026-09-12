import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listComplaintsFn,
  STATUSES,
  updateMcdComplaintStatus,
  type Complaint,
} from "@/lib/complaints";
import { formatDate } from "@/lib/complaint-model";

export const Route = createFileRoute("/mcd")({ component: MCDPage });

function MCDPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<Complaint["status"]>("Reported");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const data = await listComplaintsFn();
      setComplaints(data);
      setSelectedId((current) => current && data.some((c) => c.id === current) ? current : (data[0]?.id ?? null));
    } catch (err) {
      console.error("[mcd] failed to load complaints", err);
      setError(err instanceof Error ? err.message : "Failed to load complaints");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = complaints.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setStatus(selected.status);
      setNote("");
    }
  }, [selected?.id, selected?.status]);

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await updateMcdComplaintStatus(selected.id, status, note.trim() || undefined);
      await load();
      setNote("");
    } catch (err) {
      console.error("[mcd] failed to update status", err);
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>MCD Operations</h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>Manual status updates · shared citizen timeline</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 10, textDecoration: "none", color: "#0f172a", background: "white" }}>Back</a>
            <button type="button" onClick={() => void load()} disabled={loading} style={{ padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 10, background: "white", cursor: "pointer" }}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: "#fee2e2", color: "#991b1b" }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 20 }}>
          <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
              <strong>MCD complaints</strong>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Select a complaint.</p>
            </div>
            <div style={{ maxHeight: "70vh", overflow: "auto" }}>
              {complaints.length === 0 && !loading ? <p style={{ padding: 20, color: "#64748b" }}>No complaints found.</p> : complaints.map((c) => (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} style={{ display: "block", width: "100%", padding: 16, textAlign: "left", border: 0, borderBottom: "1px solid #e2e8f0", background: selectedId === c.id ? "#f1f5f9" : "white", cursor: "pointer" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12 }}>{c.id}</div>
                  <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{c.type}</strong><span style={{ fontSize: 11 }}>{c.status}</span></div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>{c.description}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            {!selected ? <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, color: "#64748b" }}>Select a complaint.</div> : <>
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{selected.id}</div>
                <h2 style={{ margin: "6px 0 0" }}>{selected.type}</h2>
                <p style={{ color: "#64748b" }}>{selected.description}</p>
                <p style={{ fontSize: 12, color: "#64748b" }}>{selected.area} · {selected.ward} · reported {formatDate(selected.createdAt)}</p>
                <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: "#f8fafc" }}>
                  <strong>Update MCD status</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 10, marginTop: 10 }}>
                    <select value={status} onChange={(e) => setStatus(e.target.value as Complaint["status"])} style={{ height: 44, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px", background: "white" }}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional MCD update note" style={{ height: 44, border: "1px solid #cbd5e1", borderRadius: 10, padding: "0 10px" }} />
                    <button type="button" onClick={() => void save()} disabled={saving} style={{ height: 44, border: 0, borderRadius: 10, padding: "0 18px", background: "#0f172a", color: "white", fontWeight: 700 }}>{saving ? "Saving…" : "Save status"}</button>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b" }}>Only a manual save creates a timeline event.</p>
                </div>
              </div>

              <div style={{ marginTop: 20, background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>Shared MCD timeline</h2>
                <p style={{ color: "#64748b", fontSize: 13 }}>This is the same database timeline shown to the citizen.</p>
                <ol style={{ paddingLeft: 22 }}>
                  {selected.timeline.map((event, index) => <li key={`${event.at}-${index}`} style={{ marginBottom: 14 }}><strong>{event.status}</strong><div style={{ fontSize: 12, color: "#64748b" }}>{event.note} · {formatDate(event.at)}</div></li>)}
                </ol>
              </div>
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
