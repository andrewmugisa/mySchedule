import { useEffect, useState, useMemo } from "react";
import { api, Event, Assessment, Course, Section, Week, expandRecurring } from "../api";
import { localDate, fmtTime12 } from "../utils";

function getMonday(d: Date): Date { const day=d.getDay(),mon=new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1)); mon.setHours(0,0,0,0); return mon; }
const DAY_LABELS=["Mon","Tue","Wed","Thu","Fri"];

export default function WeekView() {
  const [monday,setMonday]    = useState(()=>getMonday(new Date()));
  const [events,setEvents]    = useState<Event[]>([]);
  const [assessments,setAs]   = useState<Assessment[]>([]);
  const [courses,setCourses]  = useState<Course[]>([]);
  const [sections,setSections]= useState<Section[]>([]);
  const [weeks,setWeeks]      = useState<Week[]>([]);
  const [loading,setLoading]  = useState(true);
  const today=new Date();

  useEffect(()=>{
    Promise.all([api.events.list(),api.assessments.list(),api.courses.list(),api.sections.list(),api.weeks.list()])
      .then(([ev,as,co,se,wk])=>{ setEvents(expandRecurring(ev,wk));setAs(as);setCourses(co);setSections(se);setWeeks(wk);setLoading(false); })
      .catch(console.error);
  },[]);

  const courseMap  = useMemo(()=>Object.fromEntries(courses.map(c=>[c.course_id,c])),[courses]);
  const sectionMap = useMemo(()=>Object.fromEntries(sections.map(s=>[s.section_id,s])),[sections]);
  const weekDays   = useMemo(()=>Array.from({length:5},(_,i)=>{ const d=new Date(monday);d.setDate(monday.getDate()+i);return d; }),[monday]);
  const friday     = useMemo(()=>{ const f=new Date(monday);f.setDate(monday.getDate()+4);return f; },[monday]);
  const currentWeek= useMemo(()=>{ const d=monday.toISOString().slice(0,10); return weeks.find(w=>w.start_date<=d&&w.end_date>=d); },[weeks,monday]);
  const dueThisWeek= useMemo(()=>{ if(!currentWeek)return[]; return assessments.filter(a=>a.week_number===currentWeek.week_number&&parseFloat(a.score)===0); },[assessments,currentWeek]);

  function eventsForDay(day:Date){ const ds=localDate(day.toISOString()); return events.filter(e=>localDate(e.start_time)===ds).sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime()); }
  function assessmentsForDay(day:Date){ return assessments.filter(a=>{ if(!a.due_date)return false; return localDate(a.due_date)===localDate(day.toISOString()); }); }
  function evColor(ev:Event){ if(!ev.section_id)return"#71717a";const sec=sectionMap[ev.section_id];return sec?(courseMap[sec.course_id]?.color??"#71717a"):"#71717a"; }
  function evLabel(ev:Event){ if(!ev.section_id)return"Personal";const sec=sectionMap[ev.section_id];const c=sec?courseMap[sec.course_id]:null;return c?`${c.short_name}${ev.location?` · ${ev.location}`:""}` :""; }

  const isCurrentWeek=getMonday(today).toDateString()===monday.toDateString();

  if(loading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text-3)"}}>Loading…</div>;

  function fmtShort(iso:string){return new Date(iso).toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"});}

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"24px 28px 18px",borderBottom:"1px solid var(--border-dim)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>
              {currentWeek?`Week ${currentWeek.week_number} of 15`:""}
              {currentWeek?.is_break&&<span style={{marginLeft:8,fontSize:10,padding:"1px 8px",borderRadius:99,background:"var(--bg-hover)",border:"1px solid var(--border)",color:"var(--text-2)"}}>Break</span>}
            </div>
            <h1 style={{fontSize:32,fontWeight:700,color:"var(--text)",letterSpacing:"-0.02em",lineHeight:1}}>Week {currentWeek?.week_number??"—"}</h1>
            <div style={{fontSize:13,color:"var(--text-3)",marginTop:5}}>
              {monday.toLocaleDateString("en-CA",{month:"long",day:"numeric"})} – {friday.toLocaleDateString("en-CA",{month:"long",day:"numeric",year:"numeric"})}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button className="btn-icon" onClick={()=>{const d=new Date(monday);d.setDate(d.getDate()-7);setMonday(d);}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className="btn" onClick={()=>setMonday(getMonday(new Date()))}
              style={{background:isCurrentWeek?"var(--accent)":"transparent",color:isCurrentWeek?"#fff":"var(--text-2)",border:`1px solid ${isCurrentWeek?"var(--accent)":"var(--border)"}`,padding:"6px 14px",fontFamily:"inherit"}}>
              This week
            </button>
            <button className="btn-icon" onClick={()=>{const d=new Date(monday);d.setDate(d.getDate()+7);setMonday(d);}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {dueThisWeek.length>0&&(
        <div style={{margin:"12px 24px 0",padding:"10px 14px",borderRadius:10,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:7}}>Due this week</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {dueThisWeek.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return<span key={a.assessment_id} className="badge" style={{background:(course?.color??"#888")+"18",borderColor:(course?.color??"#888")+"35",color:course?.color??"#888"}}>{a.title} · {a.due_date?fmtShort(a.due_date):`Wk ${a.week_number}`} · {a.weight_percent}%</span>;})}
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",padding:"16px 24px 40px"}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:10}}>
          {weekDays.map((day,i)=>{const isToday=day.toDateString()===today.toDateString();return(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:500,color:"var(--text-3)",marginBottom:5}}>{DAY_LABELS[i]}</div>
              <div style={{fontSize:18,fontWeight:700,width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",background:isToday?"var(--accent)":"transparent",color:isToday?"#fff":"var(--text-2)"}}>{day.getDate()}</div>
            </div>
          );})}
        </div>
        {/* Event cards grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
          {weekDays.map((day,i)=>{
            const dayEvs=eventsForDay(day),dayDues=assessmentsForDay(day),isToday=day.toDateString()===today.toDateString();
            return(
              <div key={i} style={{display:"flex",flexDirection:"column",gap:6,minHeight:140,borderRadius:12,padding:6,background:isToday?"rgba(99,102,241,0.04)":"transparent",border:isToday?"1px solid rgba(99,102,241,0.14)":"1px solid transparent"}}>
                {dayEvs.map(ev=>{const color=evColor(ev),label=evLabel(ev),start=new Date(ev.start_time),end=new Date(ev.end_time),personal=ev.type==="PERSONAL";return(
                  <div key={ev.event_id} style={{borderRadius:8,borderLeft:`3px solid ${color}`,background:personal?"rgba(255,255,255,0.03)":`${color}15`,padding:"7px 9px",cursor:"default",transition:"filter 0.15s"}}
                    onMouseEnter={e=>(e.currentTarget.style.filter="brightness(1.2)")} onMouseLeave={e=>(e.currentTarget.style.filter="brightness(1)")}>
                    <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:personal?"var(--text-4)":color,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div>
                    <div style={{fontSize:11,color:"var(--text-3)",marginTop:2}}>{fmtTime12(start)}–{fmtTime12(end)}</div>
                  </div>
                );})}
                {dayDues.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return(
                  <div key={a.assessment_id} style={{borderRadius:8,border:`1px solid ${course?.color??"#888"}30`,background:`${course?.color??"#888"}0c`,padding:"7px 9px"}}>
                    <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:course?.color??"#888",marginBottom:1}}>{course?.short_name} · Due</div>
                    <div style={{fontSize:12,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>
                    <div style={{fontSize:11,color:course?.color??"#888",marginTop:2}}>{a.weight_percent}%</div>
                  </div>
                );})}
                {dayEvs.length===0&&dayDues.length===0&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:12,color:"var(--text-4)"}}>—</span></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
