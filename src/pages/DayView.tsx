/**
 * DayView.tsx — Today page
 * - Full-width week strip with proper spacing
 * - Event cards: light tint bg, time as top-right badge, colored left border
 * - Click → popover with cancel/delete
 * - Right panel: grades, upcoming, weekly knowledge
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { api, Event, Assessment, Course, Section, Week, WeeklyKnowledge } from "../api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function toMins(d: Date) { return d.getHours() * 60 + d.getMinutes(); }

function fmt12(d: Date): string {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

function fmtBadge(d: Date): string {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${m ? `:${String(m).padStart(2,"0")}` : ""} ${ap}`;
}

function localDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

// Spine config
const START_HOUR  = 6;
const END_HOUR    = 24;
const SLOT_MINS   = 30;
const SLOT_PX     = 56;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINS;

// ── Event popover ─────────────────────────────────────────────────────────────

function EventPopover({ event, color, label, onClose, onCancel, onDelete }: {
  event: Event; color: string; label: string;
  onClose: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelled = event.is_cancelled;

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    setTimeout(() => document.addEventListener("mousedown", h), 50);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div
      ref={ref}
      className="popover"
      style={{ position: "absolute", top: 0, left: "calc(100% + 10px)", zIndex: 50 }}
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 min-w-0">
          <div className="text-xs mb-0.5" style={{ color }}>{label}</div>
          <div className={`text-sm font-semibold leading-tight ${cancelled ? "line-through text-[#444]" : "text-white"}`}>
            {event.title}
          </div>
          <div className="text-xs text-[#555] mt-0.5">
            {fmt12(new Date(event.start_time))} – {fmt12(new Date(event.end_time))}
          </div>
          {event.location && <div className="text-xs text-[#444] mt-0.5">📍 {event.location}</div>}
          {cancelled && <div className="text-xs text-orange-400 mt-1 font-medium">Cancelled</div>}
        </div>
        <button onClick={onClose} className="text-[#333] hover:text-white text-sm flex-shrink-0 ml-1">✕</button>
      </div>
      <div className="flex flex-col gap-1">
        <button onClick={onCancel}
          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            cancelled ? "text-green-400 hover:bg-green-400/10" : "text-orange-400 hover:bg-orange-400/10"
          }`}>
          {cancelled ? "↩ Restore to schedule" : "⊘ Cancel this event"}
        </button>
        <button onClick={onDelete}
          className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors">
          🗑 Delete permanently
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function DayView() {
  const [now,         setNow]         = useState(new Date());
  const [selected,    setSelected]    = useState(new Date());
  const [events,      setEvents]      = useState<Event[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [weeks,       setWeeks]       = useState<Week[]>([]);
  const [knowledge,   setKnowledge]   = useState<WeeklyKnowledge[]>([]);
  const [popover,     setPopover]     = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      api.events.list(), api.assessments.list(), api.courses.list(),
      api.sections.list(), api.weeks.list(), api.knowledge.list(),
    ]).then(([ev, as, co, se, wk, kn]) => {
      setEvents(ev); setAssessments(as); setCourses(co);
      setSections(se); setWeeks(wk); setKnowledge(kn);
    }).catch(console.error);
  }, []);

  const courseMap  = useMemo(() => Object.fromEntries(courses.map(c  => [c.course_id,  c])),  [courses]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);

  const currentWeek = useMemo(() => {
    const d = selected.toISOString().slice(0, 10);
    return weeks.find(w => w.start_date <= d && w.end_date >= d);
  }, [weeks, selected]);

  // Mon–Sun strip of the selected week
  const weekStrip = useMemo(() => {
    const day = selected.getDay();
    const mon = new Date(selected);
    mon.setDate(selected.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
    });
  }, [selected]);

  const dayEvents = useMemo(() => {
    const sel = localDate(selected.toISOString());
    return events
      .filter(e => localDate(e.start_time) === sel)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [events, selected]);

  const dueThisWeek = useMemo(() => {
    if (!currentWeek) return [];
    return assessments.filter(a => a.week_number === currentWeek.week_number && parseFloat(a.score) === 0);
  }, [assessments, currentWeek]);

  const upcoming = useMemo(() =>
    assessments.filter(a => parseFloat(a.score) === 0)
      .sort((a, b) => (a.week_number ?? 99) - (b.week_number ?? 99))
      .slice(0, 3),
  [assessments]);

  const weekKnowledge = useMemo(() => {
    if (!currentWeek) return [];
    return knowledge.filter(k => k.week_number === currentWeek.week_number);
  }, [knowledge, currentWeek]);

  const gradeSummary = useMemo(() =>
    courses.map(course => {
      const secIds = sections.filter(s => s.course_id === course.course_id).map(s => s.section_id);
      const cas    = assessments.filter(a => secIds.includes(a.section_id));
      const earned = cas.reduce((s, a) => s + parseFloat(a.score), 0);
      const total  = cas.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
      return { course, pct: total > 0 ? Math.round((earned / total) * 100) : 0 };
    }),
  [courses, sections, assessments]);

  // Overlap layout
  function layout(evs: Event[]) {
    const placed: { ev: Event; col: number; cols: number }[] = [];
    for (const ev of evs) {
      const s = new Date(ev.start_time).getTime();
      const e = new Date(ev.end_time).getTime();
      const overlapping = placed.filter(p => {
        const ps = new Date(p.ev.start_time).getTime();
        const pe = new Date(p.ev.end_time).getTime();
        return s < pe && e > ps;
      });
      const used = new Set(overlapping.map(p => p.col));
      let col = 0; while (used.has(col)) col++;
      const cols = Math.max(col + 1, ...overlapping.map(p => p.col + 1));
      overlapping.forEach(p => { p.cols = Math.max(p.cols, cols); });
      placed.push({ ev, col, cols });
    }
    return placed;
  }

  const laid = useMemo(() => layout(dayEvents), [dayEvents]);

  function evColor(ev: Event): string {
    if (!ev.section_id) return "#666";
    const sec = sectionMap[ev.section_id];
    return sec ? (courseMap[sec.course_id]?.color ?? "#666") : "#666";
  }

  function evLabel(ev: Event): string {
    if (!ev.section_id) return "Personal";
    const sec = sectionMap[ev.section_id];
    const c   = sec ? courseMap[sec.course_id] : null;
    return c ? `${c.short_name} · ${ev.location ?? ""}` : "";
  }

  const isToday   = localDate(selected.toISOString()) === localDate(now.toISOString());
  const nowMins   = toMins(now) - START_HOUR * 60;
  const nowTopPx  = (nowMins / SLOT_MINS) * SLOT_PX;
  const totalH    = TOTAL_SLOTS * SLOT_PX;

  async function cancelEvent(ev: Event) {
    await api.events.update(ev.event_id, { ...ev, is_cancelled: !ev.is_cancelled });
    setEvents(prev => prev.map(e => e.event_id === ev.event_id ? { ...e, is_cancelled: !e.is_cancelled } : e));
    setPopover(null);
  }

  async function deleteEvent(ev: Event) {
    if (!confirm("Delete permanently?")) return;
    await api.events.delete(ev.event_id);
    setEvents(prev => prev.filter(e => e.event_id !== ev.event_id));
    setPopover(null);
  }

  // Spine slots
  const spineSlots = useMemo(() =>
    Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => {
      const totalMins = START_HOUR * 60 + i * SLOT_MINS;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const showLabel = m === 0;
      const label = showLabel
        ? `${h === 12 ? 12 : h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`
        : "";
      return { label, showLabel, topPx: i * SLOT_PX };
    }),
  []);

  return (
    <div className="flex h-full" style={{ background: "#000" }}>

      {/* ── LEFT: Schedule ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Date header */}
        <div className="px-8 pt-7 pb-5" style={{ borderBottom: "1px solid #141414" }}>
          <div className="text-xs text-[#3a3a3a] mb-2 uppercase tracking-widest font-medium">
            {DAYS[selected.getDay()]}
          </div>
          <h1 className="text-5xl font-bold text-white leading-none tracking-tight">
            {MONTHS[selected.getMonth()]} {selected.getDate()},
            <span className="text-3xl font-light text-[#2a2a2a] ml-3">{selected.getFullYear()}</span>
          </h1>

          {/* Week strip */}
          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={() => { const d = new Date(selected); d.setDate(d.getDate() - 7); setSelected(d); }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#333] hover:text-white border border-[#1a1a1a] hover:border-[#333] transition-all flex-shrink-0"
            >‹</button>

            {/* 7 day buttons — spread full width */}
            <div className="flex flex-1 justify-between">
              {weekStrip.map((d, i) => {
                const isSel = d.toDateString() === selected.toDateString();
                const isNow = d.toDateString() === now.toDateString();
                const hasEv = events.some(e => localDate(e.start_time) === localDate(d.toISOString()));
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(new Date(d))}
                    className="flex flex-col items-center py-2 px-3 rounded-2xl transition-all"
                    style={{
                      background: isSel ? "#6366f1" : "transparent",
                      minWidth: 52,
                    }}
                  >
                    <span className="text-xs font-medium mb-1" style={{
                      color: isSel ? "#c7c9ff" : "#3a3a3a"
                    }}>
                      {DAYS[d.getDay()]}
                    </span>
                    <span className="text-lg font-bold leading-none" style={{
                      color: isSel ? "#fff" : isNow ? "#6366f1" : "#999"
                    }}>
                      {d.getDate()}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full mt-1.5"
                      style={{ background: hasEv && !isSel ? "#2a2a2a" : "transparent" }}
                    />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => { const d = new Date(selected); d.setDate(d.getDate() + 7); setSelected(d); }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#333] hover:text-white border border-[#1a1a1a] hover:border-[#333] transition-all flex-shrink-0"
            >›</button>

            <button
              onClick={() => setSelected(new Date())}
              className="px-4 py-1.5 rounded-xl border border-[#1a1a1a] text-xs text-[#444] hover:text-white hover:border-[#333] transition-all flex-shrink-0"
            >
              Today
            </button>
          </div>
        </div>

        {/* Due this week */}
        {dueThisWeek.length > 0 && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-2xl" style={{ background: "#0f0900", border: "1px solid #2a1a00" }}>
            <div className="text-xs text-orange-500 font-semibold mb-2 uppercase tracking-wider">Due this week</div>
            <div className="flex flex-wrap gap-2">
              {dueThisWeek.map(a => {
                const sec    = sectionMap[a.section_id];
                const course = sec ? courseMap[sec.course_id] : null;
                return (
                  <span key={a.assessment_id} className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{
                      background: (course?.color ?? "#888") + "1a",
                      border:     `1px solid ${course?.color ?? "#888"}33`,
                      color:      course?.color ?? "#888",
                    }}>
                    {a.title} · {a.due_date
                      ? new Date(a.due_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" })
                      : `Wk ${a.week_number}`
                    } · {a.weight_percent}%
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Time spine ── */}
        <div className="flex-1 overflow-y-auto px-6 pt-4 pb-16">
          <div className="relative" style={{ height: totalH }}>

            {/* Vertical spine line */}
            <div style={{
              position: "absolute",
              left: 82, top: 8, bottom: 8, width: 1,
              background: "#141414",
            }} />

            {/* Slots */}
            {spineSlots.map(({ label, showLabel, topPx }, i) => (
              <div key={i} className="absolute flex items-center" style={{ top: topPx, left: 0, right: 0, height: 1 }}>
                {/* Time label */}
                <div style={{ width: 68, textAlign: "right", flexShrink: 0, paddingRight: 8 }}>
                  {showLabel && (
                    <span style={{ fontSize: 11, color: "#333", fontWeight: 500, letterSpacing: "0.02em" }}>
                      {label}
                    </span>
                  )}
                </div>
                {/* Dot */}
                <div style={{
                  width: showLabel ? 9 : 6,
                  height: showLabel ? 9 : 6,
                  borderRadius: "50%",
                  border: `1.5px solid ${showLabel ? "#282828" : "#1e1e1e"}`,
                  background: "#000",
                  flexShrink: 0,
                  zIndex: 2,
                }} />
              </div>
            ))}

            {/* Now line */}
            {isToday && nowMins >= 0 && nowTopPx < totalH && (
              <div className="absolute flex items-center" style={{ top: nowTopPx, left: 0, right: 0, zIndex: 10 }}>
                <div style={{ width: 68, textAlign: "right", paddingRight: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>Now</span>
                </div>
                <div style={{
                  width: 11, height: 11, borderRadius: "50%",
                  background: "#ef4444", flexShrink: 0,
                  boxShadow: "0 0 8px #ef4444aa",
                }} />
                <div style={{ flex: 1, height: 1, background: "#ef444466" }} />
              </div>
            )}

            {/* Event cards */}
            <div style={{ position: "absolute", left: 94, right: 0, top: 0, bottom: 0 }}>
              {laid.map(({ ev, col, cols }) => {
                const start     = new Date(ev.start_time);
                const end       = new Date(ev.end_time);
                const startMins = toMins(start) - START_HOUR * 60;
                const endMins   = toMins(end)   - START_HOUR * 60;
                const topPx     = (startMins / SLOT_MINS) * SLOT_PX;
                const heightPx  = Math.max((endMins - startMins) / SLOT_MINS * SLOT_PX, 32);
                const gutter    = 4;
                const colW      = `calc(${100 / cols}% - ${gutter}px)`;
                const leftPct   = `calc(${(col / cols) * 100}% + ${col > 0 ? gutter / 2 : 0}px)`;
                const color     = evColor(ev);
                const label     = evLabel(ev);
                const personal  = ev.type === "PERSONAL";
                const cancelled = ev.is_cancelled;

                return (
                  <div key={ev.event_id} style={{ position: "absolute", top: topPx, height: heightPx, width: colW, left: leftPct, zIndex: popover === ev.event_id ? 30 : 1 }}>
                    {/* Card */}
                    <div
                      onClick={() => setPopover(p => p === ev.event_id ? null : ev.event_id)}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 12,
                        borderLeft: `3px solid ${cancelled ? "#2a2a2a" : color}`,
                        background: personal
                          ? "rgba(255,255,255,0.04)"
                          : `${color}20`,
                        opacity: cancelled ? 0.4 : 1,
                        cursor: "pointer",
                        padding: "6px 10px",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                        overflow: "hidden",
                        transition: "filter 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.2)")}
                      onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
                    >
                      {/* Time badge — top right */}
                      <div style={{
                        position: "absolute",
                        top: 6, right: 8,
                        fontSize: 10,
                        fontWeight: 600,
                        color: cancelled ? "#333" : `${color}cc`,
                        background: cancelled ? "transparent" : `${color}18`,
                        border: `1px solid ${cancelled ? "transparent" : `${color}33`}`,
                        borderRadius: 6,
                        padding: "1px 6px",
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                      }}>
                        {fmtBadge(start)}–{fmtBadge(end)}
                      </div>

                      {/* Label */}
                      <div style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: personal ? "#444" : cancelled ? "#333" : color,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 2,
                        paddingRight: 80,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {label}
                      </div>

                      {/* Title */}
                      <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: cancelled ? "#333" : "#fff",
                        textDecoration: cancelled ? "line-through" : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        paddingRight: 80,
                      }}>
                        {ev.title}
                      </div>
                    </div>

                    {/* Popover */}
                    {popover === ev.event_id && (
                      <EventPopover
                        event={ev} color={color} label={label}
                        onClose={() => setPopover(null)}
                        onCancel={() => cancelEvent(ev)}
                        onDelete={() => deleteEvent(ev)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT panel ── */}
      <div className="hide-mobile flex-shrink-0 overflow-y-auto py-7 px-5 flex flex-col gap-7"
        style={{ width: 260, borderLeft: "1px solid #111", background: "#050505" }}>

        {/* Grade summary */}
        <section>
          <h2 style={{ fontSize: 10, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 14 }}>
            Grade summary
          </h2>
          <div className="flex flex-col gap-3">
            {gradeSummary.map(({ course, pct }) => (
              <div key={course.course_id} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: course.color }} />
                <span style={{ fontSize: 13, color: "#555", flex: 1 }}>{course.short_name}</span>
                <div style={{ width: 80, height: 3, background: "#151515", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", backgroundColor: course.color, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 12, color: "#444", width: 32, textAlign: "right" }}>{pct}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming */}
        <section>
          <h2 style={{ fontSize: 10, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 14 }}>
            Upcoming
          </h2>
          <div className="flex flex-col gap-4">
            {upcoming.map(a => {
              const sec    = sectionMap[a.section_id];
              const course = sec ? courseMap[sec.course_id] : null;
              return (
                <div key={a.assessment_id} className="flex items-start gap-2.5">
                  <div style={{ width: 3, borderRadius: 99, background: course?.color ?? "#222", flexShrink: 0, alignSelf: "stretch", minHeight: 36 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#ddd", fontWeight: 500 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>
                      {course?.short_name} · {a.due_date
                        ? new Date(a.due_date).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" })
                        : `Wk ${a.week_number}`}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: (course?.color ?? "#888") + "20",
                    color: course?.color ?? "#888",
                    border: `1px solid ${course?.color ?? "#888"}33`,
                    borderRadius: 6, padding: "2px 6px", flexShrink: 0,
                  }}>
                    {a.weight_percent}%
                  </span>
                </div>
              );
            })}
            {upcoming.length === 0 && <p style={{ fontSize: 12, color: "#222" }}>Nothing pending.</p>}
          </div>
        </section>

        {/* Weekly knowledge */}
        {weekKnowledge.length > 0 && (
          <section>
            <h2 style={{ fontSize: 10, color: "#2a2a2a", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 14 }}>
              Wk {currentWeek?.week_number} — know this
            </h2>
            <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 14, padding: 14 }}>
              {weekKnowledge.map(wk => {
                const course = courseMap[wk.course_id];
                return (
                  <div key={wk.knowledge_id} className="mb-3 last:mb-0">
                    <div style={{ fontSize: 11, fontWeight: 700, color: course?.color, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {course?.short_name}
                    </div>
                    {wk.topics.map((t, i) => (
                      <div key={i} className="mb-2">
                        <div style={{ fontSize: 13, color: "#bbb", fontWeight: 500 }}>{t.topic}</div>
                        <div style={{ fontSize: 11, color: "#3a3a3a", marginTop: 2 }}>{t.subtopics.join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
