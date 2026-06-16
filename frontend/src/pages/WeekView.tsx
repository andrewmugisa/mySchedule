import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { api, Event, Assessment, Course, Section, Week, expandRecurring } from "../api";
import { localDate, fmtTime12, fmtBadge } from "../utils";
import EventModal from "../components/EventModal";

function getMonday(d:Date):Date{const day=d.getDay(),mon=new Date(d);mon.setDate(d.getDate()-(day===0?6:day-1));mon.setHours(0,0,0,0);return mon;}
const DAY_LABELS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── Shared popover (same as DayView) ────────────────────────────────────────
function EventPopover({event,color,label,onClose,onEdit,onCancel,onDelete}:{
  event:Event;color:string;label:string;
  onClose:()=>void;onEdit:()=>void;onCancel:()=>void;onDelete:()=>void;
}){
  const isRecurring=event.event_id<0,cancelled=event.is_cancelled;
  const [pos,setPos]=useState(()=>({x:window.innerWidth/2-145,y:window.innerHeight/2-145}));
  const dragging=useRef(false),dragOff=useRef({x:0,y:0}),ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{function h(e:MouseEvent){if(ref.current&&!ref.current.contains(e.target as Node))onClose();}setTimeout(()=>document.addEventListener("mousedown",h),60);return()=>document.removeEventListener("mousedown",h);},[]);
  const onMouseDown=useCallback((e:React.MouseEvent)=>{if((e.target as HTMLElement).closest("button"))return;dragging.current=true;dragOff.current={x:e.clientX-pos.x,y:e.clientY-pos.y};e.preventDefault();},[pos]);
  useEffect(()=>{function onMove(e:MouseEvent){if(!dragging.current)return;const w=ref.current?.offsetWidth??290,h=ref.current?.offsetHeight??260;setPos({x:Math.max(8,Math.min(window.innerWidth-w-8,e.clientX-dragOff.current.x)),y:Math.max(8,Math.min(window.innerHeight-h-8,e.clientY-dragOff.current.y))});}function onUp(){dragging.current=false;}document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};},[]);
  return(
    <div ref={ref} style={{position:"fixed",left:pos.x,top:pos.y,zIndex:9999,width:290,background:"var(--bg-card2)",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,0.7)",userSelect:"none"}}>
      <div onMouseDown={onMouseDown} style={{padding:"12px 14px 10px",cursor:"grab",background:`${color}10`,borderBottom:`1px solid ${color}20`,display:"flex",gap:8,alignItems:"flex-start"}}>
        <div style={{width:3,alignSelf:"stretch",borderRadius:99,background:color,flexShrink:0}} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color,marginBottom:2}}>{label}</div>
          <div style={{fontSize:14,fontWeight:600,color:cancelled?"var(--text-3)":"var(--text)",textDecoration:cancelled?"line-through":"none",lineHeight:1.3}}>{event.title}</div>
          <div style={{fontSize:11,color:"var(--text-3)",marginTop:3}}>{fmtTime12(new Date(event.start_time))} – {fmtTime12(new Date(event.end_time))}</div>
          {event.location&&<div style={{fontSize:11,color:"var(--text-4)",marginTop:2}}>📍 {event.location}</div>}
          {event.notes&&<div style={{fontSize:11,color:"var(--text-3)",marginTop:2,fontStyle:"italic"}}>{event.notes}</div>}
          {cancelled&&<div style={{fontSize:11,color:"var(--orange)",marginTop:3,fontWeight:500}}>Cancelled</div>}
        </div>
        <button onClick={onClose} className="btn-icon" style={{width:22,height:22,flexShrink:0,marginTop:-2}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{padding:"8px 10px"}}>
        <button onClick={onEdit} style={{width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",background:"none",border:"none",color:"var(--accent-hover)",fontFamily:"inherit",transition:"background 0.15s"}} onMouseEnter={e=>(e.currentTarget.style.background="var(--accent-dim)")} onMouseLeave={e=>(e.currentTarget.style.background="none")}>✏️ Edit event</button>
        {!isRecurring&&<button onClick={onCancel} style={{width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",background:"none",border:"none",color:cancelled?"var(--green)":"var(--orange)",fontFamily:"inherit",transition:"background 0.15s"}} onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseLeave={e=>(e.currentTarget.style.background="none")}>{cancelled?"↩ Restore":"⊘ Cancel event"}</button>}
        {!isRecurring&&<button onClick={onDelete} style={{width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:8,fontSize:12,fontWeight:500,cursor:"pointer",background:"none",border:"none",color:"var(--red)",fontFamily:"inherit",transition:"background 0.15s"}} onMouseEnter={e=>(e.currentTarget.style.background="rgba(244,63,94,0.08)")} onMouseLeave={e=>(e.currentTarget.style.background="none")}>🗑 Delete</button>}
        {isRecurring&&<div style={{fontSize:12,color:"var(--text-3)",padding:"4px 10px 8px"}}>Recurring — click Edit to modify.</div>}
      </div>
      <div style={{textAlign:"center",paddingBottom:6,fontSize:10,color:"var(--text-4)"}}>drag to move</div>
    </div>
  );
}

export default function WeekView(){
  const [monday,setMonday]       =useState(()=>getMonday(new Date()));
  const [events,setEvents]       =useState<Event[]>([]);
  const [assessments,setAs]      =useState<Assessment[]>([]);
  const [courses,setCourses]     =useState<Course[]>([]);
  const [sections,setSections]   =useState<Section[]>([]);
  const [weeks,setWeeks]         =useState<Week[]>([]);
  const [openId,setOpenId]       =useState<number|null>(null);
  const [editEvent,setEditEvent] =useState<Event|null>(null);
  const [showAdd,setShowAdd]     =useState(false);
  const [addDate,setAddDate]     =useState<string|undefined>();
  const [loading,setLoading]     =useState(true);
  const today=new Date();

  async function reload(){
    const [ev,as,co,se,wk]=await Promise.all([api.events.list(),api.assessments.list(),api.courses.list(),api.sections.list(),api.weeks.list()]);
    setEvents(expandRecurring(ev,wk));setAs(as);setCourses(co);setSections(se);setWeeks(wk);
  }
  useEffect(()=>{reload().then(()=>setLoading(false)).catch(console.error);},[]);

  const courseMap  =useMemo(()=>Object.fromEntries(courses.map(c=>[c.course_id,c])),[courses]);
  const sectionMap =useMemo(()=>Object.fromEntries(sections.map(s=>[s.section_id,s])),[sections]);
  // Show full 7-day week Mon–Sun
  const weekDays   =useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;}),[monday]);
  const sunday     =useMemo(()=>weekDays[6],[weekDays]);
  const currentWeek=useMemo(()=>{const d=monday.toISOString().slice(0,10);return weeks.find(w=>w.start_date<=d&&w.end_date>=d);},[weeks,monday]);
  const dueThisWeek=useMemo(()=>{if(!currentWeek)return[];return assessments.filter(a=>a.week_number===currentWeek.week_number&&parseFloat(a.score)===0);},[assessments,currentWeek]);

  const evColor=(ev:Event)=>{if(!ev.section_id)return"#71717a";const sec=sectionMap[ev.section_id];return sec?(courseMap[sec.course_id]?.color??"#71717a"):"#71717a";};
  const evLabel=(ev:Event)=>{if(!ev.section_id)return"Personal";const sec=sectionMap[ev.section_id];const c=sec?courseMap[sec.course_id]:null;return c?`${c.short_name}${ev.location?` · ${ev.location}`:""}`:"";};
  const eventsForDay=(day:Date)=>{const ds=localDate(day.toISOString());return events.filter(e=>localDate(e.start_time)===ds).sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime());};
  const assessmentsForDay=(day:Date)=>assessments.filter(a=>{if(!a.due_date)return false;return localDate(a.due_date)===localDate(day.toISOString());});

  const isCurrentWeek=getMonday(today).toDateString()===monday.toDateString();

  async function cancelEvent(ev:Event){await api.events.update(ev.event_id,{...ev,is_cancelled:!ev.is_cancelled});await reload();setOpenId(null);}
  async function deleteEvent(ev:Event){if(!confirm("Delete permanently?"))return;await api.events.delete(ev.event_id);await reload();setOpenId(null);}

  // Find event for open popover (search across all days)
  const openEvent=useMemo(()=>{if(openId==null)return null;return events.find(e=>e.event_id===openId)??null;},[events,openId]);

  function fmtShort(iso:string){return new Date(iso).toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"});}

  if(loading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text-3)"}}>Loading…</div>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"22px 28px 16px",borderBottom:"1px solid var(--border-dim)",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>
              {currentWeek?`Week ${currentWeek.week_number} of 15`:""}
              {currentWeek?.is_break&&<span style={{marginLeft:8,fontSize:10,padding:"1px 8px",borderRadius:99,background:"var(--bg-hover)",border:"1px solid var(--border)",color:"var(--text-2)"}}>Break</span>}
            </div>
            <h1 style={{fontSize:30,fontWeight:700,color:"var(--text)",letterSpacing:"-0.02em",lineHeight:1}}>Week {currentWeek?.week_number??"—"}</h1>
            <div style={{fontSize:12,color:"var(--text-3)",marginTop:4}}>
              {monday.toLocaleDateString("en-CA",{month:"long",day:"numeric"})} – {sunday.toLocaleDateString("en-CA",{month:"long",day:"numeric",year:"numeric"})}
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
            <button className="btn btn-primary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>{setAddDate(undefined);setShowAdd(true);}}>+ Add event</button>
          </div>
        </div>
      </div>

      {dueThisWeek.length>0&&(
        <div style={{margin:"10px 24px 0",padding:"9px 12px",borderRadius:9,background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.15)",flexShrink:0}}>
          <div style={{fontSize:9,fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Due this week</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {dueThisWeek.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return<span key={a.assessment_id} className="badge" style={{background:(course?.color??"#888")+"18",borderColor:(course?.color??"#888")+"35",color:course?.color??"#888",fontSize:10}}>{a.title} · {a.due_date?fmtShort(a.due_date):`Wk ${a.week_number}`} · {a.weight_percent}%</span>;})}
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",padding:"14px 24px 40px"}}>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8,marginBottom:8}}>
          {weekDays.map((day,i)=>{const isToday=day.toDateString()===today.toDateString();return(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{fontSize:10,fontWeight:600,color:"var(--text-3)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>{DAY_LABELS[i]}</div>
              <div style={{fontSize:16,fontWeight:700,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",background:isToday?"var(--accent)":"transparent",color:isToday?"#fff":"var(--text-2)"}}>{day.getDate()}</div>
            </div>
          );})}
        </div>

        {/* Event cards grid — 7 cols */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
          {weekDays.map((day,i)=>{
            const dayEvs=eventsForDay(day),dayDues=assessmentsForDay(day),isToday=day.toDateString()===today.toDateString();
            return(
              <div key={i} style={{display:"flex",flexDirection:"column",gap:5,minHeight:120,borderRadius:10,padding:5,
                background:isToday?"rgba(99,102,241,0.04)":"transparent",
                border:isToday?"1px solid rgba(99,102,241,0.14)":"1px solid transparent"}}>
                {/* Add for this day */}
                <button onClick={()=>{setAddDate(localDate(day.toISOString()));setShowAdd(true);}}
                  style={{display:"none",width:"100%",padding:"3px 0",borderRadius:6,border:"1px dashed var(--border-dim)",background:"none",cursor:"pointer",fontSize:10,color:"var(--text-4)",fontFamily:"inherit",transition:"all 0.15s"}}
                  className="week-add-btn"
                  onMouseEnter={e=>{e.currentTarget.style.display="block";e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text-3)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border-dim)";e.currentTarget.style.color="var(--text-4)";}}>
                  + add
                </button>

                {dayEvs.map(ev=>{const color=evColor(ev),label=evLabel(ev),start=new Date(ev.start_time),end=new Date(ev.end_time),personal=ev.type==="PERSONAL",cancelled=ev.is_cancelled,isOpen=openId===ev.event_id;return(
                  <div key={ev.event_id}
                    onClick={e=>{e.stopPropagation();setOpenId(p=>p===ev.event_id?null:ev.event_id);}}
                    style={{borderRadius:7,borderLeft:`3px solid ${cancelled?"var(--border-strong)":color}`,background:personal?"rgba(255,255,255,0.03)":`${color}14`,padding:"6px 8px",cursor:"pointer",transition:"filter 0.15s",opacity:cancelled?0.5:1,outline:isOpen?`2px solid ${color}40`:"none"}}
                    onMouseEnter={e=>(e.currentTarget.style.filter="brightness(1.2)")}
                    onMouseLeave={e=>(e.currentTarget.style.filter="brightness(1)")}>
                    <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:personal?"var(--text-4)":cancelled?"var(--text-4)":color,marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</div>
                    <div style={{fontSize:11,fontWeight:600,color:cancelled?"var(--text-4)":"var(--text)",textDecoration:cancelled?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div>
                    <div style={{fontSize:9,color:"var(--text-3)",marginTop:1}}>{fmtTime12(start)}–{fmtTime12(end)}</div>
                  </div>
                );})}

                {dayDues.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return(
                  <div key={a.assessment_id} style={{borderRadius:7,border:`1px solid ${course?.color??"#888"}30`,background:`${course?.color??"#888"}0c`,padding:"5px 8px"}}>
                    <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:course?.color??"#888",marginBottom:1}}>{course?.short_name} · Due</div>
                    <div style={{fontSize:11,fontWeight:600,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>
                    <div style={{fontSize:9,color:course?.color??"#888",marginTop:1}}>{a.weight_percent}%</div>
                  </div>
                );})}

                {dayEvs.length===0&&dayDues.length===0&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:11,color:"var(--text-4)"}}>—</span></div>}
              </div>
            );
          })}
        </div>
      </div>

      {openId!=null&&openEvent&&(
        <EventPopover event={openEvent} color={evColor(openEvent)} label={evLabel(openEvent)}
          onClose={()=>setOpenId(null)}
          onEdit={()=>{setEditEvent(openEvent);setOpenId(null);}}
          onCancel={()=>cancelEvent(openEvent)}
          onDelete={()=>deleteEvent(openEvent)}
        />
      )}
      {editEvent&&<EventModal mode="edit" event={editEvent} onClose={()=>setEditEvent(null)} onSaved={async()=>{setEditEvent(null);await reload();}} />}
      {showAdd&&<EventModal mode="add" defaultDate={addDate} onClose={()=>setShowAdd(false)} onSaved={async()=>{setShowAdd(false);await reload();}} />}
    </div>
  );
}
