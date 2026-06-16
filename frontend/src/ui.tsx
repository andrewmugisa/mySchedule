/**
 * ui.tsx — Shared UI primitives used across pages
 */

import { Assessment, Course } from "./api";
import { typeLabel, fmtDue, gradeColor } from "./utils";

// ── GradeCircle ───────────────────────────────────────────────────────────────
export function GradeCircle({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-4)" strokeWidth="4" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: size < 60 ? 11 : 13, fontWeight: 600, color }}>{pct}%</span>
      </div>
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ sub, title, right }: {
  sub?: string; title: string; right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        {sub && <div className="page-sub">{sub}</div>}
        <h1 className="page-title">{title}</h1>
      </div>
      {right}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ a }: { a: Assessment }) {
  const done = parseFloat(a.score) > 0;
  if (done) return (
    <span className="badge" style={{ color: "var(--green)", background: "rgba(52,211,153,0.1)", borderColor: "rgba(52,211,153,0.2)" }}>
      Done
    </span>
  );
  if (a.due_date && new Date(a.due_date) < new Date()) return (
    <span className="badge" style={{ color: "var(--red)", background: "rgba(248,113,113,0.1)", borderColor: "rgba(248,113,113,0.2)" }}>
      Overdue
    </span>
  );
  return (
    <span className="badge" style={{ color: "var(--orange)", background: "rgba(251,146,60,0.1)", borderColor: "rgba(251,146,60,0.2)" }}>
      Pending
    </span>
  );
}

// ── AssessRow ─────────────────────────────────────────────────────────────────
export function AssessRow({
  a, course, onToggle, showSubtitle = true,
}: {
  a: Assessment;
  course: Course | null;
  onToggle: () => void;
  showSubtitle?: boolean;
}) {
  const done = parseFloat(a.score) > 0;
  const color = course?.color ?? "var(--text-3)";

  return (
    <div className={`assess-row ${done ? "done" : ""}`}>
      {/* Color stripe */}
      <div style={{ width: 3, alignSelf: "stretch", borderRadius: 99, backgroundColor: color, flexShrink: 0 }} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: done ? "var(--text-3)" : "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {a.title}
        </div>
        {showSubtitle && (
          <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 2 }}>
            {fmtDue(a.due_date)}
          </div>
        )}
      </div>

      {/* Type badge */}
      <span className="badge" style={{ backgroundColor: color + "18", color, borderColor: color + "33", flexShrink: 0 }}>
        {typeLabel(a.type, a.quiz_type)}
      </span>

      {/* Weight */}
      <span style={{ fontSize: 12, color: "var(--text-4)", width: 32, textAlign: "right", flexShrink: 0, fontFamily: "'DM Mono', monospace" }}>
        {a.weight_percent}%
      </span>

      {/* Status */}
      <div style={{ flexShrink: 0 }}><StatusBadge a={a} /></div>

      {/* Checkbox */}
      <button className={`checkbox ${done ? "checked" : ""}`} onClick={onToggle}>
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ padding: 48, display: "flex", justifyContent: "center" }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        border: "2px solid var(--border-md)",
        borderTopColor: "var(--accent)",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ── Empty ─────────────────────────────────────────────────────────────────────
export function Empty({ message = "Nothing here yet." }: { message?: string }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-4)", fontSize: 13 }}>
      {message}
    </div>
  );
}
