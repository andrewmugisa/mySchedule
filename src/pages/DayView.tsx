/**
 * DayView.tsx — Today page
 * v0 design adapted to Vite + React Router + real API
 * - Time spine with circle dots + vertical line
 * - Event cards: tinted bg, colored border, time badge top-right
 * - Click → popover (cancel / delete)
 * - Right panel: grades, upcoming, weekly knowledge
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { api, Event, Assessment, Course, Section, Week, WeeklyKnowledge, expandRecurring } from "../api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMins(d: Date) { return d.getHours() * 60 + d.getMinutes(); }

function fmt12(d: Date): string {
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtBadge(d: Date): string {
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""} ${ap}`;
}
function localDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}
function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });
}

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// Spine
const START_HOUR  = 6;
const END_HOUR    = 24;
const SLOT_MINS   = 30;
const SLOT_PX     = 64;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINS;

// ── Event Popover ─────────────────────────────────────────────────────────────

function EventPopover({ event, color, label, onClose, onCancel, onDelete }: {
  event: Event; color: string; label: string;
  onClose: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    setTimeout(() => document.addEventListener("mousedown", h), 60);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const cancelled = event.is_cancelled;
  return (
    <div ref={ref} className="popover" style={{ top: 0, left: "calc(100% + 10px)" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, borderRadius: 99, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: cancelled ? "var(--text-3)" : "var(--text)", textDecoration: cancelled ? "line-through" : "none" }}>
            {event.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
            {fmt12(new Date(event.start_time))} – {fmt12(new Date(event.end_time))}
          </div>
          {event.location && <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>📍 {event.location}</div>}
          {cancelled && <div style={{ fontSize: 11, color: "var(--orange)", marginTop: 4, fontWeight: 500 }}>Cancelled</div>}
        </div>
        <button onClick={onClose} className="btn-icon" style={{ width: 24, height: 24, flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button
          onClick={onCancel}
          style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", background: "none", border: "none", color: cancelled ? "var(--green)" : "var(--orange)", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          {cancelled ? "↩ Restore to schedule" : "⊘ Cancel this event"}
        </button>
        <button
          onClick={onDelete}
          style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", background: "none", border: "none", color: "var(--red)", transition: "background 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}
        >
          🗑 Delete permanently
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([
      api.events.list(), api.assessments.list(), api.courses.list(),
      api.sections.list(), api.weeks.list(), api.knowledge.list(),
    ]).then(([ev, as, co, se, wk, kn]) => {
      setEvents(expandRecurring(ev, wk)); setAssessments(as); setCourses(co);
      setSections(se); setWeeks(wk); setKnowledge(kn);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const courseMap  = useMemo(() => Object.fromEntries(courses.map(c  => [c.course_id,  c])),  [courses]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);

  const currentWeek = useMemo(() => {
    const d = selected.toISOString().slice(0, 10);
    return weeks.find(w => w.start_date <= d && w.end_date >= d);
  }, [weeks, selected]);

  // Mon–Sun strip
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
      .slice(0, 4),
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
      const over = placed.filter(p => {
        const ps = new Date(p.ev.start_time).getTime();
        const pe = new Date(p.ev.end_time).getTime();
        return s < pe && e > ps;
      });
      const used = new Set(over.map(p => p.col));
      let col = 0; while (used.has(col)) col++;
      const cols = Math.max(col + 1, ...over.map(p => p.col + 1));
      over.forEach(p => { p.cols = Math.max(p.cols, cols); });
      placed.push({ ev, col, cols });
    }
    return placed;
  }
  const laid = useMemo(() => layout(dayEvents), [dayEvents]);

  function evColor(ev: Event): string {
    if (!ev.section_id) return "#71717a";
    const sec = sectionMap[ev.section_id];
    return sec ? (courseMap[sec.course_id]?.color ?? "#71717a") : "#71717a";
  }
  function evLabel(ev: Event): string {
    if (!ev.section_id) return "Personal";
    const sec = sectionMap[ev.section_id];
    const c   = sec ? courseMap[sec.course_id] : null;
    return c ? `${c.short_name}${ev.location ? ` · ${ev.location}` : ""}` : "";
  }

  const isToday  = localDate(selected.toISOString()) === localDate(now.toISOString());
  const nowMins  = toMins(now) - START_HOUR * 60;
  const nowTopPx = (nowMins / SLOT_MINS) * SLOT_PX;
  const totalH   = TOTAL_SLOTS * SLOT_PX;

  async function cancelEvent(ev: Event) {
    await api.events.update(ev.event_id, { ...ev, is_cancelled: !ev.is_cancelled });
    setEvents(prev => prev.map(e => e.event_id === ev.event_id ? { ...e, is_cancelled: !e.is_cancelled } : e));
    setPopover(null);
  }
  async function deleteEvent(ev: Event) {
    if (!confirm("Delete this event permanently?")) return;
    await api.events.delete(ev.event_id);
    setEvents(prev => prev.filter(e => e.event_id !== ev.event_id));
    setPopover(null);
  }

  const spineSlots = useMemo(() =>
    Array.from({ length: TOTAL_SLOTS + 1 }, (_, i) => {
      const totalMins = START_HOUR * 60 + i * SLOT_MINS;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const isHour = m === 0;
      const label  = isHour ? `${h === 12 ? 12 : h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}` : "";
      return { label, isHour, topPx: i * SLOT_PX };
    }),
  []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
      Loading…
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── LEFT: Schedule ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* Header */}
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border-dim)", flexShrink: 0 }}>
          {/* Day label */}
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            {DAYS[selected.getDay()]}
          </div>
          {/* Date */}
          <h1 style={{ fontSize: 40, fontWeight: 700, color: "var(--text)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {MONTHS[selected.getMonth()]} {selected.getDate()}
            <span style={{ fontSize: 24, fontWeight: 300, color: "var(--text-3)", marginLeft: 12 }}>{selected.getFullYear()}</span>
          </h1>

          {/* Week strip + nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
            {/* Prev week */}
            <button className="btn-icon" style={{ flexShrink: 0 }}
              onClick={() => { const d = new Date(selected); d.setDate(d.getDate() - 7); setSelected(d); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            {/* 7 days */}
            <div style={{ display: "flex", flex: 1, justifyContent: "space-between" }}>
              {weekStrip.map((d, i) => {
                const isSel = d.toDateString() === selected.toDateString();
                const isNow = d.toDateString() === now.toDateString();
                const hasEv = events.some(e => localDate(e.start_time) === localDate(d.toISOString()));
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(new Date(d))}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "8px 10px", borderRadius: 14, cursor: "pointer", border: "none",
                      background: isSel ? "var(--accent)" : "transparent",
                      transition: "all 0.15s",
                      minWidth: 44,
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--bg-hover)"; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 500, marginBottom: 4, color: isSel ? "rgba(255,255,255,0.7)" : "var(--text-3)" }}>
                      {DAYS[d.getDay()]}
                    </span>
                    <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1, color: isSel ? "#fff" : isNow ? "var(--accent)" : "var(--text-3)" }}>
                      {d.getDate()}
                    </span>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", marginTop: 4, background: hasEv && !isSel ? "var(--border-strong)" : "transparent" }} />
                  </button>
                );
              })}
            </div>

            {/* Next week */}
            <button className="btn-icon" style={{ flexShrink: 0 }}
              onClick={() => { const d = new Date(selected); d.setDate(d.getDate() + 7); setSelected(d); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            {/* Today */}
            <button className="btn btn-ghost" style={{ padding: "6px 14px", flexShrink: 0 }}
              onClick={() => setSelected(new Date())}>
              Today
            </button>
          </div>
        </div>

        {/* Due this week strip */}
        {dueThisWeek.length > 0 && (
          <div style={{ margin: "16px 24px 0", padding: "12px 16px", borderRadius: 12, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Due this week</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {dueThisWeek.map(a => {
                const sec    = sectionMap[a.section_id];
                const course = sec ? courseMap[sec.course_id] : null;
                return (
                  <span key={a.assessment_id} className="badge" style={{ background: (course?.color ?? "#888") + "18", borderColor: (course?.color ?? "#888") + "35", color: course?.color ?? "#888" }}>
                    {a.title} · {a.due_date ? fmtShortDate(a.due_date) : `Wk ${a.week_number}`} · {a.weight_percent}%
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Time spine */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 80px" }}>
          <div style={{ position: "relative", height: totalH }}>

            {/* Spine vertical line */}
            <div style={{ position: "absolute", left: 76, top: 8, bottom: 8, width: 1, background: "var(--border-dim)" }} />

            {/* Slots */}
            {spineSlots.map(({ label, isHour, topPx }, i) => (
              <div key={i} style={{ position: "absolute", top: topPx, left: 0, right: 0, display: "flex", alignItems: "center", height: 1 }}>
                {/* Time label */}
                <div style={{ width: 62, textAlign: "right", paddingRight: 8, flexShrink: 0 }}>
                  {isHour && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-4)", letterSpacing: "0.02em" }}>{label}</span>
                  )}
                </div>
                {/* Dot */}
                <div style={{
                  width:        isHour ? 10 : 6,
                  height:       isHour ? 10 : 6,
                  borderRadius: "50%",
                  border:       `1.5px solid ${isHour ? "var(--border)" : "var(--border-dim)"}`,
                  background:   "var(--bg)",
                  flexShrink:   0,
                  zIndex:       2,
                  marginLeft:   isHour ? -1 : 1,
                }} />
              </div>
            ))}

            {/* Now line */}
            {isToday && nowMins >= 0 && nowTopPx < totalH && (
              <div style={{ position: "absolute", top: nowTopPx, left: 0, right: 0, display: "flex", alignItems: "center", zIndex: 10 }}>
                <div style={{ width: 62, textAlign: "right", paddingRight: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)" }}>Now</span>
                </div>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--red)", flexShrink: 0, boxShadow: "0 0 8px rgba(239,68,68,0.5)", marginLeft: -2 }} />
                <div style={{ flex: 1, height: 1, background: "rgba(239,68,68,0.4)" }} />
              </div>
            )}

            {/* Event cards */}
            <div style={{ position: "absolute", left: 90, right: 0, top: 0, bottom: 0 }}>
              {laid.map(({ ev, col, cols }) => {
                const start     = new Date(ev.start_time);
                const end       = new Date(ev.end_time);
                const startMins = toMins(start) - START_HOUR * 60;
                const endMins   = toMins(end)   - START_HOUR * 60;
                const topPx     = (startMins / SLOT_MINS) * SLOT_PX;
                const heightPx  = Math.max((endMins - startMins) / SLOT_MINS * SLOT_PX, 36);
                const gap       = 5;
                const colW      = `calc(${100 / cols}% - ${gap}px)`;
                const leftPct   = `calc(${(col / cols) * 100}% + ${col > 0 ? gap / 2 : 0}px)`;
                const color     = evColor(ev);
                const label     = evLabel(ev);
                const personal  = ev.type === "PERSONAL";
                const cancelled = ev.is_cancelled;

                return (
                  <div
                    key={ev.event_id}
                    style={{ position: "absolute", top: topPx, height: heightPx, width: colW, left: leftPct, zIndex: popover === ev.event_id ? 30 : 1 }}
                  >
                    {/* Card */}
                    <div
                      onClick={() => setPopover(p => p === ev.event_id ? null : ev.event_id)}
                      style={{
                        width: "100%", height: "100%",
                        borderRadius: 10,
                        borderLeft: `3px solid ${cancelled ? "var(--border-strong)" : color}`,
                        background: personal ? "rgba(255,255,255,0.03)" : `${color}18`,
                        opacity: cancelled ? 0.45 : 1,
                        cursor: "pointer",
                        padding: "7px 10px",
                        position: "relative",
                        overflow: "hidden",
                        transition: "filter 0.15s, transform 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.2)"; e.currentTarget.style.transform = "translateX(1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; e.currentTarget.style.transform = "translateX(0)"; }}
                    >
                      {/* Time badge — top right */}
                      <div style={{
                        position: "absolute", top: 6, right: 8,
                        fontSize: 10, fontWeight: 600,
                        color: personal ? "var(--text-4)" : `${color}cc`,
                        background: personal ? "var(--bg-hover)" : `${color}18`,
                        border: `1px solid ${personal ? "var(--border-dim)" : `${color}30`}`,
                        borderRadius: 6, padding: "1px 6px",
                        whiteSpace: "nowrap",
                      }}>
                        {fmtBadge(start)}–{fmtBadge(end)}
                      </div>

                      {/* Course label */}
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        color: personal ? "var(--text-4)" : cancelled ? "var(--text-4)" : color,
                        marginBottom: 2, paddingRight: 80,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {label}
                      </div>

                      {/* Title */}
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: cancelled ? "var(--text-4)" : "var(--text)",
                        textDecoration: cancelled ? "line-through" : "none",
                        paddingRight: 80,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
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
      <div
        className="hide-mobile"
        style={{ width: 268, flexShrink: 0, overflowY: "auto", borderLeft: "1px solid var(--border-dim)", background: "#0a0a0c", padding: "28px 20px", display: "flex", flexDirection: "column", gap: 28 }}
      >
        {/* Grade summary */}
        <section>
          <div className="section-label" style={{ marginBottom: 14 }}>Grade summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {gradeSummary.map(({ course, pct }) => (
              <div key={course.course_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: course.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--text-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.short_name}</span>
                <div style={{ width: 72, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: course.color, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 11, color: "var(--text-3)", width: 30, textAlign: "right" }}>{pct}%</span>
              </div>
            ))}
            {gradeSummary.length === 0 && <p style={{ fontSize: 12, color: "var(--text-4)" }}>No courses yet.</p>}
          </div>
        </section>

        {/* Upcoming */}
        <section>
          <div className="section-label" style={{ marginBottom: 14 }}>Upcoming</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcoming.map(a => {
              const sec    = sectionMap[a.section_id];
              const course = sec ? courseMap[sec.course_id] : null;
              return (
                <div key={a.assessment_id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 3, minHeight: 36, borderRadius: 99, background: course?.color ?? "var(--border)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      {course?.short_name} · {a.due_date ? fmtShortDate(a.due_date) : `Wk ${a.week_number}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: (course?.color ?? "#888") + "20", border: `1px solid ${(course?.color ?? "#888")}30`, color: course?.color ?? "#888", flexShrink: 0 }}>
                    {a.weight_percent}%
                  </span>
                </div>
              );
            })}
            {upcoming.length === 0 && <p style={{ fontSize: 12, color: "var(--text-4)" }}>Nothing pending.</p>}
          </div>
        </section>

        {/* Weekly knowledge */}
        {weekKnowledge.length > 0 && (
          <section>
            <div className="section-label" style={{ marginBottom: 14 }}>Wk {currentWeek?.week_number} — know this</div>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-dim)", borderRadius: 12, padding: 14 }}>
              {weekKnowledge.map(wk => {
                const course = courseMap[wk.course_id];
                return (
                  <div key={wk.knowledge_id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: course?.color, marginBottom: 6 }}>
                      {course?.short_name}
                    </div>
                    {wk.topics.map((t, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{t.topic}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{t.subtopics.join(" · ")}</div>
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
