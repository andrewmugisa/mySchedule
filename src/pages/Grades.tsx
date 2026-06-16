/**
 * Grades.tsx — Grades page
 * v0 design adapted to Vite + React Router + real API
 * - Overall grade circle
 * - Per-course breakdown with section detail
 */

import { useEffect, useState, useMemo } from "react";
import { api, Assessment, Course, Section } from "../api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function letterGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 85) return "A";
  if (pct >= 80) return "A-";
  if (pct >= 77) return "B+";
  if (pct >= 73) return "B";
  if (pct >= 70) return "B-";
  if (pct >= 67) return "C+";
  if (pct >= 63) return "C";
  if (pct >= 60) return "C-";
  if (pct >= 57) return "D+";
  if (pct >= 53) return "D";
  if (pct >= 50) return "D-";
  return "F";
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    LAB: "Lab", ASSIGNMENT: "Asgn", MIDTERM: "Midterm",
    FINAL: "Final", PROJECT: "Project", QUIZ: "Quiz",
    LAB_EXAM: "Lab exam", PRESENTATION: "Pres.",
  };
  return map[type] ?? type;
}

// ── Circle SVG ────────────────────────────────────────────────────────────────

function GradeCircle({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r  = (size / 2) - 6;
  const c  = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: "rotate(-90deg)" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--bg-hover)" strokeWidth={6} />
        <circle
          cx={c} cy={c} r={r} fill="none"
          stroke={color} strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size > 64 ? 16 : 12, fontWeight: 700, color }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Grades() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.assessments.list(), api.courses.list(), api.sections.list(),
    ]).then(([as, co, se]) => {
      setAssessments(as); setCourses(co); setSections(se); setLoading(false);
    }).catch(console.error);
  }, []);

  const sectionMap = useMemo(() =>
    Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);

  // Overall
  const overall = useMemo(() => {
    const earned   = assessments.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible = assessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    return possible > 0 ? (earned / possible) * 100 : 0;
  }, [assessments]);

  // Per-course
  const courseData = useMemo(() => courses.map(course => {
    const courseSecs = sections.filter(s => s.course_id === course.course_id);
    const courseAs   = assessments.filter(a => courseSecs.some(s => s.section_id === a.section_id));
    const earned     = courseAs.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible   = courseAs.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    const pct        = possible > 0 ? (earned / possible) * 100 : 0;

    const sectionData = courseSecs.map(sec => {
      const secAs    = assessments.filter(a => a.section_id === sec.section_id);
      const sEarned  = secAs.reduce((s, a) => s + parseFloat(a.score), 0);
      const sPoss    = secAs.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
      const sPct     = sPoss > 0 ? (sEarned / sPoss) * 100 : 0;
      return { sec, assessments: secAs, earned: sEarned, possible: sPoss, pct: sPct };
    });

    return { course, sectionData, earned, possible, pct };
  }), [courses, sections, assessments]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>Loading…</div>
  );

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 860 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Semester overview</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>Grades</h1>
      </div>

      {/* Overall card */}
      <div className="card2" style={{ display: "flex", alignItems: "center", gap: 24, padding: "24px 28px", marginBottom: 24 }}>
        <GradeCircle pct={overall} color="#818cf8" size={88} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", lineHeight: 1 }}>
            {letterGrade(overall)}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6 }}>Overall semester grade</div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
            {assessments.filter(a => parseFloat(a.score) > 0).length} of {assessments.length} assessments completed
          </div>
        </div>
      </div>

      {/* Per-course */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {courseData.map(({ course, sectionData, pct }) => (
          <div key={course.course_id} className="card2" style={{ overflow: "hidden" }}>

            {/* Course header */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", borderBottom: "1px solid var(--border-dim)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: course.color, marginBottom: 4 }}>
                  {course.code} · {course.credits} credits
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)" }}>{course.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{course.professor}</div>
              </div>
              <GradeCircle pct={pct} color={course.color} size={68} />
            </div>

            {/* Progress bar */}
            <div style={{ height: 2, background: "var(--border-dim)" }}>
              <div style={{ height: "100%", background: course.color, width: `${Math.min(pct, 100)}%`, transition: "width 0.4s" }} />
            </div>

            {/* Sections */}
            {sectionData.map(({ sec, assessments: secAs, pct: sPct }) => (
              <div key={sec.section_id}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", background: "var(--bg-card)", borderBottom: "1px solid var(--border-dim)" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {sec.type} · {sec.section_number}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 10 }}>
                      {sec.day_of_week?.slice(0, 3)} {sec.start_time?.slice(0, 5)}–{sec.end_time?.slice(0, 5)} · {sec.room}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: course.color }}>
                    {Math.round(sPct)}% earned
                  </span>
                </div>

                {/* Assessment rows */}
                <div>
                  {secAs.map(a => {
                    const done     = parseFloat(a.score) > 0;
                    const scorePct = parseFloat(a.weight_percent) > 0
                      ? (parseFloat(a.score) / parseFloat(a.weight_percent)) * 100 : 0;

                    return (
                      <div
                        key={a.assessment_id}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", borderBottom: "1px solid var(--border-dim)" }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: done ? "var(--text-3)" : "var(--text-2)", textDecoration: done ? "line-through" : "none" }}>
                            {a.title}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 8 }}>{typeLabel(a.type)}</span>
                        </div>

                        {/* Mini progress bar */}
                        <div style={{ width: 80, height: 3, background: "var(--bg-hover)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${done ? Math.min(scorePct, 100) : 0}%`, height: "100%", background: done ? course.color : "var(--border)", borderRadius: 99, transition: "width 0.3s" }} />
                        </div>

                        {/* Score */}
                        <div style={{ fontSize: 12, color: "var(--text-3)", width: 72, textAlign: "right", flexShrink: 0 }}>
                          {done ? <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{a.score}</span> : <span style={{ color: "var(--text-4)" }}>—</span>} / {a.weight_percent}
                        </div>

                        {/* Status dot */}
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: done ? "var(--green)" : "var(--border-strong)", flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
