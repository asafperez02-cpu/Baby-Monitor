import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Premium Pastel Edition) ─────────────────────────────
const C = {
  bg: "#fffcfb", white: "#ffffff", border: "#f7d7c4", peach: "#f4a58a",
  peachDark: "#e8845e", blueSoft: "#e0f2fe", creamSoft: "#fff7ed",
  pastelYellow: "#fffdf0", pastelPurple: "#f9f5ff",
  text: "#4a2c2a", textSoft: "#8c6d6a", success: "#34d399", warning: "#fbbf24", danger: "#f87171",
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Icons ──────────────────────────────────────────────────────────────────
const DiaperIcon = ({ size = 26, color = "#701a75" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7C4 6.44772 4.44772 6 5 6H19C19.5523 6 20 6.44772 20 7V9C20 13.9706 16.4183 18 12 18C7.58172 18 4 13.9706 4 9V7Z" fill="#fdf4ff" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 9C6 9 7.5 10.5 7.5 12.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 9C18 9 16.5 10.5 16.5 12.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 9V10C9 10.5523 9.44772 11 10 11H14C14.5523 11 15 10.5523 15 10V9" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
function isToday(ts) { return new Date(ts).toDateString() === new Date().toDateString(); }
function formatEventTime(ts) {
  const timeStr = new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return isToday(ts) ? timeStr : `${timeStr} (אתמול)`;
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
function getHebrewDay(ts) { const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']; return `יום ${days[new Date(ts).getDay()]}`; }
function fmtDateShort(ts) { return new Date(ts).toLocaleDateString("he-IL", { day: '2-digit', month: '2-digit' }); }
function getTimeGap(ts1, ts2) {
  const diff = Math.abs(ts1 - ts2);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}:${rm.toString().padStart(2, '0')} ש׳` : `${h} ש׳`;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [vitaminDone, setVitaminDone] = useState(false);
  const [tab, setTab] = useState("home");
  const [userName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showUndo, setShowUndo] = useState(false);
  const [undoId, setUndoId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsub = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVit = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      setVitaminDone(d.exists() && d.data().lastDate === new Date().toDateString());
    });
    return () => { clearInterval(timer); unsub(); unsubVit(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    let finalTs = Date.now();
    if (ev.manualTime) {
      const [h, m] = ev.manualTime.split(':');
      const d = new Date(); d.setHours(parseInt(h), parseInt(m), 0, 0);
      finalTs = d.getTime();
    }
    const docRef = await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
    setUndoId(docRef.id); setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&family=Varela Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
      `}</style>

      {showUndo && (
        <div style={S.undoToast}>
          <span>עודכן בהצלחה! ✨</span>
          <button onClick={async () => { await deleteDoc(doc(db,"events",undoId)); setShowUndo(false); }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל</button>
        </div>
      )}

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

      <button onClick={() => setModal("ai")} style={S.aiFab}>🍼</button>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ALMA</button>
        <button onClick={() => setTab("analytics")} style={S.navBtn(tab === "analytics")}>📊 נתונים</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "forecast" && <ForecastModal events={events} onClose={() => setModal(null)} />}
      {modal === "ai" && <AiModal events={events} onClose={() => setModal(null)} />}
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

      <div style={{display:'flex', justifyContent:'center', marginTop: 20}}>
        <button onClick={onOpenForecast} style={S.forecastBtn}>
          <div style={{fontSize: 15, fontWeight: 800, color: C.peachDark, marginBottom: 5}}>4 ארוחות הבאות</div>
          <div style={{fontSize: 24, fontWeight: 900, color: C.text, display: 'flex', alignItems: 'center', gap: 8}}>
            <span>⏰</span> {fmtTime(nextTarget.getTime())}
          </div>
          <div style={{fontSize: 12, color: C.textSoft, marginTop: 6}}>* מחושב לפי מרווח של 4 שעות</div>
        </button>
      </div>
    </div>
  );
}

// ── AI Component ───────────────────────────────────────────────────────────
function AiModal({ events, onClose }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [loading, setLoading] = useState(false);

  const askAi = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setAns("מנתחת נתונים... 🌸");

    try {
      const history = events
        .slice(0, 15)
        .map(e => `${fmtTime(e.ts)}: ${e.type === "feed" ? `אכלה ${e.ml}ml` : "חיתול"}`)
        .join(", ");

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setAns(data.answer || "לא התקבלה תשובה.");
    } catch (err) {
      setAns("סליחה, תקלה בניתוח הנתונים.");
    }

    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>העוזרת של עלמה ✨</h3>
      <input placeholder="כמה עלמה אכלה היום?" value={q} onChange={e=>setQ(e.target.value)} style={S.input} onKeyDown={e=>e.key==='Enter'&&askAi()} />
      <button onClick={askAi} disabled={loading} style={S.primaryBtn}>{loading ? "מחשבת..." : "שאל אותי"}</button>
      {ans && <div style={S.aiResponse}>{ans}</div>}
      <button onClick={onClose} style={{...S.primaryBtn, background: C.textSoft, marginTop: 10}}>סגור</button>
    </div></div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const todayFeeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  const todayDiapers = events.filter(e => e.type === "diaper" && isToday(e.ts));
  
  const totalMl = todayFeeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  const feedCount = todayFeeds.length;
  const totalDiapers = todayDiapers.length;
  const totalPee = todayDiapers.filter(e => e.pee).length;
  const totalPoop = todayDiapers.filter(e => e.poop).length;

  const displayFeeds = events.filter(e => e.type === "feed").sort((a,b)=>b.ts-a.ts).slice(0, 15);
  const displayDiapers = events.filter(e => e.type === "diaper").sort((a,b)=>b.ts-a.ts).slice(0, 15);

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={{display:'flex', gap:15}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', color:'#854d0e', border:'1px solid #f7e0b5'}}>
          <span style={{fontSize: 34}}>🍼</span> האכלה
        </button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', color:'#701a75', border:'1px solid #e9d5ff'}}>
          <DiaperIcon size={34} /> החתלה
        </button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        
        <div style={S.summaryDashboard}>
          <div style={S.summaryColLeft}>
            <div style={S.summaryLabel}>סה"כ אוכל</div>
            <div style={S.summaryMainValue}>{totalMl} מ"ל</div>
            <div style={S.summarySubValue}>({feedCount} ארוחות)</div>
          </div>
          <div style={S.summaryColRight}>
            <div style={S.summaryLabel}>סה"כ החלפות</div>
            <div style={S.summaryMainValue}>{totalDiapers}</div>
            <div style={S.summarySubValue}>💧 {totalPee} | 💩 {totalPoop}</div>
          </div>
        </div>
        
        <div style={{display:'flex', gap:10, marginTop: 20}}>
          <div style={S.column(C.pastelYellow)}>
            <div style={S.columnHeader}><span style={{fontSize: 24}}>🍼</span></div>
            {displayFeeds.map((e, i) => (
              <div key={e.id}>
                <div style={S.eventMiniCard(C.white)}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center', marginBottom: 4}}>
                    <span style={{fontWeight: 800, fontSize: 12, color: C.textSoft}}>{formatEventTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input 
                    style={S.mlEditInput} 
                    value={e.ml || ""} 
                    placeholder="מ״ל" 
                    onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} 
                  />
                </div>
                {displayFeeds[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, displayFeeds[i+1].ts)}</div></div>}
              </div>
            ))}
          </div>

          <div style={S.column(C.pastelPurple)}>
            <div style={S.columnHeader}><DiaperIcon size={28} /></div>
            {displayDiapers.map((e, i) => (
              <div key={e.id}>
                <div style={S.eventMiniCard(C.white)}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center', marginBottom: 4}}>
                    <span style={{fontWeight: 800, fontSize: 12, color: C.textSoft}}>{formatEventTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <div style={{fontSize: 18, marginTop: 4}}>
                    {e.pee?"💧":""}{e.poop?"💩":""}
                    {(!e.pee && !e.poop) && <DiaperIcon size={18} color="#cbd5e1"/>}
                  </div>
                </div>
                {displayDiapers[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, displayDiapers[i+1].ts)}</div></div>}
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
    if (!daysMap[d]) daysMap[d] = { ts: e.ts, ml: 0, count: 0 };
    if (e.type === "feed") {
      daysMap[d].ml += Number(e.ml || 0);
      daysMap[d].count += 1;
    }
  });

  const sortedDays = Object.values(daysMap).sort((a,b) => b.ts - a.ts).slice(0, 7);
  const chartDays = [...sortedDays].reverse(); 
  
  const maxMl = Math.max(...chartDays.map(d => d.ml), 100);
  const svgHeight = 160; const svgWidth = 320;
  const points = chartDays.map((d, i) => {
    const x = chartDays.length === 1 ? svgWidth / 2 : 25 + (i / (chartDays.length - 1)) * (svgWidth - 50);
    const y = svgHeight - 40 - ((d.ml / maxMl) * (svgHeight - 80));
    return { ...d, x, y };
  });

  const pathData = points.length > 1 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : "";
  const fillPath = points.length > 1 ? `${pathData} L ${points[points.length-1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z` : "";

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>מגמת תזונה</div>
        <div style={{ position: 'relative', width: '100%', height: svgHeight, marginTop: 10 }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.peach} stopOpacity="0.3"/><stop offset="100%" stopColor={C.peach} stopOpacity="0"/></linearGradient></defs>
            {points.length > 1 && <path d={fillPath} fill="url(#gr)" />}
            {points.length > 1 && <path d={pathData} fill="none" stroke={C.peachDark} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="6" fill="white" stroke={C.peachDark} strokeWidth="3" />
                <text x={p.x} y={p.y - 15} textAnchor="middle" fontSize="12" fontWeight="900" fill={C.text}>{p.ml}</text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, direction: 'ltr' }}>
          {points.map(p => (
            <div key={p.ts} style={{ textAlign: 'center', flex: 1, direction: 'rtl' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{getHebrewDay(p.ts)}</div>
              <div style={{ fontSize: 10, color: C.textSoft }}>{fmtDateShort(p.ts)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>פירוט יומי</div>
        {sortedDays.map(d => {
          const avg = d.count > 0 ? Math.round(d.ml / d.count) : 0;
          return (
            <div key={d.ts} style={S.summaryRow}>
              <div>
                <div style={{fontWeight: 800, fontSize: 16}}>{getHebrewDay(d.ts)}</div>
                <div style={{fontSize: 12, color: C.textSoft, fontWeight: 600}}>{fmtDateShort(d.ts)}</div>
              </div>
              <div style={{textAlign: 'left'}}>
                <div style={{color:C.peachDark, fontWeight:900, fontSize:18}}>🍼 {d.ml} מ"ל</div>
                <div style={{fontSize: 13, color: C.textSoft, fontWeight: 700, marginTop: 2}}>{d.count} ארוחות | ממוצע: {avg} מ"ל</div>
              </div>
            </div>
          );
        })}
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
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark, marginBottom: 15}}>החתלה <DiaperIcon size={22} color={C.peachDark}/></h3>
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
      <div style={{textAlign:'center', fontSize:13, color:C.textSoft, marginBottom: 15}}>מחושב לפי מרווח של 4 שעות</div>
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
  forecastBtn: { background: "white", border: "none", width: "100%", padding: "20px 15px", borderRadius: "22px", boxShadow: "0 8px 20px rgba(0,0,0,0.08)", cursor: "pointer", display:'flex', flexDirection: 'column', alignItems:'center', justifyContent:'center' },
  content: { flex: 1, overflowY: "auto", padding: "25px 15px 120px" },
  actionBtn: { flex: 1, padding: "20px 10px", borderRadius: "26px", fontSize: 20, fontWeight: 800, border:'none', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  card: { background: "#fffaf7", borderRadius: "32px", padding: "20px", boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border:'1px solid #f1f5f9', marginBottom: 20 },
  cardTitle: { fontSize: 21, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  
  summaryDashboard: { display: 'flex', background: C.creamSoft, borderRadius: '20px', padding: '15px', marginBottom: '20px', border: `1px solid ${C.border}` },
  summaryColLeft: { flex: 1, textAlign: 'center', borderLeft: `1px solid ${C.border}` },
  summaryColRight: { flex: 1, textAlign: 'center' },
  summaryLabel: { fontSize: 13, color: C.textSoft, fontWeight: 800, marginBottom: 4 },
  summaryMainValue: { fontSize: 20, fontWeight: 900, color: C.text },
  summarySubValue: { fontSize: 13, fontWeight: 800, color: C.peachDark, marginTop: 2 },

  column: (bgColor) => ({ flex: 1, display: "flex", flexDirection: "column", background: bgColor, padding: "8px", borderRadius: "24px", border: "1px solid #f1f5f9" }),
  columnHeader: { textAlign: "center", marginBottom: 15, paddingTop: 5 },
  eventMiniCard: (bgColor) => ({ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 12px", borderRadius: "18px", background: bgColor, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }),
  mlEditInput: { width: '65px', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:8, textAlign:'center', fontWeight:900, fontSize:15, padding:6, color: C.text },
  chainContainer: { display: 'flex', alignItems: 'center', height: '25px', marginRight: '20px' },
  chainCurve: { width: '15px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 15px 15px 0', opacity: 0.5 },
  chainText: { fontSize: 11, fontWeight: 800, color: C.textSoft, marginRight: 8 },
  delBtn: { background:'none', border:'none', color: '#cbd5e1', fontSize: 14, cursor: 'pointer' },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", padding: "18px 25px 40px", borderTop: '1px solid #f1f5f9', boxShadow: '0 -5px 20px rgba(0,0,0,0.03)' },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "16px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 17 }),
  
  aiFab: { position: "fixed", bottom: 110, left: 20, background: "transparent", border: "none", fontSize: 48, zIndex: 999, cursor: "pointer", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" },
  aiResponse: { marginTop: 15, padding: "15px", background: C.creamSoft, borderRadius: "15px", fontSize: 15, fontWeight: 700, color: C.text, border: `1px solid ${C.border}` },
  
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal: { background: "white", padding: "35px", borderRadius: "40px", width: "92%", maxWidth: 380 },
  chip: (active) => ({ flex: 1, padding: "14px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #f1f5f9", background: active ? C.creamSoft : "#f8fafc", fontWeight: 800, color: active ? C.peachDark : C.textSoft }),
  input: { width: "100%", padding: "18px", borderRadius: "18px", border: `2px solid #f1f5f9`, marginBottom: 20, textAlign: "center", fontSize: 22, fontWeight: 700 },
  primaryBtn: { width: "100%", padding: "20px", borderRadius: "22px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 19 },
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:'1px solid #f9fafb' },
  undoToast: { position: 'fixed', bottom: 120, left: 20, right: 20, background: '#333', color: 'white', padding: '15px 25px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 9999 }
};
