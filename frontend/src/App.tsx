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

const IconToday    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconWeek     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="16" x2="21" y2="16"/><line x1="9" y1="4" x2="9" y2="20"/></svg>;
const IconAssess   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>;
const IconGrades   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconSettings = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IconMenu     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IconX        = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconPlus     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

// Chevron that shows collapse direction
const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {collapsed
      ? <polyline points="9 18 15 12 9 6"/>
      : <polyline points="15 18 9 12 15 6"/>}
  </svg>
);

const NAV = [
  { to:"/",            label:"Today",       Icon:IconToday   },
  { to:"/week",        label:"Week",        Icon:IconWeek    },
  { to:"/assessments", label:"Assessments", Icon:IconAssess  },
  { to:"/grades",      label:"Grades",      Icon:IconGrades  },
];

function SidebarContent({ collapsed, courses, onClose }: { collapsed:boolean; courses:Course[]; onClose?:()=>void }) {
  const navigate = useNavigate();
  const navCls = (isActive: boolean) => [
    "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 select-none",
    collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2",
    isActive ? "bg-[#6366f1]/15 text-[#818cf8]" : "text-[#4e4e5a] hover:text-[#e0e0e8] hover:bg-[#1a1a1f]",
  ].join(" ");

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", padding: collapsed ? "18px 0" : "18px 16px", justifyContent: collapsed ? "center" : "flex-start", flexShrink:0 }}
        onClick={() => { navigate("/"); onClose?.(); }}>
        <div style={{ width:32, height:32, borderRadius:9, background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ color:"#fff", fontSize:13, fontWeight:700 }}>P</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{ color:"var(--text)", fontWeight:600, fontSize:14, lineHeight:1 }}>PATS</div>
            <div style={{ color:"var(--text-3)", fontSize:11, marginTop:2 }}>Academic Planner</div>
          </div>
        )}
      </div>
      <div className="divider" style={{ margin:"0 12px", flexShrink:0 }} />
      <nav style={{ display:"flex", flexDirection:"column", gap:2, padding:"12px 8px", flexShrink:0 }}>
        {!collapsed && <div className="section-label" style={{ padding:"0 10px", marginBottom:6 }}>Schedule</div>}
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to==="/"} onClick={onClose} title={collapsed ? label : undefined}
            className={({ isActive }) => navCls(isActive)}>
            <span style={{ flexShrink:0 }}><Icon /></span>
            {!collapsed && <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <nav style={{ display:"flex", flexDirection:"column", gap:2, padding:"0 8px", flex:1, overflowY:"auto" }}>
        {!collapsed && <div className="section-label" style={{ padding:"8px 10px 6px" }}>Courses</div>}
        {courses.map(c => (
          <NavLink key={c.course_id} to={`/courses/${c.course_id}`} onClick={onClose} title={collapsed ? c.short_name : undefined}
            className={({ isActive }) => navCls(isActive)}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:c.color, flexShrink:0 }} />
            {!collapsed && <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.short_name}</span>}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding:"8px 8px 12px", flexShrink:0 }}>
        <div className="divider" style={{ margin:"0 4px 8px" }} />
        <NavLink to="/settings" onClick={onClose} title={collapsed ? "Settings" : undefined}
          className={({ isActive }) => navCls(isActive)}>
          <span style={{ flexShrink:0 }}><IconSettings /></span>
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </div>
  );
}

export default function App() {
  const [courses,      setCourses]      = useState<Course[]>([]);
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { api.courses.list().then(setCourses).catch(console.error); }, []);

  const sidebarW = collapsed ? 56 : 210;

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>

      {/* ── Desktop sidebar ── */}
      <aside
        className="sidebar-transition hidden md:flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: sidebarW, background:"#0a0a0d", borderRight:"1px solid var(--border-dim)", position:"relative", zIndex:10 }}
      >
        <SidebarContent collapsed={collapsed} courses={courses} />

        {/*
          Collapse toggle — sits ON the sidebar's right edge as a floating pill.
          translateX(50%) pushes it exactly half-outside the sidebar so it straddles the border.
          z-index 20 keeps it above main content. No clipping issues.
        */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            transform: "translate(50%, -50%)",
            zIndex: 20,
            width: 22,
            height: 44,
            borderRadius: 11,
            background: "var(--bg-card2)",
            border: "1px solid var(--border)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-3)",
            transition: "background 0.15s, color 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "var(--bg-card2)";
            e.currentTarget.style.color = "var(--text-3)";
          }}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </aside>

      {/* ── Mobile hamburger ── */}
      <button className="show-mobile" onClick={() => setMobileOpen(true)}
        style={{ position:"fixed", top:12, left:12, zIndex:50, width:36, height:36, borderRadius:9, background:"var(--bg-card)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
        <IconMenu />
      </button>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(2px)" }} onClick={() => setMobileOpen(false)} />
          <div style={{ position:"relative", width:230, background:"#0a0a0d", borderRight:"1px solid var(--border-dim)", display:"flex", flexDirection:"column", overflowY:"auto", zIndex:10 }}>
            <button onClick={() => setMobileOpen(false)} className="btn-icon" style={{ position:"absolute", top:12, right:12, width:28, height:28 }}><IconX /></button>
            <SidebarContent collapsed={false} courses={courses} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main style={{ flex:1, overflowY:"auto", background:"var(--bg)", minWidth:0, position:"relative" }}>
        <Routes>
          <Route path="/"             element={<DayView />} />
          <Route path="/week"         element={<WeekView />} />
          <Route path="/assessments"  element={<Assessments />} />
          <Route path="/grades"       element={<Grades />} />
          <Route path="/courses/:id"  element={<CourseDetail />} />
          <Route path="/settings"     element={<Settings />} />
        </Routes>
      </main>

      {/* ── FAB ── */}
      <button onClick={() => setShowAddModal(true)} title="Add event"
        style={{ position:"fixed", bottom:22, right:22, width:48, height:48, borderRadius:14, background:"var(--accent)", color:"#fff", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 20px rgba(99,102,241,0.4)", zIndex:40, transition:"all 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}>
        <IconPlus />
      </button>

      {showAddModal && (
        <AddEventModal onClose={() => setShowAddModal(false)} onSaved={() => { setShowAddModal(false); window.location.reload(); }} />
      )}
    </div>
  );
}
