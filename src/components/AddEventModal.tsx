/**
 * AddEventModal.tsx — Overlay modal for adding a personal event
 * Supports one-off and repeating events with day picker
 */

import { useState } from "react";
import { api } from "../api";

const ALL_DAYS   = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_KEYS   = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface Props {
  onClose:  () => void;
  onSaved:  () => void;
  defaultDate?: string; // YYYY-MM-DD
}

export default function AddEventModal({ onClose, onSaved, defaultDate }: Props) {
  const today = defaultDate ?? new Date().toISOString().slice(0, 10);

  const [title,      setTitle]      = useState("");
  const [date,       setDate]       = useState(today);
  const [startTime,  setStartTime]  = useState("09:00");
  const [endTime,    setEndTime]    = useState("10:00");
  const [repeating,  setRepeating]  = useState(false);
  const [recurDays,  setRecurDays]  = useState<Set<string>>(new Set());
  const [recurEnd,   setRecurEnd]   = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  function toggleDay(key: string) {
    setRecurDays(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function save() {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!date)         { setError("Date is required."); return; }
    if (startTime >= endTime) { setError("End time must be after start time."); return; }
    if (repeating && recurDays.size === 0) { setError("Pick at least one day."); return; }

    setSaving(true);
    setError("");
    try {
      await api.events.create({
        section_id:   null,
        title:        title.trim(),
        type:         "PERSONAL",
        start_time:   `${date}T${startTime}:00`,
        end_time:     `${date}T${endTime}:00`,
        week_number:  null,
        location:     null,
        notes:        null,
        is_cancelled: false,
        is_recurring: repeating,
        recur_days:   repeating ? Array.from(recurDays).join(",") : null,
        recur_end:    repeating && recurEnd ? recurEnd : null,
      });
      onSaved();
    } catch (e) {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="overlay-panel">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Add event</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#555] hover:text-white hover:bg-white/8 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          {/* Title */}
          <div>
            <label className="block text-xs text-[#555] mb-1">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Library study session"
              className="input"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-[#555] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#555] mb-1">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-[#555] mb-1">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Repeating toggle */}
          <button
            type="button"
            onClick={() => setRepeating(r => !r)}
            className="flex items-center gap-3 py-2 text-left"
          >
            <div className={`w-10 h-6 rounded-full relative transition-colors ${repeating ? "bg-[#6366f1]" : "bg-[#222]"}`}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${repeating ? "left-5" : "left-1"}`} />
            </div>
            <span className="text-sm text-[#888]">Repeating event</span>
          </button>

          {/* Repeating options */}
          {repeating && (
            <div className="flex flex-col gap-3 p-3 bg-[#111] rounded-xl border border-[#1e1e1e]">
              <div>
                <label className="block text-xs text-[#555] mb-2">Repeat on</label>
                <div className="flex gap-1.5">
                  {ALL_DAYS.map((label, i) => {
                    const key = DAY_KEYS[i];
                    const on  = recurDays.has(key);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(key)}
                        className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                          on
                            ? "bg-[#6366f1] text-white"
                            : "bg-[#1a1a1a] text-[#555] hover:text-[#aaa] border border-[#2a2a2a]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#555] mb-1">Ends on</label>
                <input
                  type="date"
                  value={recurEnd}
                  onChange={e => setRecurEnd(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-1">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : "Add event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
