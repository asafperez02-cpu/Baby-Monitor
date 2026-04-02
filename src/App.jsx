import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme ────────────────────────────────────────────────────────
const C = {
  bg: "#fffcfb", white: "#ffffff", border: "#f7d7c4", peach: "#f4a58a",
  peachDark: "#e8845e", blueSoft: "#e0f2fe", creamSoft: "#fff7ed",
  text: "#4a2c2a", textSoft: "#8c6d6a", success: "#34d399", warning: "#fbbf24", danger: "#f87171",
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts) { return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
function getHebrewDay(ts) { const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']; return `יום ${days[new Date(ts).getDay()]}`; }
function fmtDateShort(ts) { return new Date(ts).toLocaleDateString("he-IL", { day: '2-digit', month: '2-digit' }); }
function getTimeGap(ts1, ts2) {
  const m = Math.floor(Math.abs(ts1 - ts2) / 60000);
  if (m < 60) return `${m} דק׳`;
  return `${Math.floor(m / 60)}:${(m % 60).toString().padStart(2, '0')} ש׳`;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [vitaminDone, setVitaminDone] = useState(false);
  const [tab, setTab] = useState("home");
  const [userName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsubEvents = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVit = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      setVitaminDone(d.exists() && d.data().lastDate === new Date().toDateString());
    });
    return () => { clearInterval(timer); unsubEvents(); unsubVit(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    let finalTs = Date.now();
    if (ev.manualTime) {
      const [h, m] = ev.manualTime.split(':');
      const d = new Date(); d.setHours(parseInt(h), parseInt(m), 0, 0);
      finalTs = d.getTime();
    }
    await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
      `}</style>

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        
        {!vitaminDone && (
          <div style={{...S.vitaminBar, background: (new Date(now).getHours() < 12 ? C.success : C.warning)}} onClick={() => {
            setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() });
          }}>
            <span>☀️ ויטמין D לעלמה</span>
            <input type="checkbox" readOnly checked={false} style={{transform:'scale(1.2)'}} />
          </div>
        )}

        <MainTimerWidget events={events} now={now} onOpenForecast={() => setModal("forecast")} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "analytics" && <AnalyticsView events={events} />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 יומן</button>
        <button onClick={() => setTab("analytics")} style={S.navBtn(tab === "analytics")}>📊 נתונים</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "forecast" && <ForecastModal events={events} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now, onOpenForecast }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return <div style={S.mainWidget}><div className="kids-font" style={{fontSize: 42, color: 'white'}}>--</div></div>;
  
  const diffMin = Math.floor((now - lastFeed.ts) / 60000);
  const timeStr = diffMin < 60 ? `${diffMin} דק׳` : `${Math.floor(diffMin/60)}:${(diffMin%60).toString().padStart(2,'0')} ש׳`;
  
  const targetMins = 240;
  const progressPercent = Math.min((diffMin / targetMins) * 100, 100);
  let progColor = C.success;
  if (diffMin > 150) progColor = C.warning;
  if (diffMin > 210) progColor = C.danger;

  const nextTarget = new Date(lastFeed.ts + 4 * 60 * 60 * 1000);

  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 2}}>אכלה לפני:</div>
      <div className="kids-font" style={{fontSize: 52, fontWeight: 900, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.1)'}}>🍼 {timeStr}</div>
      
      <div style={S.progressBarContainer}>
        <div style={{...S.progressBarFill, width: `${progressPercent}%`, background: progColor}}></div>
      </div>

      <div style={{display:'flex', justifyContent:'center', marginTop: 15}}>
        <button onClick={onOpenForecast} style={S.forecastBtn}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap: 10, width:'100%'}}>
             <span style={{fontSize: 18}}>⏰</span>
             <span style={{fontSize: 15, fontWeight: 700, color: C.textSoft}}>ארוחה הבאה:</span>
             <span style={{fontSize: 19, fontWeight: 900, color: C.text}}>{fmtTime(nextTarget.getTime())}</span>
             <span style={S.forecastBadge}>תחזית</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  
  const totalMl = feeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  const totalDiapers = diapers.length;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={{display:'flex', gap:15}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', color:'#854d0e', border:'1px solid #f7e0b5'}}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', color:'#701a75', border:'1px solid #e9d5ff'}}>🧷 חיתול</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        <div style={S.summaryText}>סה"כ: <b>{totalMl} מ"ל</b> | <b>{totalDiapers}</b> החלפות</div>
        
        <div style={{display:'flex', gap:12, marginTop: 15}}>
          <div style={{flex:1}}>
            <div style={S.columnHeader}>🍼</div>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={{fontWeight: 800, fontSize: 12, color: C.textSoft}}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input 
                    style={S.mlEditInput} 
                    value={e.ml || ""} 
                    placeholder="ML" 
                    onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} 
                  />
                </div>
                {feeds[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, feeds[i+1].ts)}</div></div>}
              </div>
            ))}
          </div>

          <div style={{flex:1}}>
            <div style={S.columnHeader}>🧷</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.blueSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={{fontWeight: 800, fontSize: 12, color: C.textSoft}}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <div style={{fontSize: 20, marginTop: 4}}>{e.pee?"💧":""}{e.poop?"💩":""}</div>
                </div>
                {diapers[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, diapers[i+1].ts)}</div></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticsView({ events }) {
  const daysMap = {};
  events.forEach(e => {
    const d = new Date(e.ts).toDateString();
    if (!daysMap[d]) daysMap[d] = { ts: e.ts, ml: 0 };
    if (e.type === "feed") daysMap[d].ml += Number(e.ml || 0);
  });
  const sortedDays = Object.values(daysMap).sort((a,b) => b.ts - a.ts).slice(0, 7);
  const chartDays = [...sortedDays].reverse(); 
  const maxMl = Math.max(...chartDays.map(d => d.ml), 100);
  const svgH = 160; const svgW = 320;
  const pts = chartDays.map((d, i) => ({
    x: chartDays.length === 1 ? svgW/2 : 25 + (i/(chartDays.length-1)) * (svgW-50),
    y: svgH - 40 - ((d.ml/maxMl) * (svgH-80)),
    ml: d.ml, ts: d.ts
  }));
  const path = pts.length > 0 ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : "";
  const fill = pts.length > 0 ? `${path} L ${pts[pts.length-1].x} ${svgH} L ${pts[0].x} ${svgH} Z` : "";

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>מגמת תזונה (מניות)</div>
        <div style={{ position: 'relative', width: '100%', height: svgH, marginTop: 10 }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.peach} stopOpacity="0.3"/><stop offset="100%" stopColor={C.peach} stopOpacity="0"/></linearGradient></defs>
            {pts.length > 1 && <path d={fill} fill="url(#gr)" />}
            {pts.length > 1 && <path d={path} fill="none" stroke={C.peachDark} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="6" fill="white" stroke={C.peachDark} strokeWidth="3" />
                <text x={p.x} y={p.y-15} textAnchor="middle" fontSize="12" fontWeight="900" fill={C.text}>{p.ml}</text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, direction: 'ltr' }}>
          {pts.map(p => (
            <div key={p.ts} style={{ textAlign: 'center', flex: 1, direction: 'rtl' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{getHebrewDay(p.ts)}</div>
              <div style={{ fontSize: 10, color: C.textSoft }}>{fmtDateShort(p.ts)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>פירוט יומי</div>
        {sortedDays.map(d => (
          <div key={d.ts} style={S.summaryRow}>
            <span style={{fontWeight:700}}>{getHebrewDay(d.ts)} <small>({fmtDateShort(d.ts)})</small></span>
            <span style={{color:C.peachDark, fontWeight:900, fontSize:17}}>🍼 {d.ml} מ"ל</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  const [timeMode, setTimeMode] = useState("now");
  const [manualTime, setManualTime] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark, marginBottom: 15}}>האכלה 🍼</h3>
      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} style={S.input} />}
      <input type="number" placeholder='כמות מ"ל' value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={S.primaryBtn}>שמור</button>
    </div></div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  const [timeMode, setTimeMode] = useState("now");
  const [manualTime, setManualTime] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark, marginBottom: 15}}>החתלה 🧷</h3>
      <div style={{display:'flex', gap:10, marginBottom:15}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} style={{...S.input, marginBottom:15}} />}
      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
        <button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
      </div>
      <button onClick={()=>{onConfirm({type:'diaper', pee, poop, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={S.primaryBtn}>שמור</button>
    </div></div>
  );
}

function ForecastModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  const future = Array.from({length: 4}).map((_, i) => new Date(lastFeed.ts + (i + 1) * 4 * 60 * 60 * 1000));
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>תחזית ארוחות ⏰</h3>
      {future.map((t, i) => (
        <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'15px 0', borderBottom:'1px dotted #eee'}}>
          <span style={{fontWeight: 700}}>ארוחה {i+1}:</span><span style={{fontWeight:900, fontSize:19, color:C.peachDark}}>{fmtTime(t.getTime())}</span>
        </div>
      ))}
      <button onClick={onClose} style={{...S.primaryBtn, marginTop:20}}>סגור</button>
    </div></div>
  );
}

const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "40px 20px 30px", borderRadius: "0 0 45px 45px", textAlign: "center", boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 13, color: "white", fontWeight: 700, opacity: 0.9, marginBottom: 5 },
  babyBadge: { fontSize: 44, color: "white", fontWeight: 800, marginBottom: 15, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  vitaminBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderRadius:'15px', color:'white', fontWeight:800, marginBottom:15, cursor:'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "35px", padding: "20px", display: "inline-block", width: "100%", maxWidth: "350px", border: '1px solid rgba(255,255,255,0.3)' },
  progressBarContainer: { width: '100%', height: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', marginTop: '15px', overflow: 'hidden' },
  progressBarFill: { height: '100%', transition: 'width 0.8s ease' },
  forecastBtn: { background: "white", border: "none", width: "100%", padding: "16px", borderRadius: "22px", boxShadow: "0 8px 20px rgba(0,0,0,0.08)", cursor: "pointer", display:'flex', alignItems:'center', justifyContent:'center', gap: 10 },
  forecastBadge: { background: C.peach, color: 'white', borderRadius: '10px', padding: '4px 12px', fontSize: 12, fontWeight: 800, marginLeft: 'auto' },
  content: { flex: 1, overflowY: "auto", padding: "25px 15px 120px" },
  actionBtn: { flex: 1, padding: "24px", borderRadius: "26px", fontSize: 20, fontWeight: 800, border:'none', boxShadow: '0 5px 15px rgba(0,0,0,0.05)' },
  card: { background: "white", borderRadius: "32px", padding: "25px", boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border:'1px solid #f1f5f9', marginBottom: 20 },
  cardTitle: { fontSize: 21, fontWeight: 800, marginBottom: 5, textAlign: "center", color: C.peachDark },
  summaryText: { textAlign: 'center', fontSize: 14, color: C.textSoft, marginBottom: 20 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 28, padding: "10px", background: "#f8fafc", borderRadius: "14px", color: C.textSoft, marginBottom: 18 },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "12px", borderRadius: "22px", border: "1px solid #f1f5f9" },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:8, textAlign:'center', fontWeight:900, fontSize:17, padding:8, marginTop:4, color: C.text },
  chainContainer: { display: 'flex', alignItems: 'center', height: '40px', marginRight: '20px' },
  chainCurve: { width: '18px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 18px 18px 0', opacity: 0.5 },
  chainText: { fontSize: 11, fontWeight: 800, color: C.textSoft, marginRight: 10 },
  delBtn: { background:'none', border:'none', color: '#cbd5e1', fontSize: 16 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", padding: "18px 25px 40px", borderTop: '1px solid #f1f5f9', boxShadow: '0 -5px 20px rgba(0,0,0,0.03)' },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "14px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 17 }),
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal: { background: "white", padding: "35px", borderRadius: "40px", width: "92%", maxWidth: 380 },
  chip: (active) => ({ flex: 1, padding: "14px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #f1f5f9", background: active ? C.creamSoft : "#f8fafc", fontWeight: 800, color: active ? C.peachDark : C.textSoft }),
  input: { width: "100%", padding: "18px", borderRadius: "18px", border: `2px solid #f1f5f9`, marginBottom: 20, textAlign: "center", fontSize: 22, fontWeight: 700 },
  primaryBtn: { width: "100%", padding: "20px", borderRadius: "22px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 19 },
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:'1px solid #f9fafb' }
};
