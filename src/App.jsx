import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Pastel Edition) ──────────────────────────────────────
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
  const [undoAction, setUndoAction] = useState(null);

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
    let finalTs = Date.now();
    const docRef = await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
    setUndoAction({ type: 'event', id: docRef.id });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
      `}</style>

      {showUndo && (
        <div style={S.undoToast}>
          <span>עודכן בהצלחה! ✨</span>
          <button onClick={async () => { 
            if(undoAction.type==='event') await deleteDoc(doc(db,"events",undoAction.id));
            setShowUndo(false); 
          }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        {!vitaminDone && (
          <div style={{...S.vitaminBar, background: C.success}} onClick={() => setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() })}>
            <span>☀️ ויטמין D לעלמה</span>
            <input type="checkbox" readOnly checked={false} />
          </div>
        )}
        <MainTimerWidget events={events} now={now} onOpenFutureFeeds={() => setModal("futureFeeds")} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "analytics" && <AnalyticsView events={events} />}
      </div>

      <button onClick={() => setModal("ai")} style={S.aiFab}>🍼</button>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("analytics")} style={S.navBtn(tab === "analytics")}>📊 נתונים</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "futureFeeds" && <FutureFeedsModal events={events} onClose={() => setModal(null)} />}
      {modal === "ai" && <AiModal events={events} onClose={() => setModal(null)} />}
    </div>
  );
}

function MainTimerWidget({ events, now, onOpenFutureFeeds }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  const diffMin = Math.floor((now - lastFeed.ts) / 60000);
  const timeStr = diffMin < 60 ? `${diffMin} דק׳` : `${Math.floor(diffMin/60)}:${(diffMin%60).toString().padStart(2,'0')} ש׳`;
  const nextTarget = new Date(lastFeed.ts + 4 * 60 * 60 * 1000);
  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 14, color: 'rgba(255,255,255,0.9)'}}>אכלה לפני:</div>
      <div className="kids-font" style={{fontSize: 48, fontWeight: 900, color: 'white'}}>🍼 {timeStr}</div>
      <div style={S.nextFeedBox} onClick={onOpenFutureFeeds}>
        <div style={{display:'flex', alignItems: 'center', justifyContent:'space-between'}}>
          <span>⏰ ארוחה הבאה: <b>{fmtTime(nextTarget.getTime())}</b></span>
          <span style={{background: C.peach, color:'white', padding:'4px 8px', borderRadius:8, fontSize:12}}>לו״ז</span>
        </div>
      </div>
    </div>
  );
}

// ── AI Component (Vercel ENV Version) ──────────────────────────────────────
function AiModal({ events, onClose }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [loading, setLoading] = useState(false);

  const askAi = async () => {
    if (!q.trim()) return;
    setLoading(true); setAns("מנתחת נתונים... 🌸");
    try {
      const apiKey = import.meta.env.VITE_GEMINI_KEY;
      const history = events.slice(0, 15).map(e => `${fmtTime(e.ts)}: ${e.type === 'feed' ? `אכלה ${e.ml}ml` : 'חיתול'}`).join(', ');
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `נתונים: ${history}. שאלה: ${q}. ענה בעברית קצרה מאוד.` }] }] })
      });
      const data = await res.json();
      setAns(data.candidates?.[0]?.content?.parts?.[0]?.text || "סליחה, המפתח ב-Vercel לא הוגדר נכון.");
    } catch (err) { setAns("שגיאת תקשורת."); }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>העוזרת של עלמה ✨</h3>
      <input placeholder="כמה עלמה אכלה היום?" value={q} onChange={e=>setQ(e.target.value)} style={S.input} onKeyDown={e=>e.key==='Enter'&&askAi()} />
      <button onClick={askAi} disabled={loading} style={S.primaryBtn}>{loading ? "מחשבת..." : "שאל אותי"}</button>
      {ans && <div style={S.aiResponse}>{ans}</div>}
    </div></div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const totalMl = feeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={{display:'flex', gap:15}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', color:'#854d0e', border:'1px solid #f7e0b5'}}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', color:'#701a75', border:'1px solid #e9d5ff'}}>🧷 חיתול</button>
      </div>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה ({totalMl}ml)</div>
        <div style={{display:'flex', gap:12}}>
          <div style={{flex: 1}}>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <div style={{fontWeight:800}}>{e.ml}ml</div>
                </div>
                {feeds[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, feeds[i+1].ts)}</div></div>}
              </div>
            ))}
          </div>
          <div style={{flex: 1}}>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.blueSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <span>🧷</span>
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
    if (!daysMap[d]) daysMap[d] = { ts: e.ts, ml: 0, count: 0 };
    if (e.type === "feed") { daysMap[d].ml += Number(e.ml || 0); daysMap[d].count += 1; }
  });
  const sortedDays = Object.values(daysMap).sort((a,b) => b.ts - a.ts).slice(0, 7);
  const chartDays = [...sortedDays].reverse(); 
  const maxMl = Math.max(...chartDays.map(d => d.ml), 100);
  const points = chartDays.map((d, i) => ({
    x: 15 + (i / (chartDays.length - 1 || 1)) * 290,
    y: 130 - ((d.ml / maxMl) * 100),
    ml: d.ml
  }));
  const pathData = points.length > 1 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : "";
  const fillPath = points.length > 1 ? `${pathData} L ${points[points.length-1].x} 160 L ${points[0].x} 160 Z` : "";

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={{...S.card, padding: '25px 15px'}}>
        <div className="kids-font" style={S.cardTitle}>מגמת תזונה שבועית</div>
        <div style={{ position: 'relative', width: '100%', height: 160 }}>
          <svg viewBox="0 0 320 160" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.peach} stopOpacity="0.3"/><stop offset="100%" stopColor={C.peach} stopOpacity="0"/></linearGradient></defs>
            {points.length > 1 && <path d={fillPath} fill="url(#g)" />}
            {points.length > 1 && <path d={pathData} fill="none" stroke={C.peachDark} strokeWidth="3" strokeLinecap="round" />}
            {points.map((p, i) => (
              <g key={i}><circle cx={p.x} cy={p.y} r="5" fill="white" stroke={C.peachDark} strokeWidth="3" /><text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="800">{p.ml}</text></g>
            ))}
          </svg>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', marginTop:15, direction:'ltr'}}>
          {points.map(p => <div key={p.ts} style={{textAlign:'center', flex:1, fontSize:11, direction:'rtl'}}><b>{getHebrewDay(p.ts)}</b><br/>{fmtDateShort(p.ts)}</div>)}
        </div>
      </div>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>פירוט יומי</div>
        {sortedDays.map(d => (
          <div key={d.ts} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f8fafc'}}>
            <span><b>{getHebrewDay(d.ts)}</b> ({fmtDateShort(d.ts)})</span>
            <span style={{color:C.peachDark, fontWeight:800}}>🍼 {d.ml}ml</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FutureFeedsModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  const future = Array.from({length: 4}).map((_, i) => new Date(lastFeed.ts + (i + 1) * 4 * 60 * 60 * 1000));
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>תחזית ארוחות ⏰</h3>
      {future.map((t, i) => ( <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px', background:'#fff7ed', borderRadius:12, marginBottom:8}}><span>ארוחה {i+1}:</span><b>{fmtTime(t.getTime())}</b></div> ))}
      <button onClick={onClose} style={S.primaryBtn}>סגור</button>
    </div></div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center'}}>האכלה 🍼</h3>
      <input type="number" placeholder='מ"ל' value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml}); onClose();}} style={S.primaryBtn}>שמור</button>
    </div></div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center'}}>החתלה 🧷</h3>
      <button onClick={()=>{onConfirm({type:'diaper'}); onClose();}} style={S.primaryBtn}>שמור אירוע</button>
    </div></div>
  );
}

const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "40px 20px 25px", borderRadius: "0 0 40px 40px", textAlign: "center", boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.9, marginBottom: 5 },
  babyBadge: { fontSize: 38, color: "white", fontWeight: 800, marginBottom: 15, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "25px", padding: "20px", width: "100%", maxWidth: "340px", display: "inline-block" },
  nextFeedBox: { marginTop: 15, background: "rgba(255,255,255,0.7)", padding: "12px", borderRadius: "15px", fontSize:14 },
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 100px" },
  actionBtn: { flex: 1, padding: "18px", borderRadius: "20px", fontSize: 18, fontWeight: 800, border:'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
  card: { background: "white", borderRadius: "25px", padding: "20px", border: `1px solid #f1f5f9`, marginBottom: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 14, padding: "6px", background: "#fff5f0", borderRadius: "10px", color: C.peachDark, marginBottom: 10 },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", borderRadius: "15px", border: "1px solid #f8fafc" },
  chainContainer: { display: 'flex', alignItems: 'center', marginTop: '-4px', marginBottom: '-4px', marginRight: '15px', height: '30px' },
  chainCurve: { width: '15px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 15px 15px 0', marginLeft: '8px', opacity: 0.6 },
  chainText: { fontSize: 10, fontWeight: 800, color: C.textSoft },
  delBtn: { background:'none', border:'none', color: '#cbd5e1' },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:6, textAlign:'center', fontWeight:800, padding:4, marginTop:4 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", padding: "15px 20px 30px", borderTop: '1px solid #f1f5f9' },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "15px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  aiFab: { position: 'fixed', bottom: 90, left: 20, background: 'transparent', border: 'none', fontSize: 48, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))' },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal: { background: "white", padding: "25px", borderRadius: "30px", width: "90%", maxWidth: 350 },
  input: { width: "100%", padding: "15px", borderRadius: "15px", border: `1px solid #f1f5f9`, marginBottom: 15, textAlign: "center", fontSize: 18, fontWeight: 700 },
  primaryBtn: { width: "100%", padding: "15px", borderRadius: "15px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 18 },
  aiResponse: { marginTop: 15, padding: "15px", background: C.creamSoft, borderRadius: "15px", fontSize: 15, fontWeight: 700, color: C.text, border: `1px solid ${C.border}` },
  undoToast: { position: 'fixed', bottom: 100, left: 20, right: 20, background: '#333', color: 'white', padding: '12px 20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 9999 },
  vitaminBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 15px', borderRadius:'12px', color:'white', fontWeight:800, marginBottom:10 }
};
