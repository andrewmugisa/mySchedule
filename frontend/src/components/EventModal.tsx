/**
 * EventModal.tsx — unified Add / Edit modal for events.
 *
 * Time handling:
 *   The DB stores TIMESTAMP WITH TIME ZONE. The backend container has no TZ
 *   env var so it runs UTC. We always send timestamps with an explicit
 *   "-04:00" (EDT) or "-05:00" (EST) offset so Postgres stores the correct
 *   UTC instant regardless of server location.
 *
 * Recurring edit:
 *   When editing a recurring occurrence (event_id < 0) we ask the user
 *   "this date only" vs "all occurrences". "This date only" creates a
 *   standalone override event; "all" updates the seed event.
 */
import { useState, useEffect } from "react";
import { api, Event, Section, Course } from "../api";

const ALL_DAYS = ["S","M","T","W","T","F","S"];
const DAY_KEYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

// ── Toronto offset ──────────────────────────────────────────────────────────
function getTorontoOffset(): string {
  // America/Toronto is UTC-5 (EST) in winter, UTC-4 (EDT) in summer.
  // We detect DST by comparing Jan vs Jul offset in the user's browser.
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(now.getFullYear(), 6, 1).getTimezoneOffset();
  const isDST = now.getTimezoneOffset() < Math.max(jan, jul);
  return isDST ? "-04:00" : "-05:00";
}

function buildISO(date: string, time: string): string {
  return `${date}T${time}:00${getTorontoOffset()}`;
}

function toDateInput(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function toTimeInput(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto",
  });
}

// ── Props ───────────────────────────────────────────────────────────────────
interface Props {
  mode: "add" | "edit";
  event?: Event;        // provided in edit mode
  defaultDate?: string; // YYYY-MM-DD, used in add mode
  onClose: () => void;
  onSaved: () => void;  // parent reloads data
}

