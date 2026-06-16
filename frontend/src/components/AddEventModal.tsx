/**
 * AddEventModal.tsx — Add event overlay
 * - Type selector: PERSONAL or CLASS (with section picker for CLASS)
 * - Repeating toggle + day picker
 * - Real API calls via api.ts
 */

import { useState, useEffect } from "react";
import { api, Section, Course } from "../api";

const ALL_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface Props {
  onClose: () => void;
  onSaved: () => void;
  defaultDate?: string;
}

export default function AddEventModal({ onClose, onSaved, defaultDate }: Props) {
  const today = defaultDate ?? new Date().toISOString().slice(0, 10);

  // Form state
  const [title,      setTitle]      = useState("");
  const [type,       setType]       = useState<"PERSONAL" | "CLASS">("PERSONAL");
  const [sectionId,  setSectionId]  = useState<number | null>(null);
  const [date,       setDate]       = useState(today);
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("10:00");
  const [repeating,  setRepeating]  = useState(false);
  const [recurDays,  setRecurDays]  = useState<Set<string>>(new Set());
  const [recurEnd,   setRecurEnd]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  // Data for CLASS type
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    if (type === "CLASS") {
      Promise.all([api.courses.list(), api.sections.list()])
        .then(([co, se]) => { setCourses(co); setSections(se); })
        .catch(console.error);
    }
  }, [type]);

  function toggleDay(key: string) {
    setRecurDays(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Group sections by course for the dropdown
  const sectionOptions = sections.map(sec => {
    const course = courses.find(c => c.course_id === sec.course_id);
    return {
      value: sec.section_id,
      label: `${course?.short_name ?? ""} — ${sec.type} ${sec.section_number} (${sec.day_of_week?.slice(0,3)} ${sec.start_time?.slice(0,5)}–${sec.end_time?.slice(0,5)})`,
      color: course?.color,
    };
  });

  async function save() {
    if (!title.trim())              { setError("Title is required."); return; }
    if (!date)                      { setError("Date is required."); return; }
    if (startTime >= endTime)       { setError("End time must be after start time."); return; }
    if (type === "CLASS" && !sectionId) { setError("Pick a section."); return; }
    if (repeating && recurDays.size === 0) { setError("Pick at least one repeat day."); return; }

    setSaving(true);
    setError("");
    try {
      await api.events.create({
        section_id:   type === "CLASS" ? sectionId : null,
        title:        title.trim(),
        type:         type,
        start_time:   `${date}T${startTime}:00`,
        end_time:     `${date}T${endTime}:00`,
        week_number:  null,
        location:     null,
        notes:        null,
        is_cancelled: false,
        is_recurring: repeating,
        recur_days:   repeating ? Array.from(recurDays).join(",") : null,
        recur_end:    repeating && recurEnd ? recurEnd : null,
      });
      onSaved();
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="overlay-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="overlay-panel" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>Add event</h2>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: 30, height: 30, borderRadius: 8 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Type selector */}
          <div>
            <label className="label">Event type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["PERSONAL", "CLASS"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setSectionId(null); }}
                  style={{
                    padding: "9px 0",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    border: `1px solid ${type === t ? "var(--accent)" : "var(--border)"}`,
                    background: type === t ? "var(--accent-dim)" : "var(--bg-input)",
                    color: type === t ? "var(--accent-hover)" : "var(--text-2)",
                  }}
                >
                  {t === "PERSONAL" ? "🏃 Personal" : "📚 Class"}
                </button>
              ))}
            </div>
          </div>

          {/* Section picker (CLASS only) */}
          {type === "CLASS" && (
            <div>
              <label className="label">Section</label>
              <select
                className="select"
                value={sectionId ?? ""}
                onChange={e => setSectionId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select a section…</option>
                {sectionOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="label">Title</label>
            <input
              autoFocus
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={type === "PERSONAL" ? "e.g. Library study session" : "e.g. OOP Lab makeup"}
              onKeyDown={e => e.key === "Enter" && save()}
            />
          </div>

          {/* Date */}
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Start / End */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Start time</label>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label">End time</label>
              <input
                type="time"
                className="input"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Repeating toggle */}
          <button
            type="button"
            onClick={() => setRepeating(r => !r)}
            style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
          >
            <div
              className="toggle-track"
              style={{ background: repeating ? "var(--accent)" : "var(--bg-hover)" }}
            >
              <div
                className="toggle-thumb"
                style={{ left: repeating ? 21 : 3 }}
              />
            </div>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Repeating event</span>
          </button>

          {/* Repeat options */}
          {repeating && (
            <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label" style={{ marginBottom: 10 }}>Repeat on</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {ALL_DAYS.map((label, i) => {
                    const key = DAY_KEYS[i];
                    const on  = recurDays.has(key);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(key)}
                        className={`day-btn${on ? " active" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="label">Ends on</label>
                <input
                  type="date"
                  className="input"
                  value={recurEnd}
                  onChange={e => setRecurEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: 12, color: "var(--red)" }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Add event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
