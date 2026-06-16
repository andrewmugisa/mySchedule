import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { api, Event, Assessment, Course, Section, Week, WeeklyKnowledge, expandRecurring } from "../api";
import { localDate, fmtTime12, fmtBadge } from "../utils";
import EventModal from "../components/EventModal";

function toMins(d: Date) { return d.getHours()*60+d.getMinutes(); }
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const START_HOUR=6,END_HOUR=24,SLOT_MINS=30,SLOT_PX=40;
const TOTAL_SLOTS=((END_HOUR-START_HOUR)*60)/SLOT_MINS;

// ── Draggable popover ────────────────────────────────────────────────────────
function EventPopover({ event,color,label,onClose,onEdit,onCancel,onDelete }:{
  event:Event;color:string;label:string;
  onClose:()=>void;onEdit:()=>void;onCancel:()=>void;onDelete:()=>void;
}) {
  const isRecurring=event.event_id<0, cancelled=event.is_cancelled;
  const [pos,setPos]=useState(()=>({x:window.innerWidth/2-145,y:window.innerHeight/2-145}));
  const dragging=useRef(false),dragOff=useRef({x:0,y:0}),ref=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    function h(e:MouseEvent){if(ref.current&&!ref.current.contains(e.target as Node))onClose();}
    setTimeout(()=>document.addEventListener("mousedown",h),60);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const onMouseDown=useCallback((e:React.MouseEvent)=>{
    if((e.target as HTMLElement).closest("button"))return;
    dragging.current=true; dragOff.current={x:e.clientX-pos.x,y:e.clientY-pos.y}; e.preventDefault();
  },[pos]);

  useEffect(()=>{
    function onMove(e:MouseEvent){if(!dragging.current)return;const w=ref.current?.offsetWidth??290,h=ref.current?.offsetHeight??260;setPos({x:Math.max(8,Math.min(window.innerWidth-w-8,e.clientX-dragOff.current.x)),y:Math.max(8,Math.min(window.innerHeight-h-8,e.clientY-dragOff.current.y))});}
    function onUp(){dragging.current=false;}
    document.addEventListener("mousemove",onMove);document.addEventListener("mouseup",onUp);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
  },[]);

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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function DayView() {
  const [now,setNow]             =useState(new Date());
  const [selected,setSelected]   =useState(new Date());
  const [events,setEvents]       =useState<Event[]>([]);
  const [assessments,setAs]      =useState<Assessment[]>([]);
  const [courses,setCourses]     =useState<Course[]>([]);
  const [sections,setSections]   =useState<Section[]>([]);
  const [weeks,setWeeks]         =useState<Week[]>([]);
  const [knowledge,setKn]        =useState<WeeklyKnowledge[]>([]);
  const [openId,setOpenId]       =useState<number|null>(null);
  const [editEvent,setEditEvent] =useState<Event|null>(null);
  const [showAdd,setShowAdd]     =useState(false);
  const [loading,setLoading]     =useState(true);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(t);},[]);

  async function reload(){
    const [ev,as,co,se,wk,kn]=await Promise.all([api.events.list(),api.assessments.list(),api.courses.list(),api.sections.list(),api.weeks.list(),api.knowledge.list()]);
    setEvents(expandRecurring(ev,wk));setAs(as);setCourses(co);setSections(se);setWeeks(wk);setKn(kn);
  }
  useEffect(()=>{reload().then(()=>setLoading(false)).catch(console.error);},[]);

  const courseMap  =useMemo(()=>Object.fromEntries(courses.map(c=>[c.course_id,c])),[courses]);
  const sectionMap =useMemo(()=>Object.fromEntries(sections.map(s=>[s.section_id,s])),[sections]);
  const currentWeek=useMemo(()=>{const d=selected.toISOString().slice(0,10);return weeks.find(w=>w.start_date<=d&&w.end_date>=d);},[weeks,selected]);
  const weekStrip  =useMemo(()=>{const day=selected.getDay(),mon=new Date(selected);mon.setDate(selected.getDate()-(day===0?6:day-1));return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});},[selected]);
  const dayEvents  =useMemo(()=>{const sel=localDate(selected.toISOString());return events.filter(e=>localDate(e.start_time)===sel).sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime());},[events,selected]);
  const dueThisWeek=useMemo(()=>{if(!currentWeek)return[];return assessments.filter(a=>a.week_number===currentWeek.week_number&&parseFloat(a.score)===0);},[assessments,currentWeek]);
  const upcoming   =useMemo(()=>assessments.filter(a=>parseFloat(a.score)===0).sort((a,b)=>(a.week_number??99)-(b.week_number??99)).slice(0,4),[assessments]);
  const weekKn     =useMemo(()=>{if(!currentWeek)return[];return knowledge.filter(k=>k.week_number===currentWeek.week_number);},[knowledge,currentWeek]);
  const gradeSummary=useMemo(()=>courses.map(course=>{const secIds=sections.filter(s=>s.course_id===course.course_id).map(s=>s.section_id),cas=assessments.filter(a=>secIds.includes(a.section_id)),earned=cas.reduce((s,a)=>s+parseFloat(a.score),0),total=cas.reduce((s,a)=>s+parseFloat(a.weight_percent),0);return{course,pct:total>0?Math.round((earned/total)*100):0};}),[courses,sections,assessments]);

  function layout(evs:Event[]){const placed:{ev:Event;col:number;cols:number}[]=[];for(const ev of evs){const s=new Date(ev.start_time).getTime(),e=new Date(ev.end_time).getTime();const over=placed.filter(p=>{const ps=new Date(p.ev.start_time).getTime(),pe=new Date(p.ev.end_time).getTime();return s<pe&&e>ps;});const used=new Set(over.map(p=>p.col));let col=0;while(used.has(col))col++;const cols=Math.max(col+1,...over.map(p=>p.col+1));over.forEach(p=>{p.cols=Math.max(p.cols,cols);});placed.push({ev,col,cols});}return placed;}
  const laid=useMemo(()=>layout(dayEvents),[dayEvents]);

  const evColor=(ev:Event)=>{if(!ev.section_id)return"#71717a";const sec=sectionMap[ev.section_id];return sec?(courseMap[sec.course_id]?.color??"#71717a"):"#71717a";};
  const evLabel=(ev:Event)=>{if(!ev.section_id)return"Personal";const sec=sectionMap[ev.section_id];const c=sec?courseMap[sec.course_id]:null;return c?`${c.short_name}${ev.location?` · ${ev.location}`:""}`:"";};

  const isToday=localDate(selected.toISOString())===localDate(now.toISOString());
  const nowMins=toMins(now)-START_HOUR*60,nowTopPx=(nowMins/SLOT_MINS)*SLOT_PX,totalH=TOTAL_SLOTS*SLOT_PX;

  async function cancelEvent(ev:Event){await api.events.update(ev.event_id,{...ev,is_cancelled:!ev.is_cancelled});await reload();setOpenId(null);}
  async function deleteEvent(ev:Event){if(!confirm("Delete permanently?"))return;await api.events.delete(ev.event_id);await reload();setOpenId(null);}

  const spineSlots=useMemo(()=>Array.from({length:TOTAL_SLOTS+1},(_,i)=>{const m=START_HOUR*60+i*SLOT_MINS,h=Math.floor(m/60),min=m%60,isHour=min===0;const label=isHour?`${h===12?12:h>12?h-12:h}${h>=12?"PM":"AM"}`:"";return{label,isHour,topPx:i*SLOT_PX};}),[]);
  function fmtShort(iso:string){return new Date(iso).toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"});}
  const openEvent=useMemo(()=>openId!=null?laid.find(({ev})=>ev.event_id===openId):null,[laid,openId]);

  if(loading)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text-3)"}}>Loading…</div>;

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <div style={{padding:"22px 28px 14px",borderBottom:"1px solid var(--border-dim)",flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{DAYS[selected.getDay()]}</div>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <h1 style={{fontSize:34,fontWeight:700,color:"var(--text)",lineHeight:1,letterSpacing:"-0.02em"}}>
              {MONTHS[selected.getMonth()]} {selected.getDate()}
              <span style={{fontSize:18,fontWeight:300,color:"var(--text-3)",marginLeft:10}}>{selected.getFullYear()}</span>
            </h1>
            <button className="btn btn-primary" style={{padding:"6px 14px",fontSize:12,marginBottom:2}} onClick={()=>setShowAdd(true)}>+ Add event</button>
          </div>
          {/* Week strip */}
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:14}}>
            <button className="btn-icon" style={{width:26,height:26,flexShrink:0}} onClick={()=>{const d=new Date(selected);d.setDate(d.getDate()-7);setSelected(d);}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{display:"flex",flex:1,justifyContent:"space-between",gap:1}}>
              {weekStrip.map((d,i)=>{
                const isSel=d.toDateString()===selected.toDateString(),isNow=d.toDateString()===now.toDateString(),hasEv=events.some(e=>localDate(e.start_time)===localDate(d.toISOString()));
                return(
                  <button key={i} onClick={()=>setSelected(new Date(d))}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 5px",borderRadius:9,cursor:"pointer",border:"none",background:isSel?"var(--accent)":"transparent",transition:"background 0.15s",minWidth:34,fontFamily:"inherit"}}
                    onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="var(--bg-hover)";}}
                    onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:9,fontWeight:600,marginBottom:2,color:isSel?"rgba(255,255,255,0.65)":"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.04em"}}>{DAYS[d.getDay()]}</span>
                    <span style={{fontSize:14,fontWeight:700,lineHeight:1,color:isSel?"#fff":isNow?"var(--accent)":"var(--text-2)"}}>{d.getDate()}</span>
                    <span style={{width:3,height:3,borderRadius:"50%",marginTop:2,background:hasEv&&!isSel?"var(--border-strong)":"transparent"}} />
                  </button>
                );
              })}
            </div>
            <button className="btn-icon" style={{width:26,height:26,flexShrink:0}} onClick={()=>{const d=new Date(selected);d.setDate(d.getDate()+7);setSelected(d);}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button className="btn btn-ghost" style={{padding:"4px 10px",fontSize:11,flexShrink:0}} onClick={()=>setSelected(new Date())}>Today</button>
          </div>
        </div>

        {dueThisWeek.length>0&&(
          <div style={{margin:"10px 18px 0",padding:"9px 12px",borderRadius:9,background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.15)",flexShrink:0}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Due this week</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {dueThisWeek.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return<span key={a.assessment_id} className="badge" style={{background:(course?.color??"#888")+"18",borderColor:(course?.color??"#888")+"35",color:course?.color??"#888",fontSize:10}}>{a.title} · {a.due_date?fmtShort(a.due_date):`Wk ${a.week_number}`} · {a.weight_percent}%</span>;})}
            </div>
          </div>
        )}

        <div style={{flex:1,overflowY:"auto",padding:"10px 18px 80px"}}>
          <div style={{position:"relative",height:totalH}}>
            <div style={{position:"absolute",left:64,top:6,bottom:6,width:1,background:"var(--border-dim)"}} />
            {spineSlots.map(({label,isHour,topPx},i)=>(
              <div key={i} style={{position:"absolute",top:topPx,left:0,right:0,display:"flex",alignItems:"center",height:1}}>
                <div style={{width:50,textAlign:"right",paddingRight:7,flexShrink:0}}>{isHour&&<span style={{fontSize:9,fontWeight:600,color:"var(--text-4)"}}>{label}</span>}</div>
                <div style={{width:isHour?7:4,height:isHour?7:4,borderRadius:"50%",border:`1.5px solid ${isHour?"var(--border)":"var(--border-dim)"}`,background:"var(--bg)",flexShrink:0,zIndex:2,marginLeft:isHour?0:1.5}} />
              </div>
            ))}
            {isToday&&nowMins>=0&&nowTopPx<totalH&&(
              <div style={{position:"absolute",top:nowTopPx,left:0,right:0,display:"flex",alignItems:"center",zIndex:10}}>
                <div style={{width:50,textAlign:"right",paddingRight:7,flexShrink:0}}><span style={{fontSize:9,fontWeight:700,color:"var(--red)"}}>Now</span></div>
                <div style={{width:9,height:9,borderRadius:"50%",background:"var(--red)",flexShrink:0,boxShadow:"0 0 7px rgba(244,63,94,0.6)",marginLeft:-0.5}} />
                <div style={{flex:1,height:1,background:"rgba(244,63,94,0.3)"}} />
              </div>
            )}
            <div style={{position:"absolute",left:78,right:4,top:0,bottom:0}}>
              {laid.map(({ev,col,cols})=>{
                const start=new Date(ev.start_time),end=new Date(ev.end_time);
                const sm=toMins(start)-START_HOUR*60,em=toMins(end)-START_HOUR*60;
                const topPx=(sm/SLOT_MINS)*SLOT_PX,heightPx=Math.max((em-sm)/SLOT_MINS*SLOT_PX,22);
                const gap=3,colW=`calc(${100/cols}% - ${gap}px)`,leftPct=`calc(${(col/cols)*100}% + ${col>0?gap/2:0}px)`;
                const color=evColor(ev),label=evLabel(ev),personal=ev.type==="PERSONAL",cancelled=ev.is_cancelled,isOpen=openId===ev.event_id;
                return(
                  <div key={ev.event_id} style={{position:"absolute",top:topPx,height:heightPx,width:colW,left:leftPct,zIndex:isOpen?30:1}}>
                    <div onClick={e=>{e.stopPropagation();setOpenId(p=>p===ev.event_id?null:ev.event_id);}}
                      style={{width:"100%",height:"100%",borderRadius:7,borderLeft:`3px solid ${cancelled?"var(--border-strong)":color}`,background:personal?"rgba(255,255,255,0.03)":`${color}14`,opacity:cancelled?0.4:1,cursor:"pointer",padding:"4px 7px",position:"relative",overflow:"hidden",transition:"filter 0.15s,transform 0.1s"}}
                      onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.2)";e.currentTarget.style.transform="translateX(1px)";}}
                      onMouseLeave={e=>{e.currentTarget.style.filter="brightness(1)";e.currentTarget.style.transform="translateX(0)";}}>
                      <div style={{position:"absolute",top:4,right:5,fontSize:8,fontWeight:600,color:personal?"var(--text-4)":`${color}bb`,background:personal?"var(--bg-hover)":`${color}18`,border:`1px solid ${personal?"var(--border-dim)":`${color}28`}`,borderRadius:4,padding:"1px 4px",whiteSpace:"nowrap"}}>{fmtBadge(start)}–{fmtBadge(end)}</div>
                      <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:personal?"var(--text-4)":cancelled?"var(--text-4)":color,marginBottom:1,paddingRight:68,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</div>
                      <div style={{fontSize:11,fontWeight:600,color:cancelled?"var(--text-4)":"var(--text)",textDecoration:cancelled?"line-through":"none",paddingRight:68,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="hide-mobile" style={{width:252,flexShrink:0,overflowY:"auto",borderLeft:"1px solid var(--border-dim)",background:"#0a0a0d",padding:"22px 16px",display:"flex",flexDirection:"column",gap:22}}>
        <section>
          <div className="section-label" style={{marginBottom:10}}>Grade summary</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {gradeSummary.map(({course,pct})=>(
              <div key={course.course_id} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:course.color,flexShrink:0}} />
                <span style={{fontSize:11,color:"var(--text-2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{course.short_name}</span>
                <div style={{width:60,height:3,background:"var(--border)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:course.color,borderRadius:99}} /></div>
                <span style={{fontSize:10,color:"var(--text-3)",width:26,textAlign:"right"}}>{pct}%</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="section-label" style={{marginBottom:10}}>Upcoming</div>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {upcoming.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return(
              <div key={a.assessment_id} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <div style={{width:3,minHeight:30,borderRadius:99,background:course?.color??"var(--border)",flexShrink:0,marginTop:1}} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>
                  <div style={{fontSize:10,color:"var(--text-3)",marginTop:1}}>{course?.short_name} · {a.due_date?new Date(a.due_date).toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"}):`Wk ${a.week_number}`}</div>
                </div>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4,background:(course?.color??"#888")+"20",border:`1px solid ${(course?.color??"#888")}30`,color:course?.color??"#888",flexShrink:0}}>{a.weight_percent}%</span>
              </div>
            );})}
            {upcoming.length===0&&<p style={{fontSize:12,color:"var(--text-4)"}}>Nothing pending.</p>}
          </div>
        </section>
        {weekKn.length>0&&(
          <section>
            <div className="section-label" style={{marginBottom:10}}>Wk {currentWeek?.week_number} — know this</div>
            <div style={{background:"var(--bg-card)",border:"1px solid var(--border-dim)",borderRadius:10,padding:12}}>
              {weekKn.map(wk=>{const course=courseMap[wk.course_id];return(
                <div key={wk.knowledge_id} style={{marginBottom:8}}>
                  <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:course?.color,marginBottom:3}}>{course?.short_name}</div>
                  {wk.topics.map((t,i)=><div key={i} style={{marginBottom:4}}><div style={{fontSize:12,fontWeight:500,color:"var(--text-2)"}}>{t.topic}</div><div style={{fontSize:10,color:"var(--text-3)",marginTop:1}}>{t.subtopics.join(" · ")}</div></div>)}
                </div>
              );})}
            </div>
          </section>
        )}
      </div>

      {openId!=null&&openEvent&&(
        <EventPopover event={openEvent.ev} color={evColor(openEvent.ev)} label={evLabel(openEvent.ev)}
          onClose={()=>setOpenId(null)}
          onEdit={()=>{setEditEvent(openEvent.ev);setOpenId(null);}}
          onCancel={()=>cancelEvent(openEvent.ev)}
          onDelete={()=>deleteEvent(openEvent.ev)}
        />
      )}
      {editEvent&&<EventModal mode="edit" event={editEvent} onClose={()=>setEditEvent(null)} onSaved={async()=>{setEditEvent(null);await reload();}} />}
      {showAdd&&<EventModal mode="add" defaultDate={localDate(selected.toISOString())} onClose={()=>setShowAdd(false)} onSaved={async()=>{setShowAdd(false);await reload();}} />}
    </div>
  );
}
