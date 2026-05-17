/**
 * WeekView.tsx — Week page
 * 5 day columns (Mon–Fri), event cards per day, due-this-week strip at top
 */

import { useEffect, useState, useMemo } from "react";
import { api, Event, Assessment, Course, Section, Week } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(date: Date): string {
  let h = date.getHours(), m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" });
}

function getMonday(d: Date): Date {
  const day  = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeekView() {
  const [monday,      setMonday]      = useState(() => getMonday(new Date()));
  const [events,      setEvents]      = useState<Event[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [weeks,       setWeeks]       = useState<Week[]>([]);

  const today = new Date();

  useEffect(() => {
    Promise.all([
      api.events.list(),
      api.assessments.list(),
      api.courses.list(),
      api.sections.list(),
      api.weeks.list(),
    ]).then(([ev, as, co, se, wk]) => {
      setEvents(ev);
      setAssessments(as);
      setCourses(co);
      setSections(se);
      setWeeks(wk);
    }).catch(console.error);
  }, []);

  // Lookup maps
  const courseMap  = useMemo(() => Object.fromEntries(courses.map(c => [c.course_id, c])),   [courses]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);

  // The 5 days of the current week (Mon–Fri)
  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  // Current academic week
  const currentWeek = useMemo(() => {
    const d = monday.toISOString().slice(0, 10);
    return weeks.find(w => w.start_date <= d && w.end_date >= d);
  }, [weeks, monday]);

  // Friday of this week
  const friday = useMemo(() => {
    const f = new Date(monday);
    f.setDate(monday.getDate() + 4);
    return f;
  }, [monday]);

  // Due this week
  const dueThisWeek = useMemo(() => {
    if (!currentWeek) return [];
    return assessments.filter(a => a.week_number === currentWeek.week_number && a.score === "0.00");
  }, [assessments, currentWeek]);

  // Events per day
  function eventsForDay(day: Date): Event[] {
    const dayStr = day.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    return events.filter(e => {
      const eStr = new Date(e.start_time).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
      return eStr === dayStr;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  function eventColor(ev: Event): string {
    if (!ev.section_id) return "#555";
    const sec = sectionMap[ev.section_id];
    if (!sec) return "#555";
    return courseMap[sec.course_id]?.color ?? "#555";
  }

  function courseLabel(ev: Event): string {
    if (!ev.section_id) return "Personal";
    const sec    = sectionMap[ev.section_id];
    const course = sec ? courseMap[sec.course_id] : null;
    return course ? `${course.short_name} · ${ev.location ?? ""}` : "";
  }

  // Assessments due on a specific day
  function assessmentsForDay(day: Date): Assessment[] {
    return assessments.filter(a => {
      if (!a.due_date) return false;
      const dStr = new Date(a.due_date).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
      return dStr === day.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    });
  }

  function prevWeek() {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d);
  }

  function nextWeek() {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d);
  }

  function goToday() {
    setMonday(getMonday(new Date()));
  }

  const isCurrentWeek = getMonday(today).toDateString() === monday.toDateString();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-[#2a2a2a] flex items-start justify-between">
        <div>
          <div className="text-xs text-[#666] mb-1">
            {currentWeek ? `Week ${currentWeek.week_number} of 15` : ""}
            {currentWeek?.is_break ? " · 🏖 Break week" : ""}
          </div>
          <h1 className="text-3xl font-bold text-white">
            Week {currentWeek?.week_number ?? "—"}
          </h1>
          <div className="text-sm text-[#666] mt-0.5">
            {monday.toLocaleDateString("en-CA", { month: "long", day: "numeric" })} –{" "}
            {friday.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={prevWeek}
            className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center text-[#888] hover:text-white"
          >‹</button>
          <button
            onClick={goToday}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              isCurrentWeek
                ? "border-[#6366f1] text-[#6366f1]"
                : "border-[#333] text-[#888] hover:text-white"
            }`}
          >
            This week
          </button>
          <button
            onClick={nextWeek}
            className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center text-[#888] hover:text-white"
          >›</button>
        </div>
      </div>

      {/* ── Due this week strip ── */}
      {dueThisWeek.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-lg border border-[#f59e0b44] bg-[#f59e0b0a] flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#f59e0b] flex-shrink-0">Due this week</span>
          {dueThisWeek.map(a => {
            const sec    = sectionMap[a.section_id];
            const course = sec ? courseMap[sec.course_id] : null;
            return (
              <span
                key={a.assessment_id}
                className="text-xs px-2 py-0.5 rounded-full border"
                style={{ borderColor: course?.color + "66", color: course?.color }}
              >
                {a.title} · {a.due_date ? fmtDate(a.due_date) : `Wk ${a.week_number}`} · {a.weight_percent}%
              </span>
            );
          })}
        </div>
      )}

      {/* ── Day columns ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {/* Day headers */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === today.toDateString();
            return (
              <div key={i} className="text-center">
                <div className="text-xs text-[#555]">{DAY_LABELS[i]}</div>
                <div className={`text-lg font-bold mx-auto w-9 h-9 flex items-center justify-center rounded-full ${
                  isToday ? "bg-[#6366f1] text-white" : "text-[#ccc]"
                }`}>
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Event cards grid */}
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map((day, i) => {
            const dayEvs  = eventsForDay(day);
            const dayDues = assessmentsForDay(day);
            const isToday = day.toDateString() === today.toDateString();

            return (
              <div
                key={i}
                className={`flex flex-col gap-2 min-h-32 rounded-lg p-1.5 ${
                  isToday ? "bg-[#1e1e2e]" : ""
                }`}
              >
                {/* Class/personal events */}
                {dayEvs.map(ev => {
                  const color = eventColor(ev);
                  const label = courseLabel(ev);
                  const start = new Date(ev.start_time);
                  const end   = new Date(ev.end_time);
                  const isPersonal = ev.type === "PERSONAL";

                  return (
                    <div
                      key={ev.event_id}
                      className="rounded-lg px-2 py-1.5 cursor-pointer hover:brightness-110 transition-all"
                      style={{
                        backgroundColor: isPersonal ? "#2a2a2a" : color + "22",
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <div className="text-xs truncate mb-0.5" style={{ color: isPersonal ? "#666" : color }}>
                        {label}
                      </div>
                      <div className={`text-sm font-semibold truncate ${isPersonal ? "text-[#666]" : "text-white"}`}>
                        {ev.title}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: isPersonal ? "#444" : color + "cc" }}>
                        {fmt12(start)}–{fmt12(end)}
                      </div>
                      {/* Due chips within this event's day */}
                      {dayDues.filter(a => {
                        const sec = sectionMap[a.section_id];
                        return sec && courseMap[sec.course_id]?.color === color;
                      }).map(a => (
                        <div
                          key={a.assessment_id}
                          className="mt-1 text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: color + "33", color }}
                        >
                          {a.title} · {a.weight_percent}%
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Due items not attached to an event */}
                {dayDues.filter(a => {
                  const sec    = sectionMap[a.section_id];
                  const course = sec ? courseMap[sec.course_id] : null;
                  return !dayEvs.some(ev => {
                    const evSec = ev.section_id ? sectionMap[ev.section_id] : null;
                    return evSec && courseMap[evSec.course_id]?.color === course?.color;
                  });
                }).map(a => {
                  const sec    = sectionMap[a.section_id];
                  const course = sec ? courseMap[sec.course_id] : null;
                  return (
                    <div
                      key={a.assessment_id}
                      className="rounded-lg px-2 py-1.5 border"
                      style={{ borderColor: course?.color + "44", backgroundColor: course?.color + "11" }}
                    >
                      <div className="text-xs truncate" style={{ color: course?.color }}>
                        {course?.short_name} · Due today
                      </div>
                      <div className="text-sm font-semibold text-white truncate">{a.title}</div>
                      <div className="text-xs" style={{ color: course?.color + "aa" }}>{a.weight_percent}%</div>
                    </div>
                  );
                })}

                {/* Empty day placeholder */}
                {dayEvs.length === 0 && dayDues.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs text-[#333]">—</span>
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
