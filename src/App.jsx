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
          <div style={{background: C.peach, color: 'white', borderRadius: '12px', padding: '6px 14px', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 10px rgba(244, 165, 138, 0.4)'}}>
            תחזית
          </div>
        </div>
      </div>
    </div>
  );
}

function FutureFeedsModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;

  const futureFeeds = Array.from({length: 4}).map((_, i) => {
    return new Date(lastFeed.ts + (i + 1) * 4 * 60 * 60 * 1000);
  });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', marginBottom:5, color:C.peachDark}}>תחזית ל-16 שעות 🍼</h3>
        <p style={{textAlign:'center', fontSize: 13, color: C.textSoft, marginBottom: 20}}>הזמנים מחושבים לפי מרווחים של 4 שעות מההאכלה האחרונה.</p>
        
        <div style={{display:'flex', flexDirection:'column', gap: 12}}>
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

// ── AI Component ────────────────────────────────────────────────────────────
function AiModal({ events, onClose }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [loading, setLoading] = useState(false);

  const askAi = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setAns("חושב... 🧠");

    try {
      // משיכת המפתח מתוך קובץ ההגדרות
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        setAns("שגיאה: חסר מפתח API. ודא שהגדרת VITE_GEMINI_API_KEY ב-Vercel והאתר נבנה מחדש.");
        setLoading(false);
        return;
      }

      // הכנת "גיליון הנתונים" עבור ה-AI - ניקח את 20 האירועים האחרונים
      const contextData = events.slice(0, 20).map(e => {
        const time = new Date(e.ts).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        if (e.type === 'feed') return `[${time}] האכלה: ${e.ml} מ"ל`;
        if (e.type === 'diaper') return `[${time}] חיתול: ${e.pee ? 'פיפי' : ''} ${e.poop ? 'קקי' : ''}`;
        return '';
      }).join('\n');

      const prompt = `אתה עוזר וירטואלי חכם ועוזר אישי להורים של התינוקת עלמה. 
הנה הנתונים האחרונים שלה:
${contextData}

שאלה מההורה: ${q}
ענה בעברית, בצורה קצרה (עד 2 משפטים), מדויקת ונעימה. אל תמציא נתונים. אם אי אפשר לענות מהנתונים, תגיד שאין מספיק מידע.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await res.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        setAns(data.candidates[0].content.parts[0].text);
      } else {
        setAns("אופס, לא הצלחתי להבין את הנתונים.");
      }
    } catch (err) {
      setAns("שגיאה בתקשורת עם שרת ה-AI.");
    }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', marginBottom:5, color:'#a855f7'}}>העוזרת של עלמה ✨</h3>
        <p style={{textAlign:'center', fontSize: 13, color: C.textSoft, marginBottom: 20}}>ה-AI מנתח את הפעולות האחרונות</p>
        
        <input 
          placeholder="למשל: כמה עלמה אכלה היום?" 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          style={{...S.input, marginBottom:15}} 
          onKeyDown={(e) => e.key === 'Enter' && askAi()}
        />
        
        <button onClick={askAi} disabled={loading} style={{...S.primaryBtn, background: loading ? '#d8b4fe' : '#a855f7', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'}}>
          {loading ? "מנתח..." : "שאל"}
        </button>
        
        {ans && (
          <div style={{marginTop: 20, padding: 15, background: '#f3e8ff', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#6b21a8', lineHeight: '1.5', border: '1px solid #e9d5ff'}}>
            {ans}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);

  const totalMl = feeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  const totalPee = diapers.filter(e => e.pee).length;
  const totalPoop = diapers.filter(e => e.poop).length;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={{display:'flex', gap:15}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', border: '1px solid #f7e0b5', color:'#854d0e', boxShadow: '0 4px 12px rgba(247,224,181,0.5)'}}>
          <span style={{fontSize: 34}}>🍼</span>
          <span>האכלה</span>
        </button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', border: '1px solid #e9d5ff', color:'#701a75', boxShadow: '0 4px 12px rgba(233,213,255,0.5)'}}>
          <span style={{fontSize: 34}}>🧷</span>
          <span>החתלה</span>
        </button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        <div style={{display:'flex', gap:12}}>
          
          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🍼 אוכל</div>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input style={S.mlEditInput} value={e.ml || ""} placeholder="ML" onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} />
                </div>
                {feeds[i+1] && (
                  <div style={S.chainContainer}>
                    <div style={S.chainCurve}></div>
                    <div style={S.chainText}>{getTimeGap(e.ts, feeds[i+1].ts)}</div>
                  </div>
                )}
              </div>
            ))}
            {feeds.length > 0 && (
              <div style={S.summaryBarSmall}>
                <div style={{fontWeight: 800, fontSize: 16, color: C.peachDark}}>{totalMl} מ"ל</div>
                <div style={{color: C.textSoft}}>סה"כ {feeds.length} ארוחות</div>
              </div>
            )}
          </div>

          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.blueSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.pee?"💧":""}{e.poop?"💩":""}</span>
                </div>
                {diapers[i+1] && (
                  <div style={S.chainContainer}>
                    <div style={S.chainCurve}></div>
                    <div style={S.chainText}>{getTimeGap(e.ts, diapers[i+1].ts)}</div>
                  </div>
                )}
              </div>
            ))}
            {diapers.length > 0 && (
              <div style={S.summaryBarSmall}>
                <div style={{fontWeight: 800, fontSize: 15, color: '#0369a1'}}>💧{totalPee} | 💩{totalPoop}</div>
                <div style={{color: C.textSoft}}>סה"כ {diapers.length} חיתולים</div>
              </div>
            )}
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
  const svgHeight = 160;
  const svgWidth = 320;
  
  const points = chartDays.map((d, i) => {
    const x = chartDays.length === 1 ? svgWidth / 2 : 15 + (i / (chartDays.length - 1)) * (svgWidth - 30);
    const y = svgHeight - 30 - ((d.ml / maxMl) * (svgHeight - 60));
    return { ...d, x, y };
  });

  const pathData = points.length > 0 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : "";
  const fillPathData = points.length > 0 ? `${pathData} L ${points[points.length-1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z` : "";

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      
      <div style={{...S.card, padding: '25px 15px'}}>
        <div className="kids-font" style={{...S.cardTitle, marginBottom: 5}}>מגמת תזונה שבועית</div>
        <div style={{textAlign: 'center', fontSize: 13, color: C.textSoft, marginBottom: 25}}>סה"כ מ"ל מול ימי השבוע</div>
        
        <div style={{ position: 'relative', width: '100%', height: svgHeight }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.peachDark} stopOpacity="0.3" />
                <stop offset="100%" stopColor={C.peachDark} stopOpacity="0" />
              </linearGradient>
            </defs>
            {points.length > 1 && <path d={fillPathData} fill="url(#lineGrad)" />}
            {points.length > 1 && <path d={pathData} fill="none" stroke={C.peachDark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill={C.white} stroke={C.peachDark} strokeWidth="3" />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="13" fontWeight="800" fill={C.text}>{p.ml}</text>
              </g>
            ))}
          </svg>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15, direction: 'ltr' }}>
          {points.map(p => (
            <div key={p.ts} style={{ textAlign: 'center', flex: 1, direction: 'rtl' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{getHebrewDay(p.ts)}</div>
              <div style={{ fontSize: 11, color: C.textSoft }}>{fmtDateShort(p.ts)}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.peachDark, marginTop: 6, background: C.creamSoft, borderRadius: 6, padding: '3px 0' }}>{p.count} ארוח׳</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>פירוט נתונים יומי</div>
        {sortedDays.map(d => (
          <div key={d.ts} style={S.summaryRow}>
            <div style={{fontWeight:800, width:100}}>
              {getHebrewDay(d.ts)} <span style={{fontSize: 12, color: C.textSoft, fontWeight: 400}}>({fmtDateShort(d.ts)})</span>
            </div>
            <div style={{flex:1, color:C.peachDark, fontWeight:800, fontSize: 16}}>🍼 {d.ml} מ"ל</div>
            <div style={{fontSize:13, color:C.textSoft, fontWeight: 700}}>{d.count} ארוחות</div>
          </div>
        ))}
      </div>

    </div>
  );
}

// ... FeedModal & DiaperModal unchanged
function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  const [timeMode, setTimeMode] = useState("now");
  const [manualTime, setManualTime] = useState("");

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', marginBottom:15, color:C.peachDark}}>האכלה 🍼</h3>
      <div style={{display:'flex', gap:10, marginBottom:15}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" onChange={e=>setManualTime(e.target.value)} style={{...S.input, marginBottom:10}} />}
      <input type="number" placeholder='כמות (מ"ל)' value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={{...S.primaryBtn, marginTop:10}}>שמור נתונים</button>
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
      <h3 className="kids-font" style={{textAlign:'center', marginBottom:15, color:C.peachDark}}>החתלה 🧷</h3>
      <div style={{display:'flex', gap:10, marginBottom:15}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" onChange={e=>setManualTime(e.target.value)} style={{...S.input, marginBottom:15}} />}

      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
        <button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
      </div>
      <button onClick={()=>{onConfirm({type:'diaper', pee, poop, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={S.primaryBtn}>שמור נתונים</button>
    </div></div>
  );
}

// ── Styles (Pro Edit) ──────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "calc(15px + env(safe-area-inset-top)) 20px 25px", borderRadius: "0 0 45px 45px", textAlign: "center", zIndex: 10, boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.9, marginBottom: 5, cursor: 'pointer' },
  babyBadge: { fontSize: 38, color: "white", fontWeight: 800, marginBottom: 15, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  vitaminBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderRadius:'15px', color:'white', fontWeight:800, marginBottom:15, cursor:'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "25px", padding: "20px", border: "1px solid rgba(255, 255, 255, 0.4)", display: "inline-block", width: "100%", maxWidth: "340px", boxShadow: '0 10px 20px rgba(0,0,0,0.05)' },
  progressBarContainer: { width: '100%', height: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', marginTop: '15px', overflow: 'hidden' },
  progressBarFill: { height: '100%', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)', borderRadius: '10px' },
  nextFeedBox: { marginTop: 15, background: "rgba(255,255,255,0.7)", padding: "12px 16px", borderRadius: "18px", cursor: "pointer", border: `1px solid rgba(255,255,255,0.9)` },
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 120px" }, 
  actionBtn: { flex: 1, padding: "20px 10px", borderRadius: "24px", fontSize: 20, fontWeight: 800, fontFamily: FONT_KIDS, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' },
  card: { background: "white", borderRadius: "25px", padding: "20px", border: `1px solid #f1f5f9`, marginBottom: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' },
  cardTitle: { fontSize: 19, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 0 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 15, padding: "8px", background: "#fff5f0", borderRadius: "12px", color: C.peachDark, marginBottom: 10 },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "12px", borderRadius: "18px", border: "1px solid #f8fafc", zIndex: 2, position: 'relative' },
  chainContainer: { display: 'flex', alignItems: 'center', marginTop: '-6px', marginBottom: '-6px', marginRight: '20px', height: '40px', zIndex: 1 },
  chainCurve: { width: '18px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 20px 20px 0', marginLeft: '10px', opacity: 0.8 },
  chainText: { fontSize: 11, fontWeight: 800, color: C.textSoft },
  summaryBarSmall: { marginTop: 15, padding: "12px 5px", background: "#f8fafc", borderRadius: "15px", textAlign: "center", border: "1px solid #f1f5f9" },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:8, textAlign:'center', fontWeight:800, fontSize:15, padding:8, marginTop:8 },
  delBtn: { background:'none', border:'none', color: '#cbd5e1', fontSize: 14, cursor: 'pointer' },
  eventTime: { fontSize: 13, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 16, fontWeight: 700, marginTop: 5 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", borderTop: `1px solid #f1f5f9`, padding: "12px calc(12px + env(safe-area-inset-bottom))", zIndex: 9999, boxShadow: "0 -5px 20px rgba(0,0,0,0.06)" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "14px", borderRadius: "18px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 16, transition: 'background 0.2s' }),
  input: { width: "100%", padding: "14px", borderRadius: "12px", border: `2px solid #f1f5f9`, fontWeight: 700, fontSize: 16, background: '#f8fafc' },
  primaryBtn: { width: "100%", padding: "16px", borderRadius: "20px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 18, boxShadow: '0 4px 12px rgba(244, 165, 138, 0.3)' },
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px dotted #e2e8f0' },
  doneBtn: { background: C.success, color: 'white', border: 'none', borderRadius: '10px', padding: '8px 14px', fontWeight: 800, fontSize: 13 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999 },
  modal: { background: "white", padding: "30px 25px", borderRadius: "35px", width: "90%", maxWidth: 360, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
  chip: (active) => ({ flex: 1, padding: "12px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #f1f5f9", background: active ? C.creamSoft : "#f8fafc", fontWeight: 800, color: active ? C.peachDark : C.textSoft }),
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #f8fafc' },
  aiFab: { position: 'fixed', bottom: 90, left: 20, background: '#a855f7', color: 'white', border: 'none', borderRadius: '50%', width: 56, height: 56, fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)', zIndex: 9998, cursor: 'pointer' }
};
