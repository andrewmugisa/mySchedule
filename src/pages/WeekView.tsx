/**
 * WeekView.tsx — Week page
 * v0 design adapted to Vite + React Router + real API
 * - 5 day columns Mon–Fri
 * - Event cards with course colors
 * - Due this week strip
 */

import { useEffect, useState, useMemo } from "react";
import { api, Event, Assessment, Course, Section, Week, expandRecurring } from "../api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(d: Date): string {
  let h = d.getHours(); const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });
}
function localDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}
function getMonday(d: Date): Date {
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekView() {
  const [monday,      setMonday]      = useState(() => getMonday(new Date()));
  const [events,      setEvents]      = useState<Event[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [weeks,       setWeeks]       = useState<Week[]>([]);
  const [loading,     setLoading]     = useState(true);

  const today = new Date();

  useEffect(() => {
    Promise.all([
      api.events.list(), api.assessments.list(),
      api.courses.list(), api.sections.list(), api.weeks.list(),
    ]).then(([ev, as, co, se, wk]) => {
      setEvents(expandRecurring(ev, wk)); setAssessments(as); setCourses(co);
      setSections(se); setWeeks(wk); setLoading(false);
    }).catch(console.error);
  }, []);

  const courseMap  = useMemo(() => Object.fromEntries(courses.map(c  => [c.course_id,  c])),  [courses]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);

  const weekDays = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
    }),
  [monday]);

  const friday = useMemo(() => {
    const f = new Date(monday); f.setDate(monday.getDate() + 4); return f;
  }, [monday]);

  const currentWeek = useMemo(() => {
    const d = monday.toISOString().slice(0, 10);
    return weeks.find(w => w.start_date <= d && w.end_date >= d);
  }, [weeks, monday]);

  const dueThisWeek = useMemo(() => {
    if (!currentWeek) return [];
    return assessments.filter(a =>
      a.week_number === currentWeek.week_number && parseFloat(a.score) === 0
    );
  }, [assessments, currentWeek]);

  function eventsForDay(day: Date): Event[] {
    const ds = localDate(day.toISOString());
    return events
      .filter(e => localDate(e.start_time) === ds)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  function assessmentsForDay(day: Date): Assessment[] {
    return assessments.filter(a => {
      if (!a.due_date) return false;
      return localDate(a.due_date) === localDate(day.toISOString());
    });
  }

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

  const isCurrentWeek = getMonday(today).toDateString() === monday.toDateString();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>
      Loading…
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid var(--border-dim)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              {currentWeek ? `Week ${currentWeek.week_number} of 15` : ""}
              {currentWeek?.is_break && (
                <span style={{ marginLeft: 10, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-2)" }}>
                  Break Week
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              Week {currentWeek?.week_number ?? "—"}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>
              {monday.toLocaleDateString("en-CA", { month: "long", day: "numeric" })} –{" "}
              {friday.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>

          {/* Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn-icon" onClick={() => { const d = new Date(monday); d.setDate(d.getDate() - 7); setMonday(d); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button
              className="btn"
              onClick={() => setMonday(getMonday(new Date()))}
              style={{
                background: isCurrentWeek ? "var(--accent)" : "transparent",
                color: isCurrentWeek ? "#fff" : "var(--text-2)",
                border: `1px solid ${isCurrentWeek ? "var(--accent)" : "var(--border)"}`,
                padding: "6px 14px",
              }}
            >
              This week
            </button>
            <button className="btn-icon" onClick={() => { const d = new Date(monday); d.setDate(d.getDate() + 7); setMonday(d); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Due this week */}
      {dueThisWeek.length > 0 && (
        <div style={{ margin: "16px 24px 0", padding: "12px 16px", borderRadius: 12, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Due this week</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {dueThisWeek.map(a => {
              const sec    = sectionMap[a.section_id];
              const course = sec ? courseMap[sec.course_id] : null;
              return (
                <span key={a.assessment_id} className="badge"
                  style={{ background: (course?.color ?? "#888") + "18", borderColor: (course?.color ?? "#888") + "35", color: course?.color ?? "#888" }}>
                  {a.title} · {a.due_date ? fmtShortDate(a.due_date) : `Wk ${a.week_number}`} · {a.weight_percent}%
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Day columns */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)", marginBottom: 6 }}>{DAY_LABELS[i]}</div>
                <div style={{
                  fontSize: 20, fontWeight: 700,
                  width: 40, height: 40, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
                  background: isToday ? "var(--accent)" : "transparent",
                  color: isToday ? "#fff" : "var(--text-2)",
                }}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Event cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {weekDays.map((day, i) => {
            const dayEvs  = eventsForDay(day);
            const dayDues = assessmentsForDay(day);
            const isToday = day.toDateString() === today.toDateString();

            return (
              <div
                key={i}
                style={{
                  display: "flex", flexDirection: "column", gap: 8,
                  minHeight: 160, borderRadius: 14, padding: 8,
                  background: isToday ? "rgba(99,102,241,0.04)" : "transparent",
                  border: isToday ? "1px solid rgba(99,102,241,0.15)" : "1px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {/* Events */}
                {dayEvs.map(ev => {
                  const color    = evColor(ev);
                  const label    = evLabel(ev);
                  const start    = new Date(ev.start_time);
                  const end      = new Date(ev.end_time);
                  const personal = ev.type === "PERSONAL";

                  return (
                    <div
                      key={ev.event_id}
                      style={{
                        borderRadius: 10,
                        borderLeft: `3px solid ${color}`,
                        background: personal ? "rgba(255,255,255,0.03)" : `${color}18`,
                        padding: "8px 10px",
                        cursor: "pointer",
                        transition: "filter 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(1.2)")}
                      onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: personal ? "var(--text-4)" : color, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                        {fmt12(start)}–{fmt12(end)}
                      </div>
                    </div>
                  );
                })}

                {/* Due items not tied to an event */}
                {dayDues.map(a => {
                  const sec    = sectionMap[a.section_id];
                  const course = sec ? courseMap[sec.course_id] : null;
                  return (
                    <div
                      key={a.assessment_id}
                      style={{
                        borderRadius: 10,
                        border: `1px solid ${course?.color ?? "#888"}30`,
                        background: `${course?.color ?? "#888"}0d`,
                        padding: "8px 10px",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: course?.color ?? "#888", marginBottom: 2 }}>
                        {course?.short_name} · Due today
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 11, color: course?.color ?? "#888", marginTop: 3 }}>{a.weight_percent}%</div>
                    </div>
                  );
                })}

                {/* Empty */}
                {dayEvs.length === 0 && dayDues.length === 0 && (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-4)" }}>—</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
