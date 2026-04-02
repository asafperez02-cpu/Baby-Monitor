import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Pastel Edition) ──────────────────────────────────────
const C = {
  bg: "#fffcfb",
  white: "#ffffff",
  border: "#f7d7c4",
  peach: "#f4a58a",
  peachDark: "#e8845e",
  blueSoft: "#e0f2fe",
  creamSoft: "#fff7ed",
  text: "#4a2c2a",
  textSoft: "#8c6d6a",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#f87171",
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function getHebrewDay(ts) {
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'];
  return `יום ${days[new Date(ts).getDay()]}`;
}

function fmtDateShort(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { day: '2-digit', month: '2-digit' });
}

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
  const [userName, setUserName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showUndo, setShowUndo] = useState(false);
  const [undoAction, setUndoAction] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsubEvents = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVit = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      setVitaminDone(d.exists() && d.data().lastDate === new Date().toDateString());
    });
    return () => { unsubEvents(); unsubVit(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    let finalTs = Date.now();
    if (ev.manualTime) {
      const [h, m] = ev.manualTime.split(':');
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m), 0, 0);
      finalTs = d.getTime();
    }
    const docRef = await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
    setUndoAction({ type: 'event', id: docRef.id });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const switchUser = () => {
    const users = ["אבא", "אמא", "סבתא"];
    const next = users[(users.indexOf(userName) + 1) % users.length];
    setUserName(next);
    localStorage.setItem("baby_username", next);
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
        .undo-toast { position: fixed; bottom: 95px; left: 20px; right: 20px; background: #333; color: white; padding: 14px 20px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .slide-up { animation: slideUp 0.3s ease-out forwards; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {showUndo && (
        <div className="undo-toast slide-up">
          <span style={{fontWeight: 700}}>עודכן בהצלחה! ✨</span>
          <button onClick={async () => { 
            if(undoAction.type==='event') await deleteDoc(doc(db,"events",undoAction.id));
            else await setDoc(doc(db, "settings", "vitaminD"), { lastDate: "" });
            setShowUndo(false); 
          }} style={{color: C.peach, border:'none', background:'none', fontWeight:800, fontSize: 16}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting} onClick={switchUser}>שלום {userName} 👋 (החלף)</div>
        <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        {!vitaminDone && (
          <div style={{...S.vitaminBar, background: (new Date(now).getHours() < 12 ? C.success : C.warning)}} onClick={() => {
            setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() });
            setUndoAction({ type: 'vitamin' });
            setShowUndo(true);
            setTimeout(() => setShowUndo(false), 5000);
          }}>
            <span>☀️ ויטמין D לעלמה</span>
            <input type="checkbox" readOnly checked={false} style={{transform: 'scale(1.3)'}} />
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
        <div style={{width: 1, background: '#f1f5f9', margin: '10px 0'}}></div>
        <button onClick={() => setTab("analytics")} style={S.navBtn(tab === "analytics")}>📊 נתונים</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "futureFeeds" && <FutureFeedsModal events={events} onClose={() => setModal(null)} />}
      {modal === "ai" && <AiModal events={events} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now, onOpenFutureFeeds }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 5}}>אכלה פעם אחרונה:</div>
      <div className="kids-font" style={{fontSize: 42, fontWeight: 900, color: 'white'}}>--</div>
    </div>
  );
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
      <div style={{fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 2}}>אכלה פעם אחרונה:</div>
      <div className="kids-font" style={{fontSize: 48, fontWeight: 900, color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.15)', letterSpacing: '1px'}}>🍼 {timeStr}</div>
      <div style={S.progressBarContainer}>
        <div style={{...S.progressBarFill, width: `${progressPercent}%`, background: progColor}}></div>
      </div>
      <div style={S.nextFeedBox} onClick={onOpenFutureFeeds}>
        <div style={{display:'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{display:'flex', alignItems:'center', gap: 8}}>
            <span style={{fontSize: 22}}>⏰</span>
            <span style={{fontSize: 14, fontWeight: 700, color: C.textSoft}}>ארוחה הבאה:</span>
            <span style={{fontSize: 18, fontWeight: 900, color: C.text}}>{fmtTime(nextTarget.getTime())}</span>
          </div>
          <div style={{background: C.peach, color: 'white', borderRadius: '12px', padding: '6px 14px', fontSize: 13, fontWeight: 800}}>תחזית</div>
        </div>
      </div>
    </div>
  );
}

function FutureFeedsModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  const futureFeeds = Array.from({length: 4}).map((_, i) => new Date(lastFeed.ts + (i + 1) * 4 * 60 * 60 * 1000));
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', marginBottom:5, color:C.peachDark}}>תחזית ל-16 שעות 🍼</h3>
        <div style={{display:'flex', flexDirection:'column', gap: 12, marginTop: 20}}>
          {futureFeeds.map((time, index) => (
            <div key={index} style={{...S.itemRow, background: '#fef3c7', padding: '12px 15px', borderRadius: '15px', border: 'none'}}>
              <span style={{fontWeight: 800, color: '#b45309'}}>ארוחה {index + 1}:</span>
              <span style={{fontWeight: 900, fontSize: 18, color: '#92400e'}}>{fmtTime(time.getTime())}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{...S.primaryBtn, marginTop:20}}>סגור</button>
      </div>
    </div>
  );
}

// ── AI Component (The "It Just Works" Fix) ──────────────────────────────────
function AiModal({ events, onClose }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [loading, setLoading] = useState(false);
  const [localKey, setLocalKey] = useState(() => localStorage.getItem("gemini_key") || "");
  const [isEditingKey, setIsEditingKey] = useState(!localStorage.getItem("gemini_key"));

  const saveKey = () => {
    if(localKey.trim().length > 20) {
      localStorage.setItem("gemini_key", localKey.trim());
      setIsEditingKey(false);
      setAns("המפתח נשמר! עכשיו בוא נשאל.");
    } else {
      setAns("המפתח קצר מדי.");
    }
  };

  const askAi = async () => {
    if (!q.trim() || !localKey) return;
    setLoading(true);
    setAns("מנתחת נתונים... 🌸");
    try {
      const contextData = events.slice(0, 20).map(e => {
        const time = new Date(e.ts).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' });
        return e.type === 'feed' ? `[${time}] האכלה ${e.ml}ml` : `[${time}] חיתול`;
      }).join('\n');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${localKey.trim()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `הנתונים האחרונים של עלמה:\n${contextData}\n\nשאלה מההורה: ${q}\nענה בעברית קצרה ונעימה.` }] }]
        })
      });

      const data = await response.json();
      if (data.error) {
        setAns(`שגיאת גוגל: ${data.error.message}`);
      } else {
        setAns(data.candidates?.[0]?.content?.parts?.[0]?.text || "לא הצלחתי לקבל תשובה.");
      }
    } catch (err) {
      setAns("שגיאת תקשורת.");
    }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>העוזרת של עלמה ✨</h3>
        {isEditingKey ? (
          <div>
            <p style={{fontSize:13, textAlign:'center', color:C.textSoft, marginBottom: 10}}>הדבק כאן את מפתח ה-API מ-Google AI Studio:</p>
            <input placeholder="AIza..." value={localKey} onChange={e=>setLocalKey(e.target.value)} style={S.input} />
            <button onClick={saveKey} style={S.primaryBtn}>שמור מפתח בטלפון</button>
            {ans && <p style={{fontSize:12, color:C.danger, textAlign:'center', marginTop:10}}>{ans}</p>}
          </div>
        ) : (
          <>
            <input placeholder="כמה עלמה אכלה היום?" value={q} onChange={e=>setQ(e.target.value)} style={S.input} onKeyDown={e=>e.key==='Enter'&&askAi()} />
            <button onClick={askAi} disabled={loading} style={S.primaryBtn}>{loading?"מנתחת...":"שאל אותי"}</button>
            {ans && <div style={S.aiResponse}>{ans}</div>}
            <button onClick={()=>setIsEditingKey(true)} style={{background:'none', border:'none', color:C.textSoft, fontSize:11, marginTop:20, textDecoration:'underline', width:'100%'}}>עדכון מפתח API</button>
          </>
        )}
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
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', color:'#854d0e', border:'1px solid #f7e0b5', boxShadow: '0 4px 12px rgba(247,224,181,0.5)'}}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', color:'#701a75', border:'1px solid #e9d5ff', boxShadow: '0 4px 12px rgba(233,213,255,0.5)'}}>🧷 חיתול</button>
      </div>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        <div style={{display:'flex', gap:12}}>
          <div style={S.column}>
            <div style={S.columnHeader}>אוכל ({totalMl}ml)</div>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <input style={S.mlEditInput} value={e.ml || ""} placeholder="ML" onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} />
                </div>
                {feeds[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, feeds[i+1].ts)}</div></div>}
              </div>
            ))}
          </div>
          <div style={S.column}>
            <div style={S.columnHeader}>חיתול ({diapers.length})</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.blueSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <div style={{fontWeight:800, fontSize: 16}}>{e.pee?"💧":""}{e.poop?"💩":""}</div>
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
  const chartDays = Object.values(daysMap).sort((a,b) => a.ts - b.ts).slice(-7);
  const maxMl = Math.max(...chartDays.map(d => d.ml), 100);
  const svgHeight = 160;
  const svgWidth = 320;
  const points = chartDays.map((d, i) => ({
    x: 15 + (i / (chartDays.length - 1)) * (svgWidth - 30),
    y: svgHeight - 30 - ((d.ml / maxMl) * (svgHeight - 60)),
    ml: d.ml
  }));
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>מגמת תזונה שבועית</div>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '160px' }}>
          <path d={pathData} fill="none" stroke={C.peachDark} strokeWidth="3" />
          {points.map((p, i) => (
            <g key={i}><circle cx={p.x} cy={p.y} r="5" fill="white" stroke={C.peachDark} strokeWidth="3" /><text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="800">{p.ml}</text></g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', marginBottom: 20}}>האכלה 🍼</h3>
      <input type="number" placeholder="כמות במ״ל" value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml}); onClose();}} style={S.primaryBtn}>שמור אירוע</button>
    </div></div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', marginBottom: 20}}>החתלה 🧷</h3>
      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
        <button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
      </div>
      <button onClick={()=>{onConfirm({type:'diaper', pee, poop}); onClose();}} style={S.primaryBtn}>שמור אירוע</button>
    </div></div>
  );
}

