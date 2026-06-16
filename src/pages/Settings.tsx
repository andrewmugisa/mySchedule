/**
 * Settings.tsx — Settings page
 * v0 design adapted to Vite + React Router + real API
 * - Courses CRUD
 * - Sections CRUD
 * - Recurring events CRUD with day picker
 * - Add event form with type dropdown (PERSONAL / CLASS)
 */

import { useEffect, useState, useMemo } from "react";
import { api, Course, Section, Event } from "../api";

const ALL_DAYS = ["S","M","T","W","T","F","S"];
const DAY_KEYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDays(recur_days: string | null): Set<string> {
  if (!recur_days) return new Set();
  return new Set(recur_days.split(",").map(d => d.trim()));
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto",
  });
}

function fmtDayLabel(recur_days: string | null): string {
  if (!recur_days) return "";
  const days = recur_days.split(",");
  if (days.length === 7) return "Every day";
  return days.map(d => d.slice(0,1) + d.slice(1,3).toLowerCase()).join(", ");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DayPicker({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  function toggle(key: string) {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  }
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {ALL_DAYS.map((label, i) => {
        const key = DAY_KEYS[i];
        const on  = selected.has(key);
        return (
          <button key={i} type="button" onClick={() => toggle(key)}
            className={`day-btn${on ? " active" : ""}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", style = {} }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={style}>
      <label className="label">{label}</label>
      <input type={type} className="input" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionRow({ sec, courseName, courseColor, onEdit, onDelete }: {
  sec: Section; courseName: string; courseColor: string;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {courseName} {sec.type} · {sec.section_number}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          {sec.day_of_week?.slice(0,3)} {sec.start_time?.slice(0,5)}–{sec.end_time?.slice(0,5)} · {sec.room} · {sec.weight_percent}%
        </div>
      </div>
      <button className="btn-icon" onClick={onEdit} title="Edit">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button className="btn-icon" onClick={onDelete} title="Delete" style={{ color: "var(--red)", borderColor: "transparent" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [events,   setEvents]   = useState<Event[]>([]);
  const [saving,   setSaving]   = useState(false);

  const [editCourse,  setEditCourse]  = useState<Course | null>(null);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [editEvent,   setEditEvent]   = useState<Event | null>(null);

  // New event form
  const [newEvent, setNewEvent] = useState({
    title:      "",
    type:       "PERSONAL" as "PERSONAL" | "CLASS",
    sectionId:  null as number | null,
    date:       new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time:   "11:00",
    repeating:  false,
    recur_days: new Set<string>(),
    recur_end:  "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const [co, se, ev] = await Promise.all([
      api.courses.list(),
      api.sections.list(),
      api.events.list({ type: "PERSONAL" }),
    ]);
    setCourses(co); setSections(se); setEvents(ev);
  }

  const sectionsByCourse = useMemo(() => {
    const map: Record<number, Section[]> = {};
    for (const s of sections) {
      if (!map[s.course_id]) map[s.course_id] = [];
      map[s.course_id].push(s);
    }
    return map;
  }, [sections]);

  const recurringEvents = useMemo(() => events.filter(e => e.is_recurring), [events]);

  // Section options for CLASS type
  const sectionOptions = sections.map(sec => {
    const course = courses.find(c => c.course_id === sec.course_id);
    return {
      value: sec.section_id,
      label: `${course?.short_name ?? ""} — ${sec.type} ${sec.section_number}`,
    };
  });

  // ── Course CRUD ──
  async function saveCourse() {
    if (!editCourse) return;
    setSaving(true);
    try {
      await api.courses.update(editCourse.course_id, {
        code: editCourse.code, title: editCourse.title,
        short_name: editCourse.short_name, color: editCourse.color,
        professor: editCourse.professor, credits: editCourse.credits,
      });
      await load(); setEditCourse(null);
    } finally { setSaving(false); }
  }
  async function deleteCourse(id: number) {
    if (!confirm("Delete this course and all its data?")) return;
    await api.courses.delete(id); await load();
  }

  // ── Section CRUD ──
  async function saveSection() {
    if (!editSection) return;
    setSaving(true);
    try {
      await api.sections.update(editSection.section_id, {
        course_id: editSection.course_id,
        section_number: editSection.section_number,
        type: editSection.type,
        weight_percent: editSection.weight_percent,
        room: editSection.room,
        day_of_week: editSection.day_of_week,
        start_time: editSection.start_time,
        end_time: editSection.end_time,
      });
      await load(); setEditSection(null);
    } finally { setSaving(false); }
  }
  async function deleteSection(id: number) {
    if (!confirm("Delete this section?")) return;
    await api.sections.delete(id); await load();
  }

  // ── Event CRUD ──
  async function saveEvent() {
    if (!editEvent) return;
    setSaving(true);
    try {
      await api.events.update(editEvent.event_id, {
        section_id: null, title: editEvent.title, type: "PERSONAL",
        start_time: editEvent.start_time, end_time: editEvent.end_time,
        week_number: null, location: null, notes: null, is_cancelled: false,
        is_recurring: editEvent.is_recurring,
        recur_days: editEvent.recur_days,
        recur_end:  editEvent.recur_end,
      });
      await load(); setEditEvent(null);
    } finally { setSaving(false); }
  }
  async function deleteEvent(id: number) {
    if (!confirm("Delete this event?")) return;
    await api.events.delete(id); await load();
  }
  async function addEvent() {
    if (!newEvent.title) return;
    setSaving(true);
    try {
      await api.events.create({
        section_id:   newEvent.type === "CLASS" ? newEvent.sectionId : null,
        title:        newEvent.title,
        type:         newEvent.type,
        start_time:   `${newEvent.date}T${newEvent.start_time}:00`,
        end_time:     `${newEvent.date}T${newEvent.end_time}:00`,
        week_number:  null, location: null, notes: null, is_cancelled: false,
        is_recurring: newEvent.repeating,
        recur_days:   newEvent.repeating ? Array.from(newEvent.recur_days).join(",") : null,
        recur_end:    newEvent.repeating && newEvent.recur_end ? newEvent.recur_end : null,
      });
      setNewEvent({ title: "", type: "PERSONAL", sectionId: null,
        date: new Date().toISOString().slice(0, 10),
        start_time: "09:00", end_time: "11:00",
        repeating: false, recur_days: new Set(), recur_end: "" });
      await load();
    } finally { setSaving(false); }
  }

  // ── Panel styles ──
  const panel: React.CSSProperties = {
    background: "var(--bg-card)", border: "1px solid var(--border-dim)",
    borderRadius: 16, padding: "20px 20px",
  };
  const panelTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4,
  };
  const panelSub: React.CSSProperties = {
    fontSize: 11, color: "var(--text-3)", marginBottom: 16,
  };

  const inlineForm: React.CSSProperties = {
    marginTop: 12, padding: 14, background: "var(--bg-input)",
    border: "1px solid var(--border)", borderRadius: 12,
    display: "flex", flexDirection: "column", gap: 10,
  };

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>System</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>Settings</h1>
      </div>

      {/* Top grid: Courses + Sections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* ── Courses ── */}
        <div style={panel}>
          <div style={panelTitle}>Courses</div>
          <div style={panelSub}>Edit course details and colors</div>

          {courses.map(c => (
            <div key={c.course_id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.short_name} · {c.code}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.professor} · {c.credits} credits</div>
                </div>
                <button className="btn-icon" onClick={() => setEditCourse(editCourse?.course_id === c.course_id ? null : c)} title="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon" onClick={() => deleteCourse(c.course_id)} title="Delete" style={{ color: "var(--red)", borderColor: "transparent" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
              </div>

              {editCourse?.course_id === c.course_id && (
                <div style={inlineForm}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>Edit — {c.short_name}</div>
                  <Field label="Code"       value={editCourse.code}           onChange={v => setEditCourse(f => f && ({ ...f, code: v }))} />
                  <Field label="Title"      value={editCourse.title}          onChange={v => setEditCourse(f => f && ({ ...f, title: v }))} />
                  <Field label="Short name" value={editCourse.short_name}     onChange={v => setEditCourse(f => f && ({ ...f, short_name: v }))} />
                  <Field label="Professor"  value={editCourse.professor ?? ""} onChange={v => setEditCourse(f => f && ({ ...f, professor: v }))} />
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <Field label="Color (hex)" value={editCourse.color} onChange={v => setEditCourse(f => f && ({ ...f, color: v }))} style={{ flex: 1 }} />
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: editCourse.color, border: "1px solid var(--border)", flexShrink: 0 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveCourse} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditCourse(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Sections ── */}
        <div style={panel}>
          <div style={panelTitle}>Sections</div>
          <div style={panelSub}>Schedule, room, and weight per section</div>

          {courses.map(c =>
            (sectionsByCourse[c.course_id] ?? []).map(sec => (
              <div key={sec.section_id}>
                <SectionRow
                  sec={sec}
                  courseName={c.short_name}
                  courseColor={c.color}
                  onEdit={() => setEditSection(editSection?.section_id === sec.section_id ? null : sec)}
                  onDelete={() => deleteSection(sec.section_id)}
                />
                {editSection?.section_id === sec.section_id && (
                  <div style={inlineForm}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>Edit — {c.short_name} {sec.type}</div>
                    <Field label="Section #"   value={editSection.section_number}  onChange={v => setEditSection(f => f && ({ ...f, section_number: v }))} />
                    <Field label="Room"        value={editSection.room ?? ""}       onChange={v => setEditSection(f => f && ({ ...f, room: v }))} />
                    <Field label="Day of week" value={editSection.day_of_week ?? ""} onChange={v => setEditSection(f => f && ({ ...f, day_of_week: v }))} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <Field label="Start" type="time" value={editSection.start_time ?? ""} onChange={v => setEditSection(f => f && ({ ...f, start_time: v }))} />
                      <Field label="End"   type="time" value={editSection.end_time ?? ""}   onChange={v => setEditSection(f => f && ({ ...f, end_time: v }))} />
                    </div>
                    <Field label="Weight %" value={String(editSection.weight_percent)} onChange={v => setEditSection(f => f && ({ ...f, weight_percent: v as any }))} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveSection} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditSection(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Recurring events ── */}
      <div style={{ ...panel, marginBottom: 16 }}>
        <div style={panelTitle}>Recurring events</div>
        <div style={panelSub}>Personal events that repeat on a schedule</div>

        {recurringEvents.map(ev => (
          <div key={ev.event_id}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-dim)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{ev.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                    {fmtDayLabel(ev.recur_days)}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}
                  </span>
                  {ev.recur_end && (
                    <span style={{ fontSize: 11, color: "var(--text-4)" }}>ends {ev.recur_end}</span>
                  )}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setEditEvent(editEvent?.event_id === ev.event_id ? null : ev)} title="Edit">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button className="btn-icon" onClick={() => deleteEvent(ev.event_id)} title="Delete" style={{ color: "var(--red)", borderColor: "transparent" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>

            {editEvent?.event_id === ev.event_id && (
              <div style={inlineForm}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>Edit — {ev.title}</div>
                <Field label="Title" value={editEvent.title} onChange={v => setEditEvent(f => f && ({ ...f, title: v }))} />
                <div>
                  <label className="label">Days</label>
                  <DayPicker
                    selected={parseDays(editEvent.recur_days)}
                    onChange={s => setEditEvent(f => f && ({ ...f, recur_days: Array.from(s).join(",") }))}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <Field label="Start" type="time" value={fmtTime(editEvent.start_time)}
                    onChange={v => setEditEvent(f => f && ({ ...f, start_time: `${editEvent.start_time.slice(0,10)}T${v}:00` }))} />
                  <Field label="End" type="time" value={fmtTime(editEvent.end_time)}
                    onChange={v => setEditEvent(f => f && ({ ...f, end_time: `${editEvent.end_time.slice(0,10)}T${v}:00` }))} />
                  <Field label="Ends on" type="date" value={editEvent.recur_end ?? ""}
                    onChange={v => setEditEvent(f => f && ({ ...f, recur_end: v }))} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEvent} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditEvent(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Add event ── */}
      <div style={panel}>
        <div style={panelTitle}>Add event</div>
        <div style={panelSub}>One-off or repeating event</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type selector */}
          <div>
            <label className="label">Event type</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["PERSONAL", "CLASS"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewEvent(f => ({ ...f, type: t, sectionId: null }))}
                  style={{
                    padding: "8px 0", borderRadius: 10, fontSize: 13, fontWeight: 500,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1px solid ${newEvent.type === t ? "var(--accent)" : "var(--border)"}`,
                    background: newEvent.type === t ? "var(--accent-dim)" : "var(--bg-input)",
                    color: newEvent.type === t ? "#818cf8" : "var(--text-2)",
                  }}
                >
                  {t === "PERSONAL" ? "🏃 Personal" : "📚 Class"}
                </button>
              ))}
            </div>
          </div>

          {/* Section picker for CLASS */}
          {newEvent.type === "CLASS" && (
            <div>
              <label className="label">Section</label>
              <select
                className="select"
                value={newEvent.sectionId ?? ""}
                onChange={e => setNewEvent(f => ({ ...f, sectionId: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Select a section…</option>
                {sectionOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title + Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Title</label>
              <input className="input" value={newEvent.title}
                placeholder={newEvent.type === "PERSONAL" ? "e.g. Study session" : "e.g. Lab makeup"}
                onChange={e => setNewEvent(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={newEvent.date}
                onChange={e => setNewEvent(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

          {/* Times */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">Start time</label>
              <input type="time" className="input" value={newEvent.start_time}
                onChange={e => setNewEvent(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="label">End time</label>
              <input type="time" className="input" value={newEvent.end_time}
                onChange={e => setNewEvent(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>

          {/* Repeating toggle */}
          <button
            type="button"
            onClick={() => setNewEvent(f => ({ ...f, repeating: !f.repeating }))}
            style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
          >
            <div className="toggle-track" style={{ background: newEvent.repeating ? "var(--accent)" : "var(--bg-hover)" }}>
              <div className="toggle-thumb" style={{ left: newEvent.repeating ? 21 : 3 }} />
            </div>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Repeating event</span>
          </button>

          {/* Repeat options */}
          {newEvent.repeating && (
            <div style={{ background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label" style={{ marginBottom: 8 }}>Repeat on</label>
                <DayPicker
                  selected={newEvent.recur_days}
                  onChange={s => setNewEvent(f => ({ ...f, recur_days: s }))}
                />
              </div>
              <div>
                <label className="label">Ends on</label>
                <input type="date" className="input" value={newEvent.recur_end}
                  onChange={e => setNewEvent(f => ({ ...f, recur_end: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary"
              style={{ padding: "9px 24px" }}
              onClick={addEvent}
              disabled={saving || !newEvent.title}
            >
              {saving ? "Saving…" : "Add event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
