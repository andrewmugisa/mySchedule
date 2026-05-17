/**
 * Settings.tsx — Settings page
 * Courses CRUD, Sections CRUD, Recurring events CRUD with day picker
 */

import { useEffect, useState, useMemo } from "react";
import { api, Course, Section, Event } from "../api";

const ALL_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_KEYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDays(recur_days: string | null): Set<string> {
  if (!recur_days) return new Set();
  return new Set(recur_days.split(",").map(d => d.trim()));
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
}

function fmtDayLabel(recur_days: string | null): string {
  if (!recur_days) return "";
  const days = recur_days.split(",");
  if (days.length === 7) return "Every day";
  return days.map(d => d.slice(0, 3).charAt(0) + d.slice(1, 3).toLowerCase()).join(", ");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Settings() {
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [events,   setEvents]   = useState<Event[]>([]);

  // Which course/section is being edited
  const [editCourse,  setEditCourse]  = useState<Course | null>(null);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [editEvent,   setEditEvent]   = useState<Event | null>(null);

  // New event form
  const [newEvent, setNewEvent] = useState({
    title:      "",
    date:       new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time:   "11:00",
    repeating:  false,
    recur_days: new Set<string>(),
    recur_end:  "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [co, se, ev] = await Promise.all([
      api.courses.list(),
      api.sections.list(),
      api.events.list({ type: "PERSONAL" }),
    ]);
    setCourses(co);
    setSections(se);
    setEvents(ev);
  }

  const sectionsByCourse = useMemo(() => {
    const map: Record<number, Section[]> = {};
    for (const s of sections) {
      if (!map[s.course_id]) map[s.course_id] = [];
      map[s.course_id].push(s);
    }
    return map;
  }, [sections]);

  // Recurring personal events only
  const recurringEvents = useMemo(() =>
    events.filter(e => e.is_recurring), [events]);

  // ── Course actions ──
  async function saveCourse() {
    if (!editCourse) return;
    setSaving(true);
    try {
      await api.courses.update(editCourse.course_id, {
        code: editCourse.code, title: editCourse.title,
        short_name: editCourse.short_name, color: editCourse.color,
        professor: editCourse.professor, credits: editCourse.credits,
      });
      await load();
      setEditCourse(null);
    } finally { setSaving(false); }
  }

  async function deleteCourse(id: number) {
    if (!confirm("Delete this course and all its data?")) return;
    await api.courses.delete(id);
    await load();
  }

  // ── Section actions ──
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
      await load();
      setEditSection(null);
    } finally { setSaving(false); }
  }

  async function deleteSection(id: number) {
    if (!confirm("Delete this section?")) return;
    await api.sections.delete(id);
    await load();
  }

  // ── Event actions ──
  async function saveEvent() {
    if (!editEvent) return;
    setSaving(true);
    try {
      await api.events.update(editEvent.event_id, {
        section_id:   null,
        title:        editEvent.title,
        type:         "PERSONAL",
        start_time:   editEvent.start_time,
        end_time:     editEvent.end_time,
        week_number:  null,
        location:     null,
        notes:        null,
        is_cancelled: false,
        is_recurring: editEvent.is_recurring,
        recur_days:   editEvent.recur_days,
        recur_end:    editEvent.recur_end,
      });
      await load();
      setEditEvent(null);
    } finally { setSaving(false); }
  }

  async function deleteEvent(id: number) {
    if (!confirm("Delete this event?")) return;
    await api.events.delete(id);
    await load();
  }

  async function addEvent() {
    if (!newEvent.title) return;
    setSaving(true);
    try {
      const dateStr  = newEvent.date;
      const startISO = `${dateStr}T${newEvent.start_time}:00`;
      const endISO   = `${dateStr}T${newEvent.end_time}:00`;
      await api.events.create({
        section_id:   null,
        title:        newEvent.title,
        type:         "PERSONAL",
        start_time:   startISO,
        end_time:     endISO,
        week_number:  null,
        location:     null,
        notes:        null,
        is_cancelled: false,
        is_recurring: newEvent.repeating,
        recur_days:   newEvent.repeating ? Array.from(newEvent.recur_days).join(",") : null,
        recur_end:    newEvent.repeating && newEvent.recur_end ? newEvent.recur_end : null,
      });
      setNewEvent({
        title: "", date: new Date().toISOString().slice(0, 10),
        start_time: "09:00", end_time: "11:00",
        repeating: false, recur_days: new Set(), recur_end: "",
      });
      await load();
    } finally { setSaving(false); }
  }

  function toggleDay(day: string, set: Set<string>, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(day)) next.delete(day); else next.add(day);
    setter(next);
  }

  // ── Day picker ──
  function DayPicker({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
    return (
      <div className="flex flex-wrap gap-1">
        {ALL_DAYS.map((label, i) => {
          const key = DAY_KEYS[i];
          const on  = selected.has(key);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(key, selected, onChange)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                on ? "bg-[#6366f1] text-white" : "bg-[#2e2e2e] text-[#666] hover:text-white"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // ── Input helper ──
  function Field({ label, value, onChange, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; type?: string;
  }) {
    return (
      <div>
        <label className="block text-xs text-[#666] mb-1">{label}</label>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[#2e2e2e] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366f1]"
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-5 max-w-4xl">
      <div className="text-xs text-[#666] mb-1">System</div>
      <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>

      <div className="grid grid-cols-2 gap-4">
        {/* ── Courses ── */}
        <div className="bg-[#242424] border border-[#2e2e2e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Courses</div>
              <div className="text-xs text-[#555]">Edit course details and colors</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center text-white text-lg font-bold">+</div>
          </div>

          <div className="flex flex-col gap-2">
            {courses.map(c => (
              <div key={c.course_id}>
                <div className="flex items-center gap-2 py-2 border-b border-[#2a2a2a]">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.short_name} · {c.code}</div>
                    <div className="text-xs text-[#555] truncate">{c.professor} · {c.credits} credits</div>
                  </div>
                  <button onClick={() => setEditCourse(editCourse?.course_id === c.course_id ? null : c)}
                    className="w-7 h-7 rounded border border-[#333] flex items-center justify-center text-[#666] hover:text-white text-xs">✎</button>
                  <button onClick={() => deleteCourse(c.course_id)}
                    className="w-7 h-7 rounded border border-[#333] flex items-center justify-center text-red-500 hover:text-red-400 text-xs">✕</button>
                </div>

                {/* Inline edit */}
                {editCourse?.course_id === c.course_id && (
                  <div className="mt-2 p-3 bg-[#1e1e1e] rounded-lg border border-[#333] flex flex-col gap-2">
                    <div className="text-xs text-[#888] font-medium mb-1">Edit course — {c.short_name}</div>
                    <Field label="Code"       value={editCourse.code}       onChange={v => setEditCourse(f => f && ({ ...f, code: v }))} />
                    <Field label="Title"      value={editCourse.title}      onChange={v => setEditCourse(f => f && ({ ...f, title: v }))} />
                    <Field label="Short name" value={editCourse.short_name} onChange={v => setEditCourse(f => f && ({ ...f, short_name: v }))} />
                    <Field label="Professor"  value={editCourse.professor ?? ""} onChange={v => setEditCourse(f => f && ({ ...f, professor: v }))} />
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Field label="Color (hex)" value={editCourse.color} onChange={v => setEditCourse(f => f && ({ ...f, color: v }))} />
                      </div>
                      <div className="w-8 h-9 rounded border border-[#333] flex-shrink-0" style={{ backgroundColor: editCourse.color }} />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button onClick={saveCourse} disabled={saving}
                        className="flex-1 py-1.5 rounded-lg bg-[#6366f1] text-white text-xs font-medium disabled:opacity-50">
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditCourse(null)}
                        className="flex-1 py-1.5 rounded-lg border border-[#333] text-[#888] text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sections ── */}
        <div className="bg-[#242424] border border-[#2e2e2e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Sections</div>
              <div className="text-xs text-[#555]">Schedule, room, and weight per section</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#6366f1] flex items-center justify-center text-white text-lg font-bold">+</div>
          </div>

          <div className="flex flex-col gap-2">
            {courses.map(c => (
              (sectionsByCourse[c.course_id] ?? []).map(sec => (
                <div key={sec.section_id}>
                  <div className="flex items-center gap-2 py-2 border-b border-[#2a2a2a]">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {c.short_name} {sec.type} · {sec.section_number}
                      </div>
                      <div className="text-xs text-[#555] truncate">
                        {sec.day_of_week?.slice(0,3)} {sec.start_time?.slice(0,5)}–{sec.end_time?.slice(0,5)} · {sec.room} · {sec.weight_percent}%
                      </div>
                    </div>
                    <button onClick={() => setEditSection(editSection?.section_id === sec.section_id ? null : sec)}
                      className="w-7 h-7 rounded border border-[#333] flex items-center justify-center text-[#666] hover:text-white text-xs">✎</button>
                    <button onClick={() => deleteSection(sec.section_id)}
                      className="w-7 h-7 rounded border border-[#333] flex items-center justify-center text-red-500 hover:text-red-400 text-xs">✕</button>
                  </div>

                  {/* Inline edit */}
                  {editSection?.section_id === sec.section_id && (
                    <div className="mt-2 p-3 bg-[#1e1e1e] rounded-lg border border-[#333] flex flex-col gap-2">
                      <div className="text-xs text-[#888] font-medium mb-1">Edit section — {c.short_name} {sec.type}</div>
                      <Field label="Section #"   value={editSection.section_number} onChange={v => setEditSection(f => f && ({ ...f, section_number: v }))} />
                      <Field label="Room"        value={editSection.room ?? ""}     onChange={v => setEditSection(f => f && ({ ...f, room: v }))} />
                      <Field label="Day of week" value={editSection.day_of_week ?? ""} onChange={v => setEditSection(f => f && ({ ...f, day_of_week: v }))} />
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Start" value={editSection.start_time ?? ""} onChange={v => setEditSection(f => f && ({ ...f, start_time: v }))} type="time" />
                        <Field label="End"   value={editSection.end_time ?? ""}   onChange={v => setEditSection(f => f && ({ ...f, end_time: v }))} type="time" />
                      </div>
                      <Field label="Weight %" value={String(editSection.weight_percent)} onChange={v => setEditSection(f => f && ({ ...f, weight_percent: v as any }))} />
                      <div className="flex gap-2 mt-1">
                        <button onClick={saveSection} disabled={saving}
                          className="flex-1 py-1.5 rounded-lg bg-[#6366f1] text-white text-xs font-medium disabled:opacity-50">
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setEditSection(null)}
                          className="flex-1 py-1.5 rounded-lg border border-[#333] text-[#888] text-xs">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ))}
          </div>
        </div>
      </div>

      {/* ── Recurring events ── */}
      <div className="mt-4 bg-[#242424] border border-[#2e2e2e] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-white">Recurring events</div>
            <div className="text-xs text-[#555]">Personal events that repeat on a schedule</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {recurringEvents.map(ev => (
            <div key={ev.event_id}>
              <div className="flex items-center gap-3 py-2 border-b border-[#2a2a2a]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{ev.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs bg-[#2e2e2e] px-2 py-0.5 rounded text-[#888]">
                      {fmtDayLabel(ev.recur_days)}
                    </span>
                    <span className="text-xs text-[#555]">
                      {fmtTime(ev.start_time)} – {fmtTime(ev.end_time)}
                    </span>
                    {ev.recur_end && (
                      <span className="text-xs text-[#555]">ends {ev.recur_end}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setEditEvent(editEvent?.event_id === ev.event_id ? null : ev)}
                  className="w-7 h-7 rounded border border-[#333] flex items-center justify-center text-[#666] hover:text-white text-xs">✎</button>
                <button onClick={() => deleteEvent(ev.event_id)}
                  className="w-7 h-7 rounded border border-[#333] flex items-center justify-center text-red-500 hover:text-red-400 text-xs">✕</button>
              </div>

              {/* Inline edit */}
              {editEvent?.event_id === ev.event_id && (
                <div className="mt-2 p-3 bg-[#1e1e1e] rounded-lg border border-[#333] flex flex-col gap-3">
                  <div className="text-xs text-[#888] font-medium">Edit recurring event — {ev.title}</div>
                  <Field label="Title" value={editEvent.title} onChange={v => setEditEvent(f => f && ({ ...f, title: v }))} />
                  <div>
                    <label className="block text-xs text-[#666] mb-1">Days</label>
                    <DayPicker
                      selected={parseDays(editEvent.recur_days)}
                      onChange={s => setEditEvent(f => f && ({ ...f, recur_days: Array.from(s).join(",") }))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Start time" value={fmtTime(editEvent.start_time)} type="time"
                      onChange={v => setEditEvent(f => f && ({ ...f, start_time: `${editEvent.start_time.slice(0,10)}T${v}:00` }))} />
                    <Field label="End time"   value={fmtTime(editEvent.end_time)}   type="time"
                      onChange={v => setEditEvent(f => f && ({ ...f, end_time: `${editEvent.end_time.slice(0,10)}T${v}:00` }))} />
                    <Field label="Ends on" value={editEvent.recur_end ?? ""} type="date"
                      onChange={v => setEditEvent(f => f && ({ ...f, recur_end: v }))} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEvent} disabled={saving}
                      className="flex-1 py-1.5 rounded-lg bg-[#6366f1] text-white text-xs font-medium disabled:opacity-50">
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button onClick={() => setEditEvent(null)}
                      className="flex-1 py-1.5 rounded-lg border border-[#333] text-[#888] text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Add event form ── */}
        <div className="border-t border-[#2a2a2a] pt-4">
          <div className="text-sm font-semibold text-white mb-1">Add event</div>
          <div className="text-xs text-[#555] mb-3">One-off or repeating personal event</div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title" value={newEvent.title}
                onChange={v => setNewEvent(f => ({ ...f, title: v }))} />
              <Field label="Date" value={newEvent.date} type="date"
                onChange={v => setNewEvent(f => ({ ...f, date: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start time" value={newEvent.start_time} type="time"
                onChange={v => setNewEvent(f => ({ ...f, start_time: v }))} />
              <Field label="End time" value={newEvent.end_time} type="time"
                onChange={v => setNewEvent(f => ({ ...f, end_time: v }))} />
            </div>

            {/* Repeating toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNewEvent(f => ({ ...f, repeating: !f.repeating }))}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  newEvent.repeating ? "bg-[#6366f1]" : "bg-[#2e2e2e]"
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                  newEvent.repeating ? "left-5" : "left-1"
                }`} />
              </button>
              <span className="text-sm text-[#888]">Repeating event</span>
            </div>

            {/* Repeating options */}
            {newEvent.repeating && (
              <div className="flex flex-col gap-2 p-3 bg-[#1e1e1e] rounded-lg border border-[#333]">
                <div>
                  <label className="block text-xs text-[#666] mb-1">Days</label>
                  <DayPicker
                    selected={newEvent.recur_days}
                    onChange={s => setNewEvent(f => ({ ...f, recur_days: s }))}
                  />
                </div>
                <Field label="Ends on" value={newEvent.recur_end} type="date"
                  onChange={v => setNewEvent(f => ({ ...f, recur_end: v }))} />
              </div>
            )}

            <button
              onClick={addEvent}
              disabled={saving || !newEvent.title}
              className="self-end px-5 py-2 rounded-lg bg-[#2e2e2e] border border-[#3a3a3a] text-white text-sm font-medium hover:bg-[#3a3a3a] disabled:opacity-50 transition-colors"
            >
              Add event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