export default function EventModal({ mode, event, defaultDate, onClose, onSaved }: Props) {
  const isEdit      = mode === "edit";
  const isRecurring = isEdit && event!.event_id < 0;

  // For recurring edits: which seed event_id to update
  // Seed id is derived from the synthetic negative id: -(seed*100000 + wk*10 + day)
  function getSeedId(syntheticId: number): number {
    // We don't store this cleanly, so we'll use the section+title approach via create
    // For "all": we need the real positive parent. We'll ask the backend via a list.
    return -syntheticId; // placeholder — handled below
  }

  const [recurChoice, setRecurChoice]  = useState<"this"|"all"|null>(isRecurring ? null : "all");
  const today = defaultDate ?? toDateInput(new Date().toISOString());

  const [title,     setTitle]     = useState(isEdit ? event!.title    : "");
  const [evType,    setEvType]    = useState<"PERSONAL"|"CLASS">(isEdit ? event!.type as any : "PERSONAL");
  const [sectionId, setSectionId] = useState<number|null>(isEdit ? event!.section_id : null);
  const [date,      setDate]      = useState(isEdit ? toDateInput(event!.start_time) : today);
  const [startT,    setStartT]    = useState(isEdit ? toTimeInput(event!.start_time) : "09:00");
  const [endT,      setEndT]      = useState(isEdit ? toTimeInput(event!.end_time)   : "10:00");
  const [location,  setLocation]  = useState(isEdit ? (event!.location ?? "") : "");
  const [notes,     setNotes]     = useState(isEdit ? (event!.notes ?? "")    : "");
  const [repeating, setRepeating] = useState(isEdit ? event!.is_recurring : false);
  const [recurDays, setRecurDays] = useState<Set<string>>(
    isEdit && event!.recur_days ? new Set(event!.recur_days.split(",").map(d => d.trim())) : new Set()
  );
  const [recurEnd,  setRecurEnd]  = useState(isEdit ? (event!.recur_end ?? "") : "");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [courses,   setCourses]   = useState<Course[]>([]);
  const [sections,  setSections]  = useState<Section[]>([]);

  useEffect(() => {
    Promise.all([api.courses.list(), api.sections.list()])
      .then(([co, se]) => { setCourses(co); setSections(se); })
      .catch(console.error);
  }, []);

  function toggleDay(k: string) {
    setRecurDays(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  const sectionOpts = sections.map(s => {
    const c = courses.find(c => c.course_id === s.course_id);
    return { value: s.section_id, label: `${c?.short_name ?? ""} — ${s.type} ${s.section_number} (${s.day_of_week?.slice(0,3)} ${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)})` };
  });

  // ── Validate & save ──────────────────────────────────────────────────────
  async function save() {
    if (!title.trim())                     { setError("Title required."); return; }
    if (!date)                             { setError("Date required."); return; }
    if (startT >= endT)                    { setError("End must be after start."); return; }
    if (evType === "CLASS" && !sectionId)  { setError("Pick a section."); return; }
    if (repeating && recurDays.size === 0) { setError("Pick at least one repeat day."); return; }
    if (isRecurring && recurChoice === null) { setError("Choose whether to edit this date or all occurrences."); return; }

    setSaving(true); setError("");

    const payload = {
      section_id:   evType === "CLASS" ? sectionId : null,
      title:        title.trim(),
      type:         evType,
      start_time:   buildISO(date, startT),
      end_time:     buildISO(date, endT),
      week_number:  null,
      location:     location.trim() || null,
      notes:        notes.trim()    || null,
      is_cancelled: isEdit ? event!.is_cancelled : false,
      is_recurring: repeating,
      recur_days:   repeating ? Array.from(recurDays).join(",") : null,
      recur_end:    repeating && recurEnd ? recurEnd : null,
    };

    try {
      if (!isEdit) {
        // Add new event
        await api.events.create(payload);
      } else if (isRecurring && recurChoice === "this") {
        // Override: create a one-off non-recurring event for this date only
        await api.events.create({ ...payload, is_recurring: false, recur_days: null, recur_end: null });
      } else {
        // Edit seed (real event_id for non-recurring; for recurring we need the real id)
        // For a recurring occurrence, event_id is negative — we find seed via title+section match
        // The real seed id is stored positively; we recover it via GET /events filtered by section
        let realId = event!.event_id;
        if (realId < 0) {
          // Fetch all events to find the seed with matching title + section_id
          const all = await api.events.list();
          const seed = all.find(e => e.is_recurring && e.title === event!.title && e.section_id === event!.section_id);
          if (!seed) throw new Error("Could not find parent recurring event.");
          realId = seed.event_id;
        }
        await api.events.update(realId, payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "Failed to save.");
    } finally { setSaving(false); }
  }

  // ── Recurring choice screen ──────────────────────────────────────────────
  if (isRecurring && recurChoice === null) {
    return (
      <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="overlay-panel" style={{ maxWidth: 380 }}>
          <h2 style={{ fontSize:15, fontWeight:600, color:"var(--text)", marginBottom:8 }}>Edit recurring event</h2>
          <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:20 }}>
            <strong style={{ color:"var(--text-2)" }}>{event!.title}</strong> repeats on a schedule. What do you want to change?
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => setRecurChoice("this")}
              style={{ padding:"12px 16px", borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-input)", cursor:"pointer", textAlign:"left", fontFamily:"inherit", transition:"border-color 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:3 }}>This date only</div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>Creates a one-off override for {toDateInput(event!.start_time)}. Other occurrences unchanged.</div>
            </button>
            <button onClick={() => setRecurChoice("all")}
              style={{ padding:"12px 16px", borderRadius:10, border:"1px solid var(--border)", background:"var(--bg-input)", cursor:"pointer", textAlign:"left", fontFamily:"inherit", transition:"border-color 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="var(--accent)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", marginBottom:3 }}>All occurrences</div>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>Updates the recurring series. All future dates will reflect this change.</div>
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="overlay-panel" style={{ maxWidth: 480 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div>
            <h2 style={{ fontSize:15, fontWeight:600, color:"var(--text)" }}>
              {isEdit ? "Edit event" : "Add event"}
            </h2>
            {isRecurring && recurChoice === "this" && (
              <div style={{ fontSize:11, color:"var(--orange)", marginTop:2 }}>Editing this date only · {toDateInput(event!.start_time)}</div>
            )}
            {isRecurring && recurChoice === "all" && (
              <div style={{ fontSize:11, color:"var(--accent-hover)", marginTop:2 }}>Editing all occurrences</div>
            )}
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width:28, height:28 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Type */}
          <div>
            <label className="label">Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              {(["PERSONAL","CLASS"] as const).map(t => (
                <button key={t} type="button" onClick={() => { setEvType(t); setSectionId(null); }}
                  style={{ padding:"7px 0", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                    border:`1px solid ${evType===t?"var(--accent)":"var(--border)"}`,
                    background:evType===t?"var(--accent-dim)":"var(--bg-input)",
                    color:evType===t?"var(--accent-hover)":"var(--text-2)" }}>
                  {t==="PERSONAL" ? "🏃 Personal" : "📚 Class"}
                </button>
              ))}
            </div>
          </div>

          {evType === "CLASS" && (
            <div>
              <label className="label">Section</label>
              <select className="select" value={sectionId ?? ""} onChange={e => setSectionId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select…</option>
                {sectionOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Title</label>
            <input autoFocus className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Study session" onKeyDown={e => e.key==="Enter" && save()} />
          </div>

          <div>
            <label className="label">Location (optional)</label>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Library, room 204" />
          </div>

          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label className="label">Start</label><input type="time" className="input" value={startT} onChange={e => setStartT(e.target.value)} /></div>
            <div><label className="label">End</label><input type="time" className="input" value={endT} onChange={e => setEndT(e.target.value)} /></div>
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input" value={notes} onChange={e => setNotes(e.target.value)}
              style={{ height:60, resize:"vertical", padding:"8px 12px" }} placeholder="Any notes…" />
          </div>

          {/* Only show repeat toggle for add / editing all */}
          {(!isEdit || recurChoice === "all") && (
            <>
              <button type="button" onClick={() => setRepeating(r => !r)}
                style={{ display:"flex", alignItems:"center", gap:10, background:"none", border:"none", cursor:"pointer", padding:"2px 0", fontFamily:"inherit" }}>
                <div className="toggle-track" style={{ background:repeating?"var(--accent)":"var(--bg-hover)" }}>
                  <div className="toggle-thumb" style={{ left:repeating?20:2 }} />
                </div>
                <span style={{ fontSize:13, color:"var(--text-2)" }}>Repeating event</span>
              </button>

              {repeating && (
                <div style={{ background:"var(--bg-input)", border:"1px solid var(--border)", borderRadius:10, padding:14, display:"flex", flexDirection:"column", gap:12 }}>
                  <div>
                    <label className="label" style={{ marginBottom:8 }}>Repeat on</label>
                    <div style={{ display:"flex", gap:5 }}>
                      {ALL_DAYS.map((label,i) => { const key=DAY_KEYS[i]; const on=recurDays.has(key); return (
                        <button key={i} type="button" onClick={() => toggleDay(key)} className={`day-btn${on?" active":""}`}>{label}</button>
                      );})}
                    </div>
                  </div>
                  <div><label className="label">Ends on</label><input type="date" className="input" value={recurEnd} onChange={e => setRecurEnd(e.target.value)} /></div>
                </div>
              )}
            </>
          )}

          {error && <p style={{ fontSize:12, color:"var(--red)" }}>{error}</p>}

          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={save} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
