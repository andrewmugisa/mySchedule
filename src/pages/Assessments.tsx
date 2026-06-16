/**
 * Assessments.tsx — All assessments page
 * v0 design adapted to Vite + React Router + real API
 * - Stats bar, filter chips, grouped by week descending
 * - Checkbox to toggle score
 */

import { useEffect, useState, useMemo } from "react";
import { api, Assessment, Course, Section, Week } from "../api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDue(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Assessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [weeks,       setWeeks]       = useState<Week[]>([]);
  const [loading,     setLoading]     = useState(true);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [courseFilter, setCourseFilter] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.assessments.list(), api.courses.list(),
      api.sections.list(), api.weeks.list(),
    ]).then(([as, co, se, wk]) => {
      setAssessments(as); setCourses(co); setSections(se); setWeeks(wk);
      setLoading(false);
    }).catch(console.error);
  }, []);

  const courseMap  = useMemo(() => Object.fromEntries(courses.map(c  => [c.course_id,  c])),  [courses]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);
  const weekMap    = useMemo(() => Object.fromEntries(weeks.map(w    => [w.week_number, w])), [weeks]);

  async function toggleScore(a: Assessment) {
    const newScore = parseFloat(a.score) > 0 ? "0" : a.weight_percent;
    await api.assessments.update(a.assessment_id, { ...a, score: newScore } as any);
    setAssessments(prev => prev.map(x =>
      x.assessment_id === a.assessment_id ? { ...x, score: String(newScore) } : x
    ));
  }

  // Stats
  const total      = assessments.length;
  const completed  = assessments.filter(a => parseFloat(a.score) > 0).length;
  const pending    = assessments.filter(a => parseFloat(a.score) === 0).length;
  const gradeSoFar = useMemo(() => {
    const earned   = assessments.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible = assessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    return possible > 0 ? Math.round((earned / possible) * 100) : 0;
  }, [assessments]);

  // Filtered
  const filtered = useMemo(() => assessments.filter(a => {
    const done = parseFloat(a.score) > 0;
    if (statusFilter === "pending"   && done)  return false;
    if (statusFilter === "completed" && !done) return false;
    if (courseFilter !== null) {
      const sec = sectionMap[a.section_id];
      if (!sec || sec.course_id !== courseFilter) return false;
    }
    return true;
  }), [assessments, statusFilter, courseFilter, sectionMap]);

  // Group by week descending
  const grouped = useMemo(() => {
    const map = new Map<number, Assessment[]>();
    for (const a of filtered) {
      const wn = a.week_number ?? 0;
      if (!map.has(wn)) map.set(wn, []);
      map.get(wn)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  function weekLabel(wn: number): string {
    const w = weekMap[wn];
    if (!w) return `Week ${wn}`;
    const s = new Date(w.start_date).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const e = new Date(w.end_date).toLocaleDateString("en-CA",   { month: "short", day: "numeric" });
    return `Week ${wn} · ${s}–${e}`;
  }

  function weekIsPast(wn: number): boolean {
    const w = weekMap[wn];
    return !!w && w.end_date < new Date().toISOString().slice(0, 10);
  }

  function typeLabel(a: Assessment): string {
    if (a.type === "QUIZ" && a.quiz_type) {
      return a.quiz_type === "PRE_LAB" ? "Pre-lab quiz" : a.quiz_type === "POP" ? "Pop quiz" : "Quiz";
    }
    const map: Record<string, string> = {
      LAB: "Lab", ASSIGNMENT: "Assignment", MIDTERM: "Midterm",
      FINAL: "Final", PROJECT: "Project", QUIZ: "Quiz",
      LAB_EXAM: "Lab exam", PRESENTATION: "Presentation",
    };
    return map[a.type] ?? a.type;
  }

  function subtitle(a: Assessment): string {
    const sec    = sectionMap[a.section_id];
    const course = sec ? courseMap[sec.course_id] : null;
    const base   = `${course?.short_name ?? ""} ${sec?.type === "LAB" ? "Lab" : "Theory"}`;
    if (a.due_date) return `${base} · ${fmtDue(a.due_date)}`;
    return `${base} · during class`;
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>Loading…</div>
  );

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>All courses</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>Assessments</h1>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total",       value: total,           color: "var(--text)" },
          { label: "Completed",   value: completed,       color: "var(--green)" },
          { label: "Pending",     value: pending,         color: "var(--orange)" },
          { label: "Grade so far",value: `${gradeSoFar}%`,color: "#818cf8" },
        ].map(s => (
          <div key={s.label} className="card2" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
        {(["all", "pending", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className="btn"
            style={{
              padding: "5px 14px",
              background: statusFilter === f ? "var(--accent)" : "transparent",
              color: statusFilter === f ? "#fff" : "var(--text-2)",
              border: `1px solid ${statusFilter === f ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 99,
              fontSize: 12,
            }}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {courses.map(c => (
          <button
            key={c.course_id}
            onClick={() => setCourseFilter(courseFilter === c.course_id ? null : c.course_id)}
            className="btn"
            style={{
              padding: "5px 14px",
              background: courseFilter === c.course_id ? c.color + "22" : "transparent",
              color: c.color,
              border: `1px solid ${courseFilter === c.course_id ? c.color : c.color + "55"}`,
              borderRadius: 99,
              fontSize: 12,
            }}
          >
            {c.short_name}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {grouped.map(([wn, items]) => (
          <div key={wn}>
            {/* Week header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>{weekLabel(wn)}</span>
              {weekIsPast(wn) && (
                <span style={{ fontSize: 10, color: "var(--text-4)", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--border-dim)" }}>completed</span>
              )}
            </div>

            {/* Items */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map(a => {
                const sec    = sectionMap[a.section_id];
                const course = sec ? courseMap[sec.course_id] : null;
                const done   = parseFloat(a.score) > 0;
                const now    = new Date();
                const overdue = !done && a.due_date && new Date(a.due_date) < now;

                return (
                  <div
                    key={a.assessment_id}
                    className="card"
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px",
                      background: done ? "var(--bg)" : "var(--bg-card)",
                      borderColor: done ? "var(--border-dim)" : "var(--border-dim)",
                      opacity: done ? 0.7 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {/* Color bar */}
                    <div style={{ width: 3, alignSelf: "stretch", borderRadius: 99, background: course?.color ?? "var(--border)", flexShrink: 0 }} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: done ? "var(--text-3)" : "var(--text)", textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {subtitle(a)}
                      </div>
                    </div>

                    {/* Type badge */}
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, background: (course?.color ?? "#888") + "18", border: `1px solid ${(course?.color ?? "#888")}30`, color: course?.color ?? "#888", flexShrink: 0 }}>
                      {typeLabel(a)}
                    </span>

                    {/* Weight */}
                    <span style={{ fontSize: 12, color: "var(--text-3)", width: 38, textAlign: "right", flexShrink: 0 }}>
                      {a.weight_percent}%
                    </span>

                    {/* Status */}
                    <span style={{ fontSize: 11, fontWeight: 500, width: 72, textAlign: "right", flexShrink: 0, color: done ? "var(--green)" : overdue ? "var(--red)" : "var(--orange)" }}>
                      {done ? `Done · ${a.score}%` : overdue ? "Overdue" : "Pending"}
                    </span>

                    {/* Checkbox */}
                    <button
                      onClick={() => toggleScore(a)}
                      className={`checkbox${done ? " checked" : ""}`}
                      title={done ? "Mark as pending" : "Mark as done"}
                    >
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {grouped.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-4)" }}>No assessments match the current filters.</p>
        )}
      </div>
    </div>
  );
}
