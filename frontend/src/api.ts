/**
 * api.ts — typed fetch wrappers for the PATS backend
 * Also exports expandRecurring() to expand recurring event rows
 * into individual occurrences for a given date range.
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
  type:           string;
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
  type:         string;
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

// ─── Recurring event expander ─────────────────────────────────────────────────

/** JS getDay() values: 0=Sun, 1=Mon … 6=Sat */
const DAY_MAP: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

/**
 * Parse a YYYY-MM-DD string as local noon to avoid UTC-midnight
 * rolling back to the previous day in negative-offset timezones.
 */
function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  // Month is 0-indexed in JS Date
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Format a local Date back to YYYY-MM-DD.
 */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Expand recurring events into individual occurrences per week.
 * Non-recurring events pass through unchanged.
 * If a non-recurring override row exists for the same section/title/date,
 * the override takes priority (e.g. a cancelled exception).
 */
export function expandRecurring(events: Event[], weeks: Week[]): Event[] {
  const result: Event[] = [];

  // Build a set of override keys: "section_id:title:YYYY-MM-DD" for
  // non-recurring rows so we can skip generating those occurrences.
  const overrideKeys = new Set<string>();
  for (const ev of events) {
    if (!ev.is_recurring) {
      const dateStr = new Date(ev.start_time)
        .toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
      overrideKeys.add(`${ev.section_id}:${ev.title}:${dateStr}`);
      // Also push the override itself into results
      result.push(ev);
    }
  }

  for (const ev of events) {
    if (!ev.is_recurring || !ev.recur_days) continue;

    // Parse which days of week this event recurs on
    const recurDayNums = ev.recur_days
      .split(",")
      .map(d => DAY_MAP[d.trim().toUpperCase()])
      .filter((n): n is number => n !== undefined);

    if (recurDayNums.length === 0) continue;

    // Duration in ms
    const originStart = new Date(ev.start_time);
    const originEnd   = new Date(ev.end_time);
    const durationMs  = originEnd.getTime() - originStart.getTime();

    // Time of day in UTC from the original event
    const utcHours   = originStart.getUTCHours();
    const utcMinutes = originStart.getUTCMinutes();

    const recEndStr = ev.recur_end ?? "2099-12-31";

    for (const week of weeks) {
      if (week.is_break) continue;
      if (week.start_date > recEndStr) continue;

      // Parse Monday of this week as a local date (avoids TZ rollback)
      const monday = parseLocalDate(week.start_date);
      // Ensure it IS Monday (week.start_date should always be Mon)
      // getDay(): 0=Sun,1=Mon,...,6=Sat
      const startDay = monday.getDay();
      if (startDay !== 1) {
        // Adjust to the Monday of this week just in case
        const diff = startDay === 0 ? -6 : 1 - startDay;
        monday.setDate(monday.getDate() + diff);
      }

      for (const dayNum of recurDayNums) {
        // Offset from Monday: Mon=0, Tue=1, ..., Sun=6
        const offsetFromMon = dayNum === 0 ? 6 : dayNum - 1;
        const targetLocal = new Date(monday);
        targetLocal.setDate(monday.getDate() + offsetFromMon);

        const targetStr = toYMD(targetLocal);

        // Check within week range and before recur_end
        if (targetStr < week.start_date || targetStr > week.end_date) continue;
        if (targetStr > recEndStr) continue;

        // Check for a non-recurring override for this date
        const overrideKey = `${ev.section_id}:${ev.title}:${targetStr}`;
        if (overrideKeys.has(overrideKey)) continue;

        // Build occurrence: same UTC time-of-day, new date
        // Use the target local date but set UTC hours from original
        const occStart = new Date(Date.UTC(
          targetLocal.getFullYear(),
          targetLocal.getMonth(),
          targetLocal.getDate(),
          utcHours,
          utcMinutes,
          0,
          0
        ));
        const occEnd = new Date(occStart.getTime() + durationMs);

        result.push({
          ...ev,
          // Synthetic unique id: won't collide with real ids
          event_id:    -(ev.event_id * 100000 + week.week_number * 10 + dayNum),
          start_time:  occStart.toISOString(),
          end_time:    occEnd.toISOString(),
          week_number: week.week_number,
          // Recurring occurrences are not individually cancellable via popover
          // (would need a real DB row); keep is_recurring true so UI knows
        });
      }
    }
  }

  return result;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  weeks: {
    list: ()          => get<Week[]>("/weeks"),
    get:  (n: number) => get<Week>(`/weeks/${n}`),
  },

  courses: {
    list:   ()                                           => get<Course[]>("/courses"),
    get:    (id: number)                                 => get<Course>(`/courses/${id}`),
    create: (body: Omit<Course, "course_id">)            => post<Course>("/courses", body),
    update: (id: number, body: Omit<Course,"course_id">) => put<Course>(`/courses/${id}`, body),
    delete: (id: number)                                 => del(`/courses/${id}`),
  },

  sections: {
    list:   (course_id?: number) => get<Section[]>(`/sections${course_id ? `?course_id=${course_id}` : ""}`),
    get:    (id: number)         => get<Section>(`/sections/${id}`),
    create: (body: Omit<Section,"section_id">)            => post<Section>("/sections", body),
    update: (id: number, body: Omit<Section,"section_id">)=> put<Section>(`/sections/${id}`, body),
    delete: (id: number)         => del(`/sections/${id}`),
  },

  assessments: {
    list: (params?: { section_id?: number; week_number?: number }) => {
      const q = new URLSearchParams();
      if (params?.section_id)  q.set("section_id",  String(params.section_id));
      if (params?.week_number) q.set("week_number",  String(params.week_number));
      return get<Assessment[]>(`/assessments${q.toString() ? `?${q}` : ""}`);
    },
    get:    (id: number)                                          => get<Assessment>(`/assessments/${id}`),
    create: (body: Omit<Assessment,"assessment_id">)              => post<Assessment>("/assessments", body),
    update: (id: number, body: Omit<Assessment,"assessment_id">) => put<Assessment>(`/assessments/${id}`, body),
    delete: (id: number)                                          => del(`/assessments/${id}`),
  },

  events: {
    list: (params?: { week_number?: number; section_id?: number; type?: string }) => {
      const q = new URLSearchParams();
      if (params?.week_number) q.set("week_number", String(params.week_number));
      if (params?.section_id)  q.set("section_id",  String(params.section_id));
      if (params?.type)        q.set("type",         params.type);
      return get<Event[]>(`/events${q.toString() ? `?${q}` : ""}`);
    },
    get:    (id: number)                               => get<Event>(`/events/${id}`),
    create: (body: Omit<Event,"event_id">)             => post<Event>("/events", body),
    update: (id: number, body: Omit<Event,"event_id">) => put<Event>(`/events/${id}`, body),
    delete: (id: number)                               => del(`/events/${id}`),
  },

  knowledge: {
    list: (params?: { course_id?: number; week_number?: number }) => {
      const q = new URLSearchParams();
      if (params?.course_id)   q.set("course_id",   String(params.course_id));
      if (params?.week_number) q.set("week_number",  String(params.week_number));
      return get<WeeklyKnowledge[]>(`/knowledge${q.toString() ? `?${q}` : ""}`);
    },
    get:    (id: number)                                              => get<WeeklyKnowledge>(`/knowledge/${id}`),
    create: (body: Omit<WeeklyKnowledge,"knowledge_id">)              => post<WeeklyKnowledge>("/knowledge", body),
    update: (id: number, body: Omit<WeeklyKnowledge,"knowledge_id">) => put<WeeklyKnowledge>(`/knowledge/${id}`, body),
    delete: (id: number)                                              => del(`/knowledge/${id}`),
  },
};
