import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Pastel Edition - המקורי שאהבת) ──────────────────────
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
          <div style={{background: C.peach, color: 'white', borderRadius: '12px', padding: '6px 14px', fontSize: 13, fontWeight: 800, boxShadow: '0 4px 10px rgba(244, 165, 138, 0.4)'}}>תחזית</div>
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
        <p style={{textAlign:'center', fontSize: 13, color: C.textSoft, marginBottom: 20}}>הזמנים מחושבים לפי מרווחים של 4 שעות.</p>
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

// ── AI Component (The "Final Chance" Google Fix) ───────────────────────────
function AiModal({ events, onClose }) {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState("");
  const [loading, setLoading] = useState(false);
  const [localKey, setLocalKey] = useState(() => localStorage.getItem("gemini_key") || "");
  const [isEditingKey, setIsEditingKey] = useState(!localStorage.getItem("gemini_key"));

  const askAi = async () => {
    if (!q.trim() || !localKey) return;
    setLoading(true);
    setAns("מנתחת נתונים... 🌸");
    try {
      const dataForContext = events.slice(0, 20).map(e => {
        const time = new Date(e.ts).toLocaleString('he-IL', { hour:'2-digit', minute:'2-digit' });
        return e.type === 'feed' ? `${time}: אכלה ${e.ml}ml` : `${time}: חיתול`;
      }).join('\n');

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${localKey.trim()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `נתונים: ${dataForContext}. שאלה: ${q}. ענה בעברית קצרה מאוד.` }] }]
        })
      });

      const result = await res.json();
      if (result.error) setAns(`שגיאה: ${result.error.message}`);
      else setAns(result.candidates?.[0]?.content?.parts?.[0]?.text || "לא הצלחתי לענות.");
    } catch (err) { setAns("שגיאת תקשורת."); }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', marginBottom:5, color:C.peachDark}}>העוזרת של עלמה ✨</h3>
        {isEditingKey ? (
          <div>
            <p style={{fontSize:13, textAlign:'center', color:C.textSoft, marginBottom: 15}}>הדבק כאן מפתח API של גוגל:</p>
            <input placeholder="AIzaSy..." value={localKey} onChange={e=>setLocalKey(e.target.value)} style={S.input} />
            <button onClick={() => { localStorage.setItem("gemini_key", localKey.trim()); setIsEditingKey(false); }} style={S.primaryBtn}>שמור מפתח</button>
          </div>
        ) : (
          <>
            <input placeholder="כמה עלמה אכלה היום?" value={q} onChange={e=>setQ(e.target.value)} style={S.input} onKeyDown={(e) => e.key === 'Enter' && askAi()} />
            <button onClick={askAi} disabled={loading} style={S.primaryBtn}>{loading ? "מנתחת..." : "שאל אותי"}</button>
            {ans && <div style={S.aiResponse}>{ans}</div>}
            <div style={{textAlign:'center', marginTop:15}}><button onClick={()=>setIsEditingKey(true)} style={{background:'none', border:'none', color:C.textSoft, fontSize:12, textDecoration:'underline'}}>החלף מפתח</button></div>
          </>
        )}
      </div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a, b) => b.ts - a.ts);
  const totalMl = feeds.reduce((sum, e) => sum + Number(
