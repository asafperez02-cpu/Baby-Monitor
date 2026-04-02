import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Enhanced Pastel) ──────────────────────────────────────
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

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [vitaminDone, setVitaminDone] = useState(false);
  const [tab, setTab] = useState("home");
  const [userName, setUserName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [dailyTip, setDailyTip] = useState("");

  const tips = [
    "זמן בטן עוזר לעלמה לחזק את שרירי הצוואר! 💪",
    "קשר עין בזמן האכלה בונה ביטחון וקרבה 🌸",
    "מוזיקה שקטה יכולה לעזור לעלמה להירגע לפני שינה 🎶",
    "אל תשכחו לצלם רגעים קטנים, הם גדלים כל כך מהר! 📸"
  ];

  useEffect(() => {
    setDailyTip(tips[Math.floor(Math.random() * tips.length)]);
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
    await addDoc(collection(db, "events"), { ts: Date.now(), user: userName, ...ev });
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
      `}</style>

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        
        <div style={S.tipBox}>✨ {dailyTip}</div>

        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "analytics" && <AnalyticsView events={events} />}
      </div>

      <button onClick={() => setModal("ai")} style={S.aiFab}>🍼</button>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 יומן</button>
        <button onClick={() => setTab("analytics")} style={S.navBtn(tab === "analytics")}>📊 מגמות</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "ai" && <AiModal events={events} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  
  const diffMin = Math.floor((now - lastFeed.ts) / 60000);
  const timeStr = diffMin < 60 ? `${diffMin} דק׳` : `${Math.floor(diffMin/60)}:${(diffMin%60).toString().padStart(2,'0')} ש׳`;
  
  // מדד ה"נחת" - אם אכלה לא מזמן, המדד גבוה
  const satisfaction = Math.max(0, 100 - Math.floor(diffMin / 2.4)); 

  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 8}}>זמן מאז האכלה:</div>
      <div className="kids-font" style={{fontSize: 48, fontWeight: 900, color: 'white'}}>{timeStr}</div>
      <div style={{marginTop: 10, fontSize: 13, color: 'white', opacity: 0.9}}>
        😊 מדד הנחת של עלמה: {satisfaction}%
      </div>
    </div>
  );
}

function AiModal({ events, onClose }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [loading, setLoading] = useState(false);
  const [localKey, setLocalKey] = useState(() => localStorage.getItem("gemini_key") || "");

  const askAi = async (customPrompt = null) => {
    const queryText = customPrompt || q;
    if (!queryText.trim() || !localKey) return;
    setLoading(true);
    setAns("מנתחת נתונים... 🌸");

    try {
      const contextData = events.slice(0, 15).map(e => {
        const time = new Date(e.ts).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' });
        return e.type === 'feed' ? `[${time}] אכלה ${e.ml}ml` : `[${time}] חיתול`;
      }).join('\n');

      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${localKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `נתונים:\n${contextData}\n\nשאלה: ${queryText}\nענה בעברית חמה וקצרה.` }] }]
        })
      });

      const data = await res.json();
      setAns(data.candidates?.[0]?.content?.parts?.[0]?.text || "סליחה, המפתח לא תקין.");
    } catch (err) { setAns("שגיאת תקשורת."); }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>העוזרת של עלמה ✨</h3>
        {!localKey ? (
          <div style={{textAlign:'center'}}>
            <input placeholder="הדבק מפתח API כאן" onChange={e=>setLocalKey(e.target.value)} style={S.input} />
            <button onClick={() => {localStorage.setItem("gemini_key", localKey); setAns("המפתח נשמר!");}} style={S.primaryBtn}>שמור</button>
          </div>
        ) : (
          <>
            <div style={{display:'flex', gap: 10, marginBottom: 15}}>
              <button onClick={() => askAi("תני לי סיכום קצר של היום של עלמה בצורה רגשית")} style={S.chip(true)}>📝 סיכום יום</button>
              <button onClick={() => askAi("איך עלמה מרגישה לפי זמני האוכל שלה?")} style={S.chip(true)}>🌈 מצב רוח</button>
            </div>
            <input placeholder="שאל אותי משהו..." value={q} onChange={e=>setQ(e.target.value)} style={S.input} />
            <button onClick={() => askAi()} disabled={loading} style={S.primaryBtn}>{loading ? "חושבת..." : "שאל"}</button>
            {ans && <div style={S.aiResponse}>{ans}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  
  return (
    <div style={{display:'flex', flexDirection:'column', gap:15}}>
      <div style={{display:'flex', gap:10}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background: C.creamSoft}}>🍼 אוכל</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background: C.blueSoft}}>🧷 חיתול</button>
      </div>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>האירועים האחרונים</div>
        {events.slice(0, 10).map(e => (
          <div key={e.id} style={S.eventRow}>
            <span>{e.type === 'feed' ? '🍼' : '🧷'} {fmtTime(e.ts)}</span>
            <span style={{fontWeight: 700}}>{e.ml ? `${e.ml} מ"ל` : 'החתלה'}</span>
            <button onClick={()=>onDelete(e.id)} style={{border:'none', background:'none', color:C.danger}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsView({ events }) {
  return <div style={S.card}>גרפים וניתוחים יופיעו כאן בקרוב... 📊</div>;
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("120");
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font">כמה עלמה אכלה? 🍼</h3>
      <input type="number" value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml}); onClose();}} style={S.primaryBtn}>שמור</button>
    </div></div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font">החתלה מוצלחת! 🧷</h3>
      <button onClick={()=>{onConfirm({type:'diaper'}); onClose();}} style={S.primaryBtn}>סיימתי</button>
    </div></div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "40px 20px 25px", borderRadius: "0 0 35px 35px", textAlign: "center" },
  greeting: { fontSize: 14, color: "white", opacity: 0.9 },
  babyBadge: { fontSize: 32, color: "white", marginBottom: 10 },
  tipBox: { background: "rgba(255,255,255,0.2)", padding: "8px", borderRadius: "12px", color: "white", fontSize: 13, marginBottom: 15 },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(10px)", borderRadius: "20px", padding: "20px", width: "100%" },
  content: { flex: 1, overflowY: "auto", padding: "20px" },
  actionBtn: { flex: 1, padding: "20px", borderRadius: "20px", border: "none", fontSize: 18, fontWeight: 800 },
  card: { background: "white", borderRadius: "20px", padding: "15px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" },
  cardTitle: { fontSize: 18, marginBottom: 10, color: C.peachDark },
  eventRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f0f0" },
  nav: { display: "flex", background: "white", padding: "15px", borderTop: "1px solid #eee" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "10px", borderRadius: "15px", color: active ? "white" : C.textSoft, fontWeight: 700 }),
  aiFab: { position: "fixed", bottom: 85, left: 20, width: 60, height: 60, borderRadius: "30px", background: C.white, border: `2px solid ${C.peach}`, fontSize: 30, boxShadow: "0 4px 15px rgba(0,0,0,0.1)" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "white", padding: "25px", borderRadius: "25px", width: "85%", maxWidth: "350px" },
  input: { width: "100%", padding: "12px", borderRadius: "12px", border: `1px solid ${C.border}`, marginBottom: 10, textAlign: "center", fontSize: 16 },
  primaryBtn: { width: "100%", padding: "12px", borderRadius: "12px", background: C.peach, color: "white", border: "none", fontWeight: 800 },
  aiResponse: { marginTop: 15, padding: "12px", background: C.creamSoft, borderRadius: "12px", fontSize: 14, color: C.text, lineHeight: "1.4" },
  chip: (active) => ({ padding: "8px 12px", borderRadius: "15px", border: "none", background: C.blueSoft, fontSize: 12, fontWeight: 700 })
};
