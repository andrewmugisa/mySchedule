/**
 * api.ts — typed fetch wrappers for the PATS backend
 * Base URL uses /api/ so Vite proxy forwards to backend:8000
 */

const BASE = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Week {
  week_number: number;
  start_date:  string;
  end_date:    string;
  is_break:    boolean;
}

export interface Course {
  course_id:  number;
  code:       string;
  title:      string;
  short_name: string;
  color:      string;
  professor:  string | null;
  credits:    number | null;
}

export interface Section {
  section_id:     number;
  course_id:      number;
  section_number: string;
  type:           string; // THEORY | LAB | HYBRID
  weight_percent: string;
  room:           string | null;
  day_of_week:    string | null;
  start_time:     string | null;
  end_time:       string | null;
}

export interface Assessment {
  assessment_id:  number;
  section_id:     number;
  title:          string;
  type:           string;
  quiz_type:      string | null;
  week_number:    number | null;
  weight_percent: string;
  release_date:   string | null;
  due_date:       string | null;
  score:          string;
}

export interface Event {
  event_id:     number;
  section_id:   number | null;
  title:        string;
  type:         string; // CLASS | PERSONAL
  start_time:   string;
  end_time:     string;
  week_number:  number | null;
  location:     string | null;
  notes:        string | null;
  is_cancelled: boolean;
  is_recurring: boolean;
  recur_days:   string | null;
  recur_end:    string | null;
}

export interface WeeklyKnowledge {
  knowledge_id: number;
  course_id:    number;
  week_number:  number;
  topics:       { topic: string; subtopics: string[] }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  "PUT",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

// ─── Weeks ────────────────────────────────────────────────────────────────────

export const api = {
  weeks: {
    list: ()               => get<Week[]>("/weeks"),
    get:  (n: number)      => get<Week>(`/weeks/${n}`),
  },

  // ─── Courses ───────────────────────────────────────────────────────────────
  courses: {
    list:   ()                          => get<Course[]>("/courses"),
    get:    (id: number)                => get<Course>(`/courses/${id}`),
    create: (body: Omit<Course, "course_id">) => post<Course>("/courses", body),
    update: (id: number, body: Omit<Course, "course_id">) => put<Course>(`/courses/${id}`, body),
    delete: (id: number)                => del(`/courses/${id}`),
  },

  // ─── Sections ──────────────────────────────────────────────────────────────
  sections: {
    list:   (course_id?: number) => get<Section[]>(`/sections${course_id ? `?course_id=${course_id}` : ""}`),
    get:    (id: number)         => get<Section>(`/sections/${id}`),
    create: (body: Omit<Section, "section_id">) => post<Section>("/sections", body),
    update: (id: number, body: Omit<Section, "section_id">) => put<Section>(`/sections/${id}`, body),
    delete: (id: number)         => del(`/sections/${id}`),
  },

  // ─── Assessments ───────────────────────────────────────────────────────────
  assessments: {
    list:   (params?: { section_id?: number; week_number?: number }) => {
      const q = new URLSearchParams();
      if (params?.section_id)  q.set("section_id",  String(params.section_id));
      if (params?.week_number) q.set("week_number",  String(params.week_number));
      return get<Assessment[]>(`/assessments${q.toString() ? `?${q}` : ""}`);
    },
    get:    (id: number) => get<Assessment>(`/assessments/${id}`),
    create: (body: Omit<Assessment, "assessment_id">) => post<Assessment>("/assessments", body),
    update: (id: number, body: Omit<Assessment, "assessment_id">) => put<Assessment>(`/assessments/${id}`, body),
    delete: (id: number) => del(`/assessments/${id}`),
  },

  // ─── Events ────────────────────────────────────────────────────────────────
  events: {
    list: (params?: { week_number?: number; section_id?: number; type?: string }) => {
      const q = new URLSearchParams();
      if (params?.week_number) q.set("week_number", String(params.week_number));
      if (params?.section_id)  q.set("section_id",  String(params.section_id));
      if (params?.type)        q.set("type",         params.type);
      return get<Event[]>(`/events${q.toString() ? `?${q}` : ""}`);
    },
    get:    (id: number) => get<Event>(`/events/${id}`),
    create: (body: Omit<Event, "event_id">) => post<Event>("/events", body),
    update: (id: number, body: Omit<Event, "event_id">) => put<Event>(`/events/${id}`, body),
    delete: (id: number) => del(`/events/${id}`),
  },

  // ─── Weekly Knowledge ──────────────────────────────────────────────────────
  knowledge: {
    list:   (params?: { course_id?: number; week_number?: number }) => {
      const q = new URLSearchParams();
      if (params?.course_id)   q.set("course_id",   String(params.course_id));
      if (params?.week_number) q.set("week_number",  String(params.week_number));
      return get<WeeklyKnowledge[]>(`/knowledge${q.toString() ? `?${q}` : ""}`);
    },
    get:    (id: number) => get<WeeklyKnowledge>(`/knowledge/${id}`),
    create: (body: Omit<WeeklyKnowledge, "knowledge_id">) => post<WeeklyKnowledge>("/knowledge", body),
    update: (id: number, body: Omit<WeeklyKnowledge, "knowledge_id">) => put<WeeklyKnowledge>(`/knowledge/${id}`, body),
    delete: (id: number) => del(`/knowledge/${id}`),
  },
};
