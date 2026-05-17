/**
 * Grades.tsx — Grades page
 * Overall grade per course, broken down by section and individual assessments
 */

import { useEffect, useState, useMemo } from "react";
import { api, Assessment, Course, Section } from "../api";

// ─── Component ────────────────────────────────────────────────────────────────

export default function Grades() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [sections,    setSections]    = useState<Section[]>([]);

  useEffect(() => {
    Promise.all([
      api.assessments.list(),
      api.courses.list(),
      api.sections.list(),
    ]).then(([as, co, se]) => {
      setAssessments(as);
      setCourses(co);
      setSections(se);
    }).catch(console.error);
  }, []);

  const sectionMap = useMemo(() =>
    Object.fromEntries(sections.map(s => [s.section_id, s])), [sections]);

  // Overall GPA-style summary
  const overall = useMemo(() => {
    const earned   = assessments.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible = assessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    return possible > 0 ? (earned / possible) * 100 : 0;
  }, [assessments]);

  // Per-course breakdown
  const courseData = useMemo(() => {
    return courses.map(course => {
      const courseSections = sections.filter(s => s.course_id === course.course_id);
      const courseAssessments = assessments.filter(a =>
        courseSections.some(s => s.section_id === a.section_id)
      );
      const earned   = courseAssessments.reduce((s, a) => s + parseFloat(a.score), 0);
      const possible = courseAssessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
      const pct      = possible > 0 ? (earned / possible) * 100 : 0;

      // Per-section breakdown
      const sectionData = courseSections.map(sec => {
        const secAssessments = assessments.filter(a => a.section_id === sec.section_id);
        const sEarned   = secAssessments.reduce((s, a) => s + parseFloat(a.score), 0);
        const sPossible = secAssessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
        const sPct      = sPossible > 0 ? (sEarned / sPossible) * 100 : 0;
        return { sec, assessments: secAssessments, earned: sEarned, possible: sPossible, pct: sPct };
      });

      return { course, sectionData, earned, possible, pct };
    });
  }, [courses, sections, assessments]);

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

  return (
    <div className="px-6 py-5 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs text-[#666] mb-1">Semester overview</div>
        <h1 className="text-3xl font-bold text-white">Grades</h1>
      </div>

      {/* Overall card */}
      <div className="bg-[#242424] border border-[#2e2e2e] rounded-xl p-5 mb-6 flex items-center gap-6">
        {/* Big circle */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#2e2e2e" strokeWidth="8" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke="#6366f1" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - overall / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{Math.round(overall)}%</span>
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{letterGrade(overall)}</div>
          <div className="text-sm text-[#666] mt-0.5">Overall semester grade</div>
          <div className="text-xs text-[#555] mt-1">
            {assessments.filter(a => parseFloat(a.score) > 0).length} of {assessments.length} assessments completed
          </div>
        </div>
      </div>

      {/* Per-course cards */}
      <div className="flex flex-col gap-4">
        {courseData.map(({ course, sectionData, pct }) => (
          <div key={course.course_id} className="bg-[#242424] border border-[#2e2e2e] rounded-xl overflow-hidden">
            {/* Course header */}
            <div className="px-5 py-4 flex items-center gap-4 border-b border-[#2a2a2a]">
              <div className="flex-1">
                <div className="text-xs mb-0.5" style={{ color: course.color }}>
                  {course.code} · {course.credits} credits
                </div>
                <div className="text-lg font-semibold text-white">{course.title}</div>
                <div className="text-xs text-[#555] mt-0.5">{course.professor}</div>
              </div>
              {/* Grade circle */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#2a2a2a" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke={course.color} strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: course.color }}>
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[#2a2a2a]">
              <div
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: course.color }}
              />
            </div>

            {/* Sections */}
            {sectionData.map(({ sec, assessments: secAs, pct: sPct }) => (
              <div key={sec.section_id} className="border-b border-[#2a2a2a] last:border-0">
                {/* Section header */}
                <div className="px-5 py-3 flex items-center justify-between bg-[#1e1e1e]">
                  <div>
                    <span className="text-sm font-medium text-[#aaa]">
                      {sec.type} · {sec.section_number}
                    </span>
                    <span className="text-xs text-[#555] ml-2">
                      {sec.day_of_week?.slice(0,3)} {sec.start_time?.slice(0,5)}–{sec.end_time?.slice(0,5)} · {sec.room}
                    </span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: course.color }}>
                    {Math.round(sPct)}% earned
                  </span>
                </div>

                {/* Assessments */}
                <div className="divide-y divide-[#252525]">
                  {secAs.map(a => {
                    const done    = parseFloat(a.score) > 0;
                    const scorePct = parseFloat(a.weight_percent) > 0
                      ? (parseFloat(a.score) / parseFloat(a.weight_percent)) * 100
                      : 0;

                    return (
                      <div key={a.assessment_id} className="px-5 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm truncate ${done ? "text-[#666]" : "text-[#ccc]"}`}>
                            {a.title}
                          </span>
                          <span className="text-xs text-[#444] ml-2">{typeLabel(a.type)}</span>
                        </div>
                        {/* Mini bar */}
                        <div className="w-24 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${done ? scorePct : 0}%`,
                              backgroundColor: done ? course.color : "#333",
                            }}
                          />
                        </div>
                        <div className="text-xs text-[#555] w-10 text-right">
                          {done ? `${a.score}` : "—"} / {a.weight_percent}
                        </div>
                        {/* Status dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          done ? "bg-green-500" : "bg-[#333]"
                        }`} />
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
