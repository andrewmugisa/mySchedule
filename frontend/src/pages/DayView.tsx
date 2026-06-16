import { useEffect, useState, useMemo, useRef } from "react";
import { api, Event, Assessment, Course, Section, Week, WeeklyKnowledge, expandRecurring } from "../api";
import { localDate, fmtTime12, fmtBadge } from "../utils";

function toMins(d: Date) { return d.getHours()*60 + d.getMinutes(); }

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const START_HOUR=6, END_HOUR=24, SLOT_MINS=30, SLOT_PX=62;
const TOTAL_SLOTS=((END_HOUR-START_HOUR)*60)/SLOT_MINS;

function EventPopover({ event, color, label, anchorRect, onClose, onCancel, onDelete }: {
  event:Event; color:string; label:string; anchorRect:DOMRect;
  onClose:()=>void; onCancel:()=>void; onDelete:()=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isRecurring = event.event_id < 0;
  const popW = 240;
  const leftRight = anchorRect.right + 12;
  const leftLeft  = anchorRect.left - popW - 12;
  const left = leftRight + popW < window.innerWidth - 16 ? leftRight : leftLeft;
  let top = anchorRect.top;
  if (top + 230 > window.innerHeight - 16) top = window.innerHeight - 246;

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    setTimeout(() => document.addEventListener("mousedown", h), 60);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const cancelled = event.is_cancelled;
  return (
    <div ref={ref} className="popover" style={{ left, top, width:popW }}>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <div style={{ width:3, borderRadius:99, background:color, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color, marginBottom:2 }}>{label}</div>
          <div style={{ fontSize:13, fontWeight:600, color:cancelled?"var(--text-3)":"var(--text)", textDecoration:cancelled?"line-through":"none" }}>{event.title}</div>
          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>{fmtTime12(new Date(event.start_time))} – {fmtTime12(new Date(event.end_time))}</div>
          {event.location && <div style={{ fontSize:11, color:"var(--text-4)", marginTop:2 }}>📍 {event.location}</div>}
          {cancelled && <div style={{ fontSize:11, color:"var(--orange)", marginTop:3, fontWeight:500 }}>Cancelled</div>}
        </div>
        <button onClick={onClose} className="btn-icon" style={{ width:22, height:22, flexShrink:0 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      {isRecurring ? (
        <div style={{ fontSize:12, color:"var(--text-3)", padding:"6px 0" }}>Recurring event — edit from <strong style={{ color:"var(--text-2)" }}>Settings</strong>.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
          <button onClick={onCancel} style={{ width:"100%", textAlign:"left", padding:"7px 8px", borderRadius:7, fontSize:12, fontWeight:500, cursor:"pointer", background:"none", border:"none", color:cancelled?"var(--green)":"var(--orange)", fontFamily:"inherit" }}
            onMouseEnter={e=>(e.currentTarget.style.background="var(--bg-hover)")} onMouseLeave={e=>(e.currentTarget.style.background="none")}>
            {cancelled?"↩ Restore":"⊘ Cancel this event"}
          </button>
          <button onClick={onDelete} style={{ width:"100%", textAlign:"left", padding:"7px 8px", borderRadius:7, fontSize:12, fontWeight:500, cursor:"pointer", background:"none", border:"none", color:"var(--red)", fontFamily:"inherit" }}
            onMouseEnter={e=>(e.currentTarget.style.background="rgba(244,63,94,0.08)")} onMouseLeave={e=>(e.currentTarget.style.background="none")}>
            🗑 Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}

export default function DayView() {
  const [now,now_s]           = useState(new Date());
  const [selected,setSelected]= useState(new Date());
  const [events,setEvents]    = useState<Event[]>([]);
  const [assessments,setAs]   = useState<Assessment[]>([]);
  const [courses,setCourses]  = useState<Course[]>([]);
  const [sections,setSections]= useState<Section[]>([]);
  const [weeks,setWeeks]      = useState<Week[]>([]);
  const [knowledge,setKn]     = useState<WeeklyKnowledge[]>([]);
  const [popover,setPopover]  = useState<{id:number;rect:DOMRect}|null>(null);
  const [loading,setLoading]  = useState(true);

  useEffect(() => { const t=setInterval(()=>now_s(new Date()),30000); return ()=>clearInterval(t); },[]);
  useEffect(() => {
    Promise.all([api.events.list(),api.assessments.list(),api.courses.list(),api.sections.list(),api.weeks.list(),api.knowledge.list()])
      .then(([ev,as,co,se,wk,kn]) => { setEvents(expandRecurring(ev,wk));setAs(as);setCourses(co);setSections(se);setWeeks(wk);setKn(kn);setLoading(false); })
      .catch(console.error);
  },[]);

  const courseMap  = useMemo(()=>Object.fromEntries(courses.map(c=>[c.course_id,c])),[courses]);
  const sectionMap = useMemo(()=>Object.fromEntries(sections.map(s=>[s.section_id,s])),[sections]);
  const currentWeek= useMemo(()=>{ const d=selected.toISOString().slice(0,10); return weeks.find(w=>w.start_date<=d&&w.end_date>=d); },[weeks,selected]);
  const weekStrip  = useMemo(()=>{ const day=selected.getDay(),mon=new Date(selected); mon.setDate(selected.getDate()-(day===0?6:day-1)); return Array.from({length:7},(_,i)=>{ const d=new Date(mon);d.setDate(mon.getDate()+i);return d; }); },[selected]);
  const dayEvents  = useMemo(()=>{ const sel=localDate(selected.toISOString()); return events.filter(e=>localDate(e.start_time)===sel).sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime()); },[events,selected]);
  const dueThisWeek= useMemo(()=>{ if(!currentWeek)return[]; return assessments.filter(a=>a.week_number===currentWeek.week_number&&parseFloat(a.score)===0); },[assessments,currentWeek]);
  const upcoming   = useMemo(()=>assessments.filter(a=>parseFloat(a.score)===0).sort((a,b)=>(a.week_number??99)-(b.week_number??99)).slice(0,4),[assessments]);
  const weekKn     = useMemo(()=>{ if(!currentWeek)return[]; return knowledge.filter(k=>k.week_number===currentWeek.week_number); },[knowledge,currentWeek]);
  const gradeSummary=useMemo(()=>courses.map(course=>{ const secIds=sections.filter(s=>s.course_id===course.course_id).map(s=>s.section_id),cas=assessments.filter(a=>secIds.includes(a.section_id)),earned=cas.reduce((s,a)=>s+parseFloat(a.score),0),total=cas.reduce((s,a)=>s+parseFloat(a.weight_percent),0); return {course,pct:total>0?Math.round((earned/total)*100):0}; }),[courses,sections,assessments]);

  function layout(evs:Event[]) {
    const placed:{ev:Event;col:number;cols:number}[]=[];
    for(const ev of evs){const s=new Date(ev.start_time).getTime(),e=new Date(ev.end_time).getTime();const over=placed.filter(p=>{const ps=new Date(p.ev.start_time).getTime(),pe=new Date(p.ev.end_time).getTime();return s<pe&&e>ps;});const used=new Set(over.map(p=>p.col));let col=0;while(used.has(col))col++;const cols=Math.max(col+1,...over.map(p=>p.col+1));over.forEach(p=>{p.cols=Math.max(p.cols,cols);});placed.push({ev,col,cols});}
    return placed;
  }
  const laid=useMemo(()=>layout(dayEvents),[dayEvents]);

  function evColor(ev:Event){ if(!ev.section_id)return"#71717a";const sec=sectionMap[ev.section_id];return sec?(courseMap[sec.course_id]?.color??"#71717a"):"#71717a"; }
  function evLabel(ev:Event){ if(!ev.section_id)return"Personal";const sec=sectionMap[ev.section_id];const c=sec?courseMap[sec.course_id]:null;return c?`${c.short_name}${ev.location?` · ${ev.location}`:""}`:"";}

  const isToday=localDate(selected.toISOString())===localDate(now.toISOString());
  const nowMins=toMins(now)-START_HOUR*60,nowTopPx=(nowMins/SLOT_MINS)*SLOT_PX,totalH=TOTAL_SLOTS*SLOT_PX;

  async function cancelEvent(ev:Event){await api.events.update(ev.event_id,{...ev,is_cancelled:!ev.is_cancelled});setEvents(prev=>prev.map(e=>e.event_id===ev.event_id?{...e,is_cancelled:!e.is_cancelled}:e));setPopover(null);}
  async function deleteEvent(ev:Event){if(!confirm("Delete this event permanently?"))return;await api.events.delete(ev.event_id);setEvents(prev=>prev.filter(e=>e.event_id!==ev.event_id));setPopover(null);}

  const spineSlots=useMemo(()=>Array.from({length:TOTAL_SLOTS+1},(_,i)=>{const totalMins=START_HOUR*60+i*SLOT_MINS,h=Math.floor(totalMins/60),m=totalMins%60,isHour=m===0,label=isHour?`${h===12?12:h>12?h-12:h}:00 ${h>=12?"PM":"AM"}`:"";return{label,isHour,topPx:i*SLOT_PX};}),[]);

  function fmtShort(iso:string){return new Date(iso).toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"});}

  if(loading)return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text-3)"}}>Loading…</div>;

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* LEFT */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <div style={{padding:"24px 28px 16px",borderBottom:"1px solid var(--border-dim)",flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{DAYS[selected.getDay()]}</div>
          <h1 style={{fontSize:36,fontWeight:700,color:"var(--text)",lineHeight:1,letterSpacing:"-0.02em"}}>
            {MONTHS[selected.getMonth()]} {selected.getDate()}
            <span style={{fontSize:20,fontWeight:300,color:"var(--text-3)",marginLeft:10}}>{selected.getFullYear()}</span>
          </h1>
          {/* Week strip */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:16}}>
            <button className="btn-icon" style={{width:28,height:28,flexShrink:0}} onClick={()=>{const d=new Date(selected);d.setDate(d.getDate()-7);setSelected(d);}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{display:"flex",flex:1,justifyContent:"space-between",gap:2}}>
              {weekStrip.map((d,i)=>{
                const isSel=d.toDateString()===selected.toDateString();
                const isNow=d.toDateString()===now.toDateString();
                const hasEv=events.some(e=>localDate(e.start_time)===localDate(d.toISOString()));
                return(
                  <button key={i} onClick={()=>setSelected(new Date(d))}
                    style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 6px",borderRadius:10,cursor:"pointer",border:"none",background:isSel?"var(--accent)":"transparent",transition:"all 0.15s",minWidth:36,fontFamily:"inherit"}}
                    onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="var(--bg-hover)";}}
                    onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:10,fontWeight:500,marginBottom:3,color:isSel?"rgba(255,255,255,0.7)":"var(--text-3)"}}>{DAYS[d.getDay()]}</span>
                    <span style={{fontSize:15,fontWeight:700,lineHeight:1,color:isSel?"#fff":isNow?"var(--accent)":"var(--text-2)"}}>{d.getDate()}</span>
                    <span style={{width:4,height:4,borderRadius:"50%",marginTop:3,background:hasEv&&!isSel?"var(--border-strong)":"transparent"}} />
                  </button>
                );
              })}
            </div>
            <button className="btn-icon" style={{width:28,height:28,flexShrink:0}} onClick={()=>{const d=new Date(selected);d.setDate(d.getDate()+7);setSelected(d);}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <button className="btn btn-ghost" style={{padding:"5px 12px",fontSize:12,flexShrink:0}} onClick={()=>setSelected(new Date())}>Today</button>
          </div>
        </div>

        {dueThisWeek.length>0&&(
          <div style={{margin:"12px 20px 0",padding:"10px 14px",borderRadius:10,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",flexShrink:0}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--orange)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Due this week</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {dueThisWeek.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return<span key={a.assessment_id} className="badge" style={{background:(course?.color??"#888")+"18",borderColor:(course?.color??"#888")+"35",color:course?.color??"#888"}}>{a.title} · {a.due_date?fmtShort(a.due_date):`Wk ${a.week_number}`} · {a.weight_percent}%</span>;})}
            </div>
          </div>
        )}

        <div style={{flex:1,overflowY:"auto",padding:"12px 20px 80px"}}>
          <div style={{position:"relative",height:totalH}}>
            <div style={{position:"absolute",left:72,top:8,bottom:8,width:1,background:"var(--border-dim)"}} />
            {spineSlots.map(({label,isHour,topPx},i)=>(
              <div key={i} style={{position:"absolute",top:topPx,left:0,right:0,display:"flex",alignItems:"center",height:1}}>
                <div style={{width:58,textAlign:"right",paddingRight:8,flexShrink:0}}>{isHour&&<span style={{fontSize:10,fontWeight:500,color:"var(--text-4)"}}>{label}</span>}</div>
                <div style={{width:isHour?8:5,height:isHour?8:5,borderRadius:"50%",border:`1.5px solid ${isHour?"var(--border)":"var(--border-dim)"}`,background:"var(--bg)",flexShrink:0,zIndex:2,marginLeft:isHour?0:1.5}} />
              </div>
            ))}
            {isToday&&nowMins>=0&&nowTopPx<totalH&&(
              <div style={{position:"absolute",top:nowTopPx,left:0,right:0,display:"flex",alignItems:"center",zIndex:10}}>
                <div style={{width:58,textAlign:"right",paddingRight:8,flexShrink:0}}><span style={{fontSize:10,fontWeight:700,color:"var(--red)"}}>Now</span></div>
                <div style={{width:10,height:10,borderRadius:"50%",background:"var(--red)",flexShrink:0,boxShadow:"0 0 8px rgba(244,63,94,0.5)",marginLeft:-1}} />
                <div style={{flex:1,height:1,background:"rgba(244,63,94,0.35)"}} />
              </div>
            )}
            <div style={{position:"absolute",left:86,right:0,top:0,bottom:0}}>
              {laid.map(({ev,col,cols})=>{
                const start=new Date(ev.start_time),end=new Date(ev.end_time);
                const startMins=toMins(start)-START_HOUR*60,endMins=toMins(end)-START_HOUR*60;
                const topPx=(startMins/SLOT_MINS)*SLOT_PX,heightPx=Math.max((endMins-startMins)/SLOT_MINS*SLOT_PX,32);
                const gap=4,colW=`calc(${100/cols}% - ${gap}px)`,leftPct=`calc(${(col/cols)*100}% + ${col>0?gap/2:0}px)`;
                const color=evColor(ev),label=evLabel(ev),personal=ev.type==="PERSONAL",cancelled=ev.is_cancelled,isOpen=popover?.id===ev.event_id;
                return(
                  <div key={ev.event_id} style={{position:"absolute",top:topPx,height:heightPx,width:colW,left:leftPct,zIndex:isOpen?30:1}}>
                    <div onClick={e=>{e.stopPropagation();const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();setPopover(p=>p?.id===ev.event_id?null:{id:ev.event_id,rect});}}
                      style={{width:"100%",height:"100%",borderRadius:9,borderLeft:`3px solid ${cancelled?"var(--border-strong)":color}`,background:personal?"rgba(255,255,255,0.03)":`${color}14`,opacity:cancelled?0.4:1,cursor:"pointer",padding:"5px 8px",position:"relative",overflow:"hidden",transition:"filter 0.15s,transform 0.1s"}}
                      onMouseEnter={e=>{e.currentTarget.style.filter="brightness(1.2)";e.currentTarget.style.transform="translateX(1px)";}}
                      onMouseLeave={e=>{e.currentTarget.style.filter="brightness(1)";e.currentTarget.style.transform="translateX(0)";}}>
                      <div style={{position:"absolute",top:5,right:7,fontSize:9,fontWeight:600,color:personal?"var(--text-4)":`${color}cc`,background:personal?"var(--bg-hover)":`${color}18`,border:`1px solid ${personal?"var(--border-dim)":`${color}30`}`,borderRadius:5,padding:"1px 5px",whiteSpace:"nowrap"}}>{fmtBadge(start)}–{fmtBadge(end)}</div>
                      <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:personal?"var(--text-4)":cancelled?"var(--text-4)":color,marginBottom:1,paddingRight:70,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</div>
                      <div style={{fontSize:12,fontWeight:600,color:cancelled?"var(--text-4)":"var(--text)",textDecoration:cancelled?"line-through":"none",paddingRight:70,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                    </div>
                    {isOpen&&popover&&<EventPopover event={ev} color={color} label={label} anchorRect={popover.rect} onClose={()=>setPopover(null)} onCancel={()=>cancelEvent(ev)} onDelete={()=>deleteEvent(ev)} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="hide-mobile" style={{width:252,flexShrink:0,overflowY:"auto",borderLeft:"1px solid var(--border-dim)",background:"#0a0a0d",padding:"24px 16px",display:"flex",flexDirection:"column",gap:22}}>
        <section>
          <div className="section-label" style={{marginBottom:10}}>Grade summary</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {gradeSummary.map(({course,pct})=>(
              <div key={course.course_id} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:course.color,flexShrink:0}} />
                <span style={{fontSize:12,color:"var(--text-2)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{course.short_name}</span>
                <div style={{width:60,height:3,background:"var(--border)",borderRadius:99,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:course.color,borderRadius:99}} /></div>
                <span style={{fontSize:11,color:"var(--text-3)",width:26,textAlign:"right"}}>{pct}%</span>
              </div>
            ))}
            {gradeSummary.length===0&&<p style={{fontSize:12,color:"var(--text-4)"}}>No courses yet.</p>}
          </div>
        </section>
        <section>
          <div className="section-label" style={{marginBottom:10}}>Upcoming</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {upcoming.map(a=>{const sec=sectionMap[a.section_id],course=sec?courseMap[sec.course_id]:null;return(
              <div key={a.assessment_id} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <div style={{width:3,minHeight:32,borderRadius:99,background:course?.color??"var(--border)",flexShrink:0,marginTop:1}} />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</div>
                  <div style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{course?.short_name} · {a.due_date?new Date(a.due_date).toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"}):`Wk ${a.week_number}`}</div>
                </div>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:5,background:(course?.color??"#888")+"20",border:`1px solid ${(course?.color??"#888")}30`,color:course?.color??"#888",flexShrink:0}}>{a.weight_percent}%</span>
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
                  <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:course?.color,marginBottom:4}}>{course?.short_name}</div>
                  {wk.topics.map((t,i)=><div key={i} style={{marginBottom:4}}><div style={{fontSize:12,fontWeight:500,color:"var(--text-2)"}}>{t.topic}</div><div style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{t.subtopics.join(" · ")}</div></div>)}
                </div>
              );})}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
