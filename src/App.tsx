/**
 * App.tsx — Root layout
 * - Collapsible sidebar (icon-only when collapsed) on desktop
 * - Slide-in drawer on mobile with hamburger button
 * - Floating + button on all pages → AddEventModal overlay
 */

import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, Course } from "./api";

import DayView      from "./pages/DayView";
import WeekView     from "./pages/WeekView";
import Assessments  from "./pages/Assessments";
import Grades       from "./pages/Grades";
import CourseDetail from "./pages/CourseDetail";
import Settings     from "./pages/Settings";
import AddEventModal from "./components/AddEventModal";

// ── Icons (inline SVG, no deps) ───────────────────────────────────────────────

function IconToday()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IconWeek()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="9" y1="4" x2="9" y2="20"/></svg>; }
function IconAssess()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>; }
function IconGrades()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function IconSettings() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>; }
function IconMenu()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>; }
function IconCollapse() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>; }
function IconExpand()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconPlus()     { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }

// ── Nav items config ──────────────────────────────────────────────────────────

const NAV = [
  { to: "/",           label: "Today",       Icon: IconToday   },
  { to: "/week",       label: "Week",        Icon: IconWeek    },
  { to: "/assessments",label: "Assessments", Icon: IconAssess  },
  { to: "/grades",     label: "Grades",      Icon: IconGrades  },
];

// ── Sidebar content ───────────────────────────────────────────────────────────

function SidebarContent({
  collapsed, courses, onClose
}: {
  collapsed: boolean;
  courses: Course[];
  onClose?: () => void;
}) {
  const navigate = useNavigate();

  function navItem({ to, label, Icon }: typeof NAV[0]) {
    return (
      <NavLink
        key={to}
        to={to}
        end={to === "/"}
        onClick={onClose}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isActive
              ? "bg-white/8 text-white"
              : "text-[#666] hover:text-[#ccc] hover:bg-white/4"
          }`
        }
      >
        <span className="flex-shrink-0"><Icon /></span>
        {!collapsed && <span className="truncate">{label}</span>}
      </NavLink>
    );
  }

  return (
    <div className="flex flex-col h-full py-4 px-2">
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-3 mb-6 cursor-pointer ${collapsed ? "justify-center" : ""}`}
        onClick={() => { navigate("/"); onClose?.(); }}
      >
        <div className="w-8 h-8 rounded-xl bg-[#6366f1] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">P</span>
        </div>
        {!collapsed && (
          <div>
            <div className="text-white font-bold text-sm leading-none">PATS</div>
            <div className="text-[#444] text-xs mt-0.5">Academic Planner</div>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5">
        {NAV.map(item => navItem(item))}
      </nav>

      {/* Courses */}
      {!collapsed && (
        <div className="mt-5">
          <div className="px-3 mb-1.5 text-xs text-[#333] uppercase tracking-widest font-semibold">
            Courses
          </div>
          <nav className="flex flex-col gap-0.5">
            {courses.map(c => (
              <NavLink
                key={c.course_id}
                to={`/courses/${c.course_id}`}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                    isActive
                      ? "bg-white/8 text-white"
                      : "text-[#555] hover:text-[#ccc] hover:bg-white/4"
                  }`
                }
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="truncate">{c.short_name}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Collapsed: just course dots */}
      {collapsed && (
        <div className="mt-4 flex flex-col items-center gap-2">
          {courses.map(c => (
            <NavLink key={c.course_id} to={`/courses/${c.course_id}`}>
              <span
                className="w-2.5 h-2.5 rounded-full block"
                style={{ backgroundColor: c.color }}
                title={c.short_name}
              />
            </NavLink>
          ))}
        </div>
      )}

      {/* Bottom */}
      <div className="mt-auto flex flex-col gap-0.5">
        {navItem({ to: "/settings", label: "Settings", Icon: IconSettings })}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [courses,       setCourses]       = useState<Course[]>([]);
  const [collapsed,     setCollapsed]     = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [showAddModal,  setShowAddModal]  = useState(false);

  useEffect(() => {
    api.courses.list().then(setCourses).catch(console.error);
  }, []);

  return (
    <div className="flex h-screen bg-black overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <aside
        className="sidebar hidden md:flex flex-col border-r border-[#111] overflow-y-auto overflow-x-hidden"
        style={{ width: collapsed ? 56 : 200 }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute top-4 z-10 w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[#555] hover:text-white transition-all"
          style={{ left: collapsed ? 44 : 188 }}
        >
          {collapsed ? <IconExpand /> : <IconCollapse />}
        </button>

        <SidebarContent collapsed={collapsed} courses={courses} />
      </aside>

      {/* ── Mobile: hamburger button ── */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center text-[#888] hover:text-white"
        onClick={() => setMobileOpen(true)}
      >
        <IconMenu />
      </button>

      {/* ── Mobile: drawer overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          {/* drawer */}
          <div className="relative w-56 h-full bg-[#111] border-r border-[#1e1e1e] overflow-y-auto z-10">
            <SidebarContent
              collapsed={false}
              courses={courses}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto min-w-0 relative">
        <Routes>
          <Route path="/"             element={<DayView />} />
          <Route path="/week"         element={<WeekView />} />
          <Route path="/assessments"  element={<Assessments />} />
          <Route path="/grades"       element={<Grades />} />
          <Route path="/courses/:id"  element={<CourseDetail />} />
          <Route path="/settings"     element={<Settings />} />
        </Routes>
      </main>

      {/* ── Floating + button (all pages) ── */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 z-40 w-13 h-13 rounded-2xl bg-[#6366f1] text-white shadow-lg shadow-indigo-900/40 flex items-center justify-center hover:bg-indigo-500 active:scale-95 transition-all"
        style={{ width: 52, height: 52 }}
        title="Add event"
      >
        <IconPlus />
      </button>

      {/* ── Add event modal ── */}
      {showAddModal && (
        <AddEventModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
