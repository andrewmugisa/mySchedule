/**
 * CourseDetail.tsx — Course detail page
 * Hero card with grade circle, tabs: Assessments | Weekly knowledge | Edit course
 */

import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { api, Course, Section, Assessment, WeeklyKnowledge } from "../api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDue(iso: string | null): string {
  if (!iso) return "due during class";
  const d = new Date(iso);
  return `due ${d.toLocaleDateString("en-CA", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
  })}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const courseId = parseInt(id ?? "0");

  const [course,      setCourse]      = useState<Course | null>(null);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [knowledge,   setKnowledge]   = useState<WeeklyKnowledge[]>([]);
  const [tab,         setTab]         = useState<"assessments" | "knowledge" | "edit">("assessments");

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<Course>>({});
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([
      api.courses.get(courseId),
      api.sections.list(courseId),
      api.assessments.list(),
      api.knowledge.list({ course_id: courseId }),
    ]).then(([co, se, as, kn]) => {
      setCourse(co);
      setEditForm(co);
      setSections(se);
      // Filter assessments to this course's sections
      const sectionIds = new Set(se.map(s => s.section_id));
      setAssessments(as.filter(a => sectionIds.has(a.section_id)));
      setKnowledge(kn);
    }).catch(console.error);
  }, [courseId]);

  // Grade calculations
  const { pct, earned, possible } = useMemo(() => {
    const earned   = assessments.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible = assessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    const pct      = possible > 0 ? Math.round((earned / possible) * 100) : 0;
    return { pct, earned, possible };
  }, [assessments]);

  // Toggle assessment score
  async function toggleScore(a: Assessment) {
    const newScore = parseFloat(a.score) > 0 ? "0" : a.weight_percent;
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

  // Save course edits
  async function saveCourse() {
    if (!course) return;
    setSaving(true);
    try {
      const updated = await api.courses.update(course.course_id, editForm as Omit<Course, "course_id">);
      setCourse(updated);
    } finally {
      setSaving(false);
    }
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

  function statusBadge(a: Assessment) {
    const done = parseFloat(a.score) > 0;
    if (done) return <span className="text-xs text-green-400">Done</span>;
    if (!a.due_date) return <span className="text-xs text-[#555]">Not started</span>;
    return <span className="text-xs text-orange-400">Pending</span>;
  }

  if (!course) return <div className="p-6 text-[#555]">Loading…</div>;

  return (
    <div className="px-6 py-5 max-w-3xl">
      {/* Breadcrumb */}
      <div className="text-xs text-[#555] mb-4">Courses</div>

      {/* Hero card */}
      <div
        className="rounded-2xl p-5 mb-6 border"
        style={{ borderColor: course.color + "44", backgroundColor: course.color + "0d" }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm mb-1" style={{ color: course.color }}>
              {course.code} · {course.credits} credits
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{course.title}</h1>
            <div className="text-sm text-[#888]">{course.professor}</div>

            {/* Progress bar */}
            <div className="mt-4 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: course.color }}
              />
            </div>

            {/* Section cards */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {sections.map(sec => (
                <div
                  key={sec.section_id}
                  className="rounded-xl p-3 border"
                  style={{ borderColor: course.color + "33", backgroundColor: course.color + "11" }}
                >
                  <div className="text-xs font-medium mb-1" style={{ color: course.color }}>
                    {sec.type} · {sec.section_number} · {sec.weight_percent}%
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {sec.day_of_week?.slice(0, 3)} {sec.start_time?.slice(0, 5)}–{sec.end_time?.slice(0, 5)}
                  </div>
                  <div className="text-xs text-[#666] mt-0.5">{sec.room}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Grade circle */}
          <div className="relative w-20 h-20 flex-shrink-0 ml-4">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#2a2a2a" strokeWidth="7" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={course.color} strokeWidth="7"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold" style={{ color: course.color }}>{pct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2a2a2a] mb-5">
        {(["assessments", "knowledge", "edit"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-b-2 text-white"
                : "border-transparent text-[#666] hover:text-[#aaa]"
            }`}
            style={tab === t ? { borderBottomColor: course.color, color: course.color } : {}}
          >
            {t === "assessments" ? "Assessments" : t === "knowledge" ? "Weekly knowledge" : "Edit course"}
          </button>
        ))}
      </div>

      {/* ── Tab: Assessments ── */}
      {tab === "assessments" && (
        <div className="flex flex-col gap-4">
          {sections.map(sec => {
            const secAs  = assessments.filter(a => a.section_id === sec.section_id);
            const sEarned   = secAs.reduce((s, a) => s + parseFloat(a.score), 0);
            const sPossible = secAs.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
            const sPct      = sPossible > 0 ? Math.round((sEarned / sPossible) * 100) : 0;

            return (
              <div key={sec.section_id}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <div>
                    <span className="text-sm font-medium text-[#aaa]">
                      {sec.type} · {sec.section_number}
                    </span>
                    <span className="text-xs text-[#555] ml-2">
                      {sec.day_of_week?.slice(0,3)} {sec.start_time?.slice(0,5)}–{sec.end_time?.slice(0,5)} · {sec.room} · {sec.weight_percent}% of final grade
                    </span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: course.color }}>
                    {sPct}% earned
                  </span>
                </div>

                {/* Assessment rows */}
                <div className="flex flex-col gap-2">
                  {secAs.map(a => {
                    const done = parseFloat(a.score) > 0;
                    return (
                      <div
                        key={a.assessment_id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                          done ? "border-[#2a2a2a] bg-[#1e1e1e]" : "border-[#2e2e2e] bg-[#242424]"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold truncate ${done ? "text-[#666]" : "text-white"}`}>
                            {a.title}
                          </div>
                          <div className="text-xs text-[#555]">
                            Week {a.week_number} · {fmtDue(a.due_date)}
                          </div>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: course.color + "22", color: course.color }}
                        >
                          {a.weight_percent}%
                        </span>
                        <div className="w-20 text-right flex-shrink-0">{statusBadge(a)}</div>
                        <button
                          onClick={() => toggleScore(a)}
                          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            done ? "bg-green-500 border-green-500" : "border-[#444] hover:border-[#666]"
                          }`}
                        >
                          {done && <span className="text-white text-xs">✓</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Weekly knowledge ── */}
      {tab === "knowledge" && (
        <div className="flex flex-col gap-4">
          {knowledge.length === 0 && (
            <p className="text-[#555] text-sm">No weekly knowledge entries yet.</p>
          )}
          {knowledge.map(wk => (
            <div key={wk.knowledge_id} className="bg-[#242424] border border-[#2e2e2e] rounded-xl p-4">
              <div className="text-xs text-[#555] mb-2">Week {wk.week_number}</div>
              {wk.topics.map((t, i) => (
                <div key={i} className="mb-2">
                  <div className="text-sm font-semibold text-white">{t.topic}</div>
                  <div className="text-xs text-[#666] mt-0.5">{t.subtopics.join(" · ")}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Edit course ── */}
      {tab === "edit" && (
        <div className="flex flex-col gap-4 max-w-md">
          {[
            { label: "Course code",  key: "code" },
            { label: "Title",        key: "title" },
            { label: "Short name",   key: "short_name" },
            { label: "Professor(s)", key: "professor" },
            { label: "Color (hex)",  key: "color" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs text-[#666] mb-1">{label}</label>
              <div className="flex items-center gap-2">
                {key === "color" && (
                  <div className="w-6 h-6 rounded flex-shrink-0 border border-[#333]"
                    style={{ backgroundColor: editForm.color }} />
                )}
                <input
                  value={(editForm as any)[key] ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-[#2e2e2e] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366f1]"
                />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-xs text-[#666] mb-1">Credits</label>
            <input
              type="number"
              value={editForm.credits ?? ""}
              onChange={e => setEditForm(f => ({ ...f, credits: parseInt(e.target.value) }))}
              className="w-24 bg-[#2e2e2e] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <button
            onClick={saveCourse}
            disabled={saving}
            className="mt-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: course.color }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
