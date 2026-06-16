/**
 * App.tsx — Root layout
 * v0 sidebar design adapted to Vite + React Router
 * - Collapsible desktop sidebar (icon-only mode)
 * - Mobile hamburger + slide-in drawer
 * - Floating + button → AddEventModal
 */

import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, Course } from "./api";

import DayView       from "./pages/DayView";
import WeekView      from "./pages/WeekView";
import Assessments   from "./pages/Assessments";
import Grades        from "./pages/Grades";
import CourseDetail  from "./pages/CourseDetail";
import Settings      from "./pages/Settings";
import AddEventModal from "./components/AddEventModal";

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconToday = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconWeek = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="9" y1="4" x2="9" y2="20"/>
  </svg>
);
const IconAssess = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);
const IconGrades = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconPlus = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV = [
  { to: "/",            label: "Today",       Icon: IconToday   },
  { to: "/week",        label: "Week",        Icon: IconWeek    },
  { to: "/assessments", label: "Assessments", Icon: IconAssess  },
  { to: "/grades",      label: "Grades",      Icon: IconGrades  },
];

// ── Sidebar inner content ─────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  courses,
  onClose,
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
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          [
            "flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 select-none",
            collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2.5",
            isActive
              ? "bg-[#6366f1]/15 text-[#818cf8]"
              : "text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1c1c1f]",
          ].join(" ")
        }
      >
        <span className="flex-shrink-0"><Icon /></span>
        {!collapsed && <span className="truncate">{label}</span>}
      </NavLink>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={[
          "flex items-center gap-3 cursor-pointer py-5 flex-shrink-0",
          collapsed ? "justify-center px-3" : "px-5",
        ].join(" ")}
        onClick={() => { navigate("/"); onClose?.(); }}
      >
        <div className="w-9 h-9 rounded-xl bg-[#6366f1] flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/30">
          <span className="text-white text-sm font-bold tracking-tight">P</span>
        </div>
        {!collapsed && (
          <div>
            <div className="text-[#fafafa] font-semibold text-[15px] leading-none">PATS</div>
            <div className="text-[#52525b] text-xs mt-0.5">Academic Planner</div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="divider mx-3 flex-shrink-0" />

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-2 pt-4 flex-shrink-0">
        {!collapsed && (
          <div className="section-label px-3 mb-2">Schedule</div>
        )}
        {NAV.map(item => navItem(item))}
      </nav>

      {/* Courses */}
      <nav className="flex flex-col gap-0.5 px-2 pt-5 flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="section-label px-3 mb-2">Courses</div>
        )}
        {courses.map(c => (
          <NavLink
            key={c.course_id}
            to={`/courses/${c.course_id}`}
            onClick={onClose}
            title={collapsed ? c.short_name : undefined}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 select-none",
                collapsed ? "justify-center px-0 py-2 mx-1" : "px-3 py-2",
                isActive
                  ? "bg-[#1c1c1f] text-[#fafafa]"
                  : "text-[#71717a] hover:text-[#e4e4e7] hover:bg-[#1c1c1f]",
              ].join(" ")
            }
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-black/20"
              style={{ backgroundColor: c.color }}
            />
            {!collapsed && <span className="truncate">{c.short_name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 flex-shrink-0">
        <div className="divider mx-1 mb-3" />
        {navItem({ to: "/settings", label: "Settings", Icon: IconSettings })}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [courses,      setCourses]      = useState<Course[]>([]);
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    api.courses.list().then(setCourses).catch(console.error);
  }, []);

  const sidebarW = collapsed ? 60 : 220;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Desktop sidebar ── */}
      <aside
        className="sidebar-transition hidden md:flex flex-col flex-shrink-0 overflow-hidden relative"
        style={{
          width: sidebarW,
          background: "#0d0d0f",
          borderRight: "1px solid var(--border-dim)",
        }}
      >
        <SidebarContent collapsed={collapsed} courses={courses} />

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="btn-icon absolute z-20"
          style={{
            top: 20,
            right: -14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--bg-card2)",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
      </aside>

      {/* ── Mobile hamburger ── */}
      <button
        className="show-mobile fixed top-4 left-4 z-50 btn-icon"
        style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg-card)" }}
        onClick={() => setMobileOpen(true)}
      >
        <IconMenu />
      </button>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="relative flex flex-col overflow-y-auto z-10"
            style={{ width: 240, background: "#0d0d0f", borderRight: "1px solid var(--border-dim)" }}
          >
            {/* Close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="btn-icon absolute top-4 right-4 z-10"
              style={{ width: 30, height: 30 }}
            >
              <IconX />
            </button>
            <SidebarContent
              collapsed={false}
              courses={courses}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ── Main ── */}
      <main
        className="flex-1 overflow-y-auto min-w-0"
        style={{ background: "var(--bg)" }}
      >
        <Routes>
          <Route path="/"             element={<DayView />} />
          <Route path="/week"         element={<WeekView />} />
          <Route path="/assessments"  element={<Assessments />} />
          <Route path="/grades"       element={<Grades />} />
          <Route path="/courses/:id"  element={<CourseDetail />} />
          <Route path="/settings"     element={<Settings />} />
        </Routes>
      </main>

      {/* ── Floating + button ── */}
      <button
        onClick={() => setShowAddModal(true)}
        title="Add event"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: 16,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(99,102,241,0.35)",
          zIndex: 40,
          transition: "all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}
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
