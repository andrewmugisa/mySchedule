export const USER_TZ = "America/Toronto";

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: USER_TZ, ...opts });
}
export function fmtTime12(d: Date): string {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}${m ? `:${String(m).padStart(2,"0")}` : ""} ${ap}`;
}
export function fmtBadge(d: Date): string {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}${m ? `:${String(m).padStart(2,"0")}` : ""}${ap}`;
}
export function fmtDue(iso: string | null): string {
  if (!iso) return "during class";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: USER_TZ });
}
export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: USER_TZ });
}
export function typeLabel(type: string, quizType?: string | null): string {
  if (type === "QUIZ" && quizType) {
    if (quizType === "PRE_LAB") return "Pre-lab"; if (quizType === "POP") return "Pop quiz"; return "Quiz";
  }
  const map: Record<string,string> = { LAB:"Lab", ASSIGNMENT:"Assignment", MIDTERM:"Midterm", FINAL:"Final", PROJECT:"Project", QUIZ:"Quiz", LAB_EXAM:"Lab exam", PRESENTATION:"Presentation" };
  return map[type] ?? type;
}
export function letterGrade(pct: number): string {
  if (pct>=90) return "A+"; if (pct>=85) return "A"; if (pct>=80) return "A-";
  if (pct>=77) return "B+"; if (pct>=73) return "B"; if (pct>=70) return "B-";
  if (pct>=67) return "C+"; if (pct>=63) return "C"; if (pct>=60) return "C-";
  if (pct>=57) return "D+"; if (pct>=53) return "D"; if (pct>=50) return "D-";
  return "F";
}
export function gradeColor(pct: number): string {
  if (pct>=80) return "var(--green)"; if (pct>=65) return "var(--accent)"; if (pct>=50) return "var(--orange)"; return "var(--red)";
}
import { api, Assessment } from "./api";
export async function toggleScore(a: Assessment, onUpdate: (updated: Assessment) => void) {
  const newScore = parseFloat(a.score) > 0 ? "0" : a.weight_percent;
  await api.assessments.update(a.assessment_id, { section_id: a.section_id, title: a.title, type: a.type, quiz_type: a.quiz_type, week_number: a.week_number, weight_percent: a.weight_percent, release_date: a.release_date, due_date: a.due_date, score: newScore } as any);
  onUpdate({ ...a, score: String(newScore) });
}