const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "calc(15px + env(safe-area-inset-top)) 20px 25px", borderRadius: "0 0 45px 45px", textAlign: "center", boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.9, marginBottom: 5 },
  babyBadge: { fontSize: 38, color: "white", fontWeight: 800, marginBottom: 15, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "25px", padding: "20px", width: "100%", maxWidth: "340px", display: "inline-block" },
  progressBarContainer: { width: '100%', height: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', marginTop: '15px', overflow: 'hidden' },
  progressBarFill: { height: '100%', transition: 'width 0.8s' },
  nextFeedBox: { marginTop: 15, background: "rgba(255,255,255,0.8)", padding: "12px", borderRadius: "18px" },
  content: { flex: 1, overflowY: "auto", padding: "25px 20px" },
  actionBtn: { flex: 1, padding: "22px 10px", borderRadius: "24px", fontSize: 20, fontWeight: 800, border:'none' },
  card: { background: "white", borderRadius: "30px", padding: "25px", boxShadow: '0 10px 30px rgba(0,0,0,0.03)', border:'1px solid #f1f5f9' },
  cardTitle: { fontSize: 20, fontWeight: 800, marginBottom: 20, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column" },
  columnHeader: { textAlign: "center", fontSize: 14, fontWeight: 800, color: C.textSoft, marginBottom: 12, background: '#f8fafc', padding: '8px', borderRadius: '12px' },
  eventMiniCard: { padding: '12px', borderRadius: '18px', marginBottom: 12, border: '1px solid #f1f5f9' },
  chainContainer: { display: 'flex', alignItems: 'center', marginTop: '-6px', marginBottom: '-6px', marginRight: '20px', height: '40px' },
  chainCurve: { width: '18px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 20px 20px 0', marginLeft: '10px' },
  chainText: { fontSize: 11, fontWeight: 800, color: C.textSoft },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:8, textAlign:'center', fontWeight:800, marginTop:8, padding:5 },
  delBtn: { border: 'none', background: 'none', color: '#cbd5e1' },
  nav: { display: "flex", background: "white", borderTop: `1px solid #f1f5f9`, padding: "18px 25px 30px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "14px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  aiFab: { position: "fixed", bottom: 90, left: 20, background: "transparent", border: "none", fontSize: 48, zIndex: 99 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modal: { background: "white", padding: "35px", borderRadius: "40px", width: "90%", maxWidth: "380px" },
  input: { width: "100%", padding: "16px", borderRadius: "20px", border: `2px solid #f1f5f9`, marginBottom: 20, textAlign: "center", fontSize: 18, fontWeight: 700 },
  primaryBtn: { width: "100%", padding: "18px", borderRadius: "22px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 18 },
  aiResponse: { marginTop: 20, padding: "18px", background: C.creamSoft, borderRadius: "22px", fontSize: 16, color: C.text, lineHeight: "1.6", border: `1px solid ${C.border}`, fontWeight: 700 },
  chip: (active) => ({ flex: 1, padding: "12px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #f1f5f9", background: active ? C.creamSoft : "#f8fafc", fontWeight: 800, color: active ? C.peachDark : C.textSoft }),
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '15px 0' }
};
    
