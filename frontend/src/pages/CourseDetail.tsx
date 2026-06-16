/**
 * CourseDetail.tsx — Course detail page
 * v0 design adapted to Vite + React Router + real API
 * - Hero card with grade circle, section cards
 * - Tabs: Assessments | Weekly knowledge | Edit course
 */

import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { api, Course, Section, Assessment, WeeklyKnowledge } from "../api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDue(iso: string | null): string {
  if (!iso) return "during class";
  return new Date(iso).toLocaleDateString("en-CA", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Toronto",
  });
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

// ── Grade circle ──────────────────────────────────────────────────────────────

function GradeCircle({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const r    = (size / 2) - 6;
  const c    = size / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: "rotate(-90deg)" }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CourseDetail() {
  const { id }     = useParams<{ id: string }>();
  const courseId   = parseInt(id ?? "0");

  const [course,      setCourse]      = useState<Course | null>(null);
  const [sections,    setSections]    = useState<Section[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [knowledge,   setKnowledge]   = useState<WeeklyKnowledge[]>([]);
  const [tab,         setTab]         = useState<"assessments" | "knowledge" | "edit">("assessments");
  const [editForm,    setEditForm]    = useState<Partial<Course>>({});
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);

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
      const secIds = new Set(se.map(s => s.section_id));
      setAssessments(as.filter(a => secIds.has(a.section_id)));
      setKnowledge(kn);
      setLoading(false);
    }).catch(console.error);
  }, [courseId]);

  const { pct } = useMemo(() => {
    const earned   = assessments.reduce((s, a) => s + parseFloat(a.score), 0);
    const possible = assessments.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
    return { pct: possible > 0 ? Math.round((earned / possible) * 100) : 0, earned, possible };
  }, [assessments]);

  async function toggleScore(a: Assessment) {
    const newScore = parseFloat(a.score) > 0 ? "0" : a.weight_percent;
    await api.assessments.update(a.assessment_id, { ...a, score: newScore } as any);
    setAssessments(prev => prev.map(x =>
      x.assessment_id === a.assessment_id ? { ...x, score: String(newScore) } : x
    ));
  }

  async function saveCourse() {
    if (!course) return;
    setSaving(true);
    try {
      const updated = await api.courses.update(course.course_id, editForm as Omit<Course, "course_id">);
      setCourse(updated);
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-3)" }}>Loading…</div>
  );
  if (!course) return (
    <div style={{ padding: 32, color: "var(--text-3)" }}>Course not found.</div>
  );

  const TABS = [
    { key: "assessments", label: "Assessments" },
    { key: "knowledge",   label: "Weekly knowledge" },
    { key: "edit",        label: "Edit course" },
  ] as const;

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 860 }}>

      {/* Breadcrumb */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>
        Courses
      </div>

      {/* Hero card */}
      <div style={{
        borderRadius: 18, padding: "24px 28px", marginBottom: 28,
        background: `${course.color}0f`,
        border: `1px solid ${course.color}30`,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: course.color, marginBottom: 6 }}>
              {course.code} · {course.credits} credits
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1.2, marginBottom: 6 }}>
              {course.title}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-2)" }}>{course.professor}</div>

            {/* Progress bar */}
            <div style={{ marginTop: 16, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: course.color, borderRadius: 99, transition: "width 0.4s" }} />
            </div>

            {/* Section cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
              {sections.map(sec => (
                <div key={sec.section_id} style={{
                  borderRadius: 12, padding: "12px 14px",
                  background: `${course.color}12`,
                  border: `1px solid ${course.color}25`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: course.color, marginBottom: 6 }}>
                    {sec.type} · {sec.section_number} · {sec.weight_percent}%
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    {sec.day_of_week?.slice(0, 3)} {sec.start_time?.slice(0, 5)}–{sec.end_time?.slice(0, 5)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{sec.room}</div>
                </div>
              ))}
            </div>
          </div>

          <GradeCircle pct={pct} color={course.color} size={80} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-dim)", marginBottom: 24 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 20px",
              fontSize: 13, fontWeight: 500,
              cursor: "pointer", border: "none", background: "none",
              borderBottom: `2px solid ${tab === t.key ? course.color : "transparent"}`,
              color: tab === t.key ? course.color : "var(--text-3)",
              marginBottom: -1,
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Assessments ── */}
      {tab === "assessments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {sections.map(sec => {
            const secAs    = assessments.filter(a => a.section_id === sec.section_id);
            const sEarned  = secAs.reduce((s, a) => s + parseFloat(a.score), 0);
            const sPoss    = secAs.reduce((s, a) => s + parseFloat(a.weight_percent), 0);
            const sPct     = sPoss > 0 ? Math.round((sEarned / sPoss) * 100) : 0;

            return (
              <div key={sec.section_id}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingLeft: 4 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {sec.type} · {sec.section_number}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-4)", marginLeft: 10 }}>
                      {sec.day_of_week?.slice(0, 3)} {sec.start_time?.slice(0, 5)}–{sec.end_time?.slice(0, 5)} · {sec.room} · {sec.weight_percent}% of final
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: course.color }}>
                    {sPct}% earned
                  </span>
                </div>

                {/* Assessment rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {secAs.map(a => {
                    const done = parseFloat(a.score) > 0;
                    return (
                      <div
                        key={a.assessment_id}
                        className="card"
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px",
                          background: done ? "var(--bg)" : "var(--bg-card)",
                          opacity: done ? 0.7 : 1,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: done ? "var(--text-3)" : "var(--text)", textDecoration: done ? "line-through" : "none" }}>
                            {a.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>
                            Week {a.week_number} · {fmtDue(a.due_date)}
                          </div>
                        </div>

                        {/* Type */}
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: course.color + "18", border: `1px solid ${course.color}30`, color: course.color, flexShrink: 0 }}>
                          {typeLabel(a)}
                        </span>

                        {/* Weight */}
                        <span style={{ fontSize: 12, color: "var(--text-3)", width: 38, textAlign: "right", flexShrink: 0 }}>
                          {a.weight_percent}%
                        </span>

                        {/* Status */}
                        <span style={{ fontSize: 11, fontWeight: 500, width: 72, textAlign: "right", flexShrink: 0, color: done ? "var(--green)" : "var(--text-3)" }}>
                          {done ? "Done" : !a.due_date ? "Not started" : "Pending"}
                        </span>

                        {/* Checkbox */}
                        <button
                          onClick={() => toggleScore(a)}
                          className={`checkbox${done ? " checked" : ""}`}
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
            );
          })}
        </div>
      )}

      {/* ── Tab: Weekly knowledge ── */}
      {tab === "knowledge" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {knowledge.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-4)" }}>No weekly knowledge entries yet.</p>
          )}
          {knowledge.map(wk => (
            <div key={wk.knowledge_id} className="card2" style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Week {wk.week_number}
              </div>
              {wk.topics.map((t, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>{t.topic}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{t.subtopics.join(" · ")}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Edit course ── */}
      {tab === "edit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
          {[
            { label: "Course code",  key: "code" },
            { label: "Title",        key: "title" },
            { label: "Short name",   key: "short_name" },
            { label: "Professor(s)", key: "professor" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={(editForm as any)[key] ?? ""}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

          {/* Color */}
          <div>
            <label className="label">Color (hex)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: editForm.color, border: "1px solid var(--border)", flexShrink: 0 }} />
              <input
                className="input"
                value={editForm.color ?? ""}
                onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
              />
            </div>
          </div>

          {/* Credits */}
          <div>
            <label className="label">Credits</label>
            <input
              type="number"
              className="input"
              style={{ width: 100 }}
              value={editForm.credits ?? ""}
              onChange={e => setEditForm(f => ({ ...f, credits: parseInt(e.target.value) }))}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 8, alignSelf: "flex-start", padding: "9px 24px", background: course.color }}
            onClick={saveCourse}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
