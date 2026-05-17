/**
 * Assessments.tsx — All assessments page
 * Stats bar, filter chips by course/status, grouped by week
 */

import { useEffect, useState, useMemo } from "react";
import { api, Assessment, Course, Section, Week } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Assessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [weeks,       setWeeks]       = useState<Week[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [courseFilter, setCourseFilter] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.assessments.list(),
      api.courses.list(),
      api.sections.list(),
      api.weeks.list(),
    ]).then(([as, co, se, wk]) => {
      setAssessments(as);
      setCourses(co);
      setSections(se);
      setWeeks(wk);
    }).catch(console.error);
  }, []);

  const courseMap  = useMemo(() => Object.fromEntries(courses.map(c => [c.course_id, c])),   [courses]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);
  const weekMap    = useMemo(() => Object.fromEntries(weeks.map(w => [w.week_number, w])),   [weeks]);

  // Toggle score (mark done / undone)
  async function toggleScore(a: Assessment) {
    const newScore = parseFloat(a.score) > 0 ? "0" : a.weight_percent;
    const sec = sectionMap[a.section_id];
    await api.assessments.update(a.assessment_id, {
      section_id:     a.section_id,
      title:          a.title,
      type:           a.type,
      quiz_type:      a.quiz_type,
      week_number:    a.week_number,
      weight_percent: a.weight_percent,
      release_date:   a.release_date,
      due_date:       a.due_date,
      score:          newScore,
    } as any);
    setAssessments(prev => prev.map(x =>
      x.assessment_id === a.assessment_id ? { ...x, score: String(newScore) } : x
    ));
  }

  // Stats
  const total     = assessments.length;
  const completed = assessments.filter(a => parseFloat(a.score) > 0).length;
  const pending   = assessments.filter(a => parseFloat(a.score) === 0).length;
  const gradeSoFar = useMemo(() => {
    const earned = assessments.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible = assessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    return possible > 0 ? Math.round((earned / possible) * 100) : 0;
  }, [assessments]);

  // Filtered assessments
  const filtered = useMemo(() => {
    return assessments.filter(a => {
      const done = parseFloat(a.score) > 0;
      if (statusFilter === "pending"   && done)  return false;
      if (statusFilter === "completed" && !done) return false;
      if (courseFilter !== null) {
        const sec = sectionMap[a.section_id];
        if (!sec || sec.course_id !== courseFilter) return false;
      }
      return true;
    });
  }, [assessments, statusFilter, courseFilter, sectionMap]);

  // Group by week (descending — most recent first for completed, ascending for pending)
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
    const start = new Date(w.start_date).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const end   = new Date(w.end_date).toLocaleDateString("en-CA",   { month: "short", day: "numeric" });
    return `Week ${wn} · ${start}–${end}`;
  }

  function weekDone(wn: number): boolean {
    const w = weekMap[wn];
    if (!w) return false;
    const today = new Date().toISOString().slice(0, 10);
    return w.end_date < today;
  }

  function assessmentSubtitle(a: Assessment): string {
    const sec    = sectionMap[a.section_id];
    const course = sec ? courseMap[sec.course_id] : null;
    const sectionTitle = `${course?.short_name ?? ""} ${sec?.type === "LAB" ? "Lab" : "Theory"}`;
    if (a.due_date) return `${sectionTitle} · ${fmtDue(a.due_date)}`;
    return `${sectionTitle} · during class`;
  }

  function typeLabel(a: Assessment): string {
    if (a.type === "QUIZ" && a.quiz_type) return a.quiz_type === "PRE_LAB" ? "Pre-lab quiz" : a.quiz_type === "POP" ? "Pop quiz" : "Quiz";
    const map: Record<string, string> = {
      LAB: "Lab", ASSIGNMENT: "Assignment", MIDTERM: "Midterm",
      FINAL: "Final", PROJECT: "Project", PRESENTATION: "Presentation",
      QUIZ: "Quiz", LAB_EXAM: "Lab exam",
    };
    return map[a.type] ?? a.type;
  }

  function statusBadge(a: Assessment) {
    const done = parseFloat(a.score) > 0;
    if (done) return <span className="text-xs text-green-400">Done · {a.score}%</span>;
    const now = new Date();
    if (a.due_date && new Date(a.due_date) < now) {
      return <span className="text-xs text-red-400">Overdue</span>;
    }
    return <span className="text-xs text-orange-400">Pending</span>;
  }

  return (
    <div className="px-6 py-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-xs text-[#666] mb-1">All courses</div>
          <h1 className="text-3xl font-bold text-white">Assessments</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total assessments", value: total,      color: "text-white" },
          { label: "Completed",         value: completed,  color: "text-green-400" },
          { label: "Pending",           value: pending,    color: "text-orange-400" },
          { label: "Grade so far",      value: `${gradeSoFar}%`, color: "text-[#6366f1]" },
        ].map(s => (
          <div key={s.label} className="bg-[#242424] rounded-xl p-4 border border-[#2e2e2e]">
            <div className="text-xs text-[#555] mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Status */}
        {(["all", "pending", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors capitalize ${
              statusFilter === f
                ? "bg-[#6366f1] border-[#6366f1] text-white"
                : "border-[#333] text-[#888] hover:text-white"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {/* Course filters */}
        {courses.map(c => (
          <button
            key={c.course_id}
            onClick={() => setCourseFilter(courseFilter === c.course_id ? null : c.course_id)}
            className="px-3 py-1 rounded-full text-sm border transition-colors"
            style={{
              borderColor: courseFilter === c.course_id ? c.color : c.color + "55",
              color:        c.color,
              backgroundColor: courseFilter === c.course_id ? c.color + "22" : "transparent",
            }}
          >
            {c.short_name}
          </button>
        ))}
      </div>

      {/* Grouped list */}
      <div className="flex flex-col gap-6">
        {grouped.map(([wn, items]) => (
          <div key={wn}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-[#666]">{weekLabel(wn)}</span>
              {weekDone(wn) && (
                <span className="text-xs text-[#444] px-2 py-0.5 rounded-full border border-[#333]">
                  completed
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {items.map(a => {
                const sec    = sectionMap[a.section_id];
                const course = sec ? courseMap[sec.course_id] : null;
                const done   = parseFloat(a.score) > 0;

                return (
                  <div
                    key={a.assessment_id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                      done ? "border-[#2a2a2a] bg-[#1e1e1e]" : "border-[#2e2e2e] bg-[#242424]"
                    }`}
                  >
                    {/* Course color bar */}
                    <div
                      className="w-1 self-stretch rounded-full flex-shrink-0"
                      style={{ backgroundColor: course?.color ?? "#444" }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${done ? "text-[#666]" : "text-white"}`}>
                        {a.title}
                      </div>
                      <div className="text-xs text-[#555] truncate">{assessmentSubtitle(a)}</div>
                    </div>

                    {/* Type badge */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: course?.color + "22", color: course?.color }}
                    >
                      {typeLabel(a)}
                    </span>

                    {/* Weight */}
                    <span className="text-xs text-[#555] w-8 text-right flex-shrink-0">
                      {a.weight_percent}%
                    </span>

                    {/* Status */}
                    <div className="w-20 text-right flex-shrink-0">{statusBadge(a)}</div>

                    {/* Checkbox */}
                    <button
                      onClick={() => toggleScore(a)}
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        done
                          ? "bg-green-500 border-green-500"
                          : "border-[#444] hover:border-[#666]"
                      }`}
                    >
                      {done && <span className="text-white text-xs">✓</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <p className="text-[#555] text-sm">No assessments match the current filters.</p>
        )}
      </div>
    </div>
  );
}
