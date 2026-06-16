const BASE = "/api";

export interface Week { week_number: number; start_date: string; end_date: string; is_break: boolean; }
export interface Course { course_id: number; code: string; title: string; short_name: string; color: string; professor: string | null; credits: number | null; }
export interface Section { section_id: number; course_id: number; section_number: string; type: string; weight_percent: string; room: string | null; day_of_week: string | null; start_time: string | null; end_time: string | null; }
export interface Assessment { assessment_id: number; section_id: number; title: string; type: string; quiz_type: string | null; week_number: number | null; weight_percent: string; release_date: string | null; due_date: string | null; score: string; }
export interface Event { event_id: number; section_id: number | null; title: string; type: string; start_time: string; end_time: string; week_number: number | null; location: string | null; notes: string | null; is_cancelled: boolean; is_recurring: boolean; recur_days: string | null; recur_end: string | null; }
export interface WeeklyKnowledge { knowledge_id: number; course_id: number; week_number: number; topics: { topic: string; subtopics: string[] }[]; }

const DAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function expandRecurring(events: Event[], weeks: Week[]): Event[] {
  const result: Event[] = [];
  const overrideKeys = new Set<string>();
  for (const ev of events) {
    if (!ev.is_recurring) {
      const dateStr = new Date(ev.start_time).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
      overrideKeys.add(`${ev.section_id}:${ev.title}:${dateStr}`);
      result.push(ev);
    }
  }
  for (const ev of events) {
    if (!ev.is_recurring || !ev.recur_days) continue;
    const recurDayNums = ev.recur_days.split(",").map(d => DAY_MAP[d.trim().toUpperCase()]).filter((n): n is number => n !== undefined);
    if (recurDayNums.length === 0) continue;
    const originStart = new Date(ev.start_time);
    const originEnd   = new Date(ev.end_time);
    const durationMs  = originEnd.getTime() - originStart.getTime();
    const utcHours    = originStart.getUTCHours();
    const utcMinutes  = originStart.getUTCMinutes();
    const recEndStr   = ev.recur_end ?? "2099-12-31";
    for (const week of weeks) {
      if (week.is_break) continue;
      if (week.start_date > recEndStr) continue;
      const monday = parseLocalDate(week.start_date);
      const startDay = monday.getDay();
      if (startDay !== 1) { const diff = startDay === 0 ? -6 : 1 - startDay; monday.setDate(monday.getDate() + diff); }
      for (const dayNum of recurDayNums) {
        const offsetFromMon = dayNum === 0 ? 6 : dayNum - 1;
        const targetLocal = new Date(monday);
        targetLocal.setDate(monday.getDate() + offsetFromMon);
        const targetStr = toYMD(targetLocal);
        if (targetStr < week.start_date || targetStr > week.end_date) continue;
        if (targetStr > recEndStr) continue;
        const overrideKey = `${ev.section_id}:${ev.title}:${targetStr}`;
        if (overrideKeys.has(overrideKey)) continue;
        const occStart = new Date(Date.UTC(targetLocal.getFullYear(), targetLocal.getMonth(), targetLocal.getDate(), utcHours, utcMinutes, 0, 0));
        const occEnd   = new Date(occStart.getTime() + durationMs);
        result.push({ ...ev, event_id: -(ev.event_id * 100000 + week.week_number * 10 + dayNum), start_time: occStart.toISOString(), end_time: occEnd.toISOString(), week_number: week.week_number });
      }
    }
  }
  return result;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}
async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}
async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

export const api = {
  weeks:       { list: () => get<Week[]>("/weeks"), get: (n: number) => get<Week>(`/weeks/${n}`) },
  courses:     { list: () => get<Course[]>("/courses"), get: (id: number) => get<Course>(`/courses/${id}`), create: (b: Omit<Course,"course_id">) => post<Course>("/courses", b), update: (id: number, b: Omit<Course,"course_id">) => put<Course>(`/courses/${id}`, b), delete: (id: number) => del(`/courses/${id}`) },
  sections:    { list: (course_id?: number) => get<Section[]>(`/sections${course_id ? `?course_id=${course_id}` : ""}`), get: (id: number) => get<Section>(`/sections/${id}`), create: (b: Omit<Section,"section_id">) => post<Section>("/sections", b), update: (id: number, b: Omit<Section,"section_id">) => put<Section>(`/sections/${id}`, b), delete: (id: number) => del(`/sections/${id}`) },
  assessments: {
    list: (p?: { section_id?: number; week_number?: number }) => { const q = new URLSearchParams(); if (p?.section_id) q.set("section_id", String(p.section_id)); if (p?.week_number) q.set("week_number", String(p.week_number)); return get<Assessment[]>(`/assessments${q.toString() ? `?${q}` : ""}`); },
    get: (id: number) => get<Assessment>(`/assessments/${id}`),
    create: (b: Omit<Assessment,"assessment_id">) => post<Assessment>("/assessments", b),
    update: (id: number, b: Omit<Assessment,"assessment_id">) => put<Assessment>(`/assessments/${id}`, b),
    delete: (id: number) => del(`/assessments/${id}`),
  },
  events: {
    list: (p?: { week_number?: number; section_id?: number; type?: string }) => { const q = new URLSearchParams(); if (p?.week_number) q.set("week_number", String(p.week_number)); if (p?.section_id) q.set("section_id", String(p.section_id)); if (p?.type) q.set("type", p.type); return get<Event[]>(`/events${q.toString() ? `?${q}` : ""}`); },
    get: (id: number) => get<Event>(`/events/${id}`),
    create: (b: Omit<Event,"event_id">) => post<Event>("/events", b),
    update: (id: number, b: Omit<Event,"event_id">) => put<Event>(`/events/${id}`, b),
    delete: (id: number) => del(`/events/${id}`),
  },
  knowledge: {
    list: (p?: { course_id?: number; week_number?: number }) => { const q = new URLSearchParams(); if (p?.course_id) q.set("course_id", String(p.course_id)); if (p?.week_number) q.set("week_number", String(p.week_number)); return get<WeeklyKnowledge[]>(`/knowledge${q.toString() ? `?${q}` : ""}`); },
    get: (id: number) => get<WeeklyKnowledge>(`/knowledge/${id}`),
    create: (b: Omit<WeeklyKnowledge,"knowledge_id">) => post<WeeklyKnowledge>("/knowledge", b),
    update: (id: number, b: Omit<WeeklyKnowledge,"knowledge_id">) => put<WeeklyKnowledge>(`/knowledge/${id}`, b),
    delete: (id: number) => del(`/knowledge/${id}`),
  },
};
