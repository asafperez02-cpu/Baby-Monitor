import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Strong Pastel) ──────────────────────────────────────
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
    return () => unsubEvents();
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    const docRef = await addDoc(collection(db, "events"), { ts: Date.now(), user: userName, ...ev });
    setUndoAction({ id: docRef.id });
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
          <span>נרשם בהצלחה! ✨</span>
          <button onClick={async () => { await deleteDoc(doc(db,"events",undoAction.id)); setShowUndo(false); }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        <MainTimerWidget events={events} now={now} onOpenFutureFeeds={() => setModal("futureFeeds")} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "analytics" && <div style={S.card}>סטטיסטיקות בקרוב... 📊</div>}
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

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now, onOpenFutureFeeds }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  const diffMin = Math.floor((now - lastFeed.ts) / 60000);
  const timeStr = diffMin < 60 ? `${diffMin} דק׳` : `${Math.floor(diffMin/60)}:${(diffMin%60).toString().padStart(2,'0')} ש׳`;
  const nextTarget = new Date(lastFeed.ts + 4 * 60 * 60 * 1000);
  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 2, opacity: 0.9}}>אכלה לפני:</div>
      <div className="kids-font" style={{fontSize: 48, fontWeight: 900, color: 'white'}}>🍼 {timeStr}</div>
      <div style={S.nextFeedBox} onClick={onOpenFutureFeeds}>
          <span style={{fontSize: 14, fontWeight: 700, color: C.textSoft}}>ארוחה הבאה: </span>
          <span style={{fontSize: 18, fontWeight: 900, color: C.text}}>{fmtTime(nextTarget.getTime())}</span>
      </div>
    </div>
  );
}

function FutureFeedsModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  const futureFeeds = Array.from({length: 4}).map((_, i) => new Date(lastFeed.ts + (i + 1) * 4 * 60 * 60 * 1000));
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>תחזית ארוחות ⏰</h3>
        {futureFeeds.map((time, i) => (
          <div key={i} style={S.itemRow}><span>ארוחה {i+1}:</span><span style={{fontWeight:800}}>{fmtTime(time.getTime())}</span></div>
        ))}
        <button onClick={onClose} style={S.primaryBtn}>סגור</button>
    </div></div>
  );
}

// ── AI Component (The Bulletproof Fix) ────────────────────────────────────
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
      const history = events.slice(0, 15).map(e => {
        const t = new Date(e.ts).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
        return e.type === 'feed' ? `${t}: אכלה ${e.ml} מ"ל` : `${t}: חיתול`;
      }).join('\n');

      // הכתובת החדשה והיציבה ביותר
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${localKey.trim()}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `נתונים: ${history}. שאלה: ${q}. ענה בעברית קצרה מאוד.` }] }]
        })
      });

      const data = await res.json();
      if (data.error) {
        setAns(`שגיאה: ${data.error.message}`);
      } else {
        setAns(data.candidates?.[0]?.content?.parts?.[0]?.text || "לא הצלחתי להבין.");
      }
    } catch (err) { setAns("שגיאת תקשורת."); }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark}}>העוזרת של עלמה ✨</h3>
        {isEditingKey ? (
          <div>
            <p style={{fontSize:13, textAlign:'center', color:C.textSoft, marginBottom: 10}}>הדבק כאן מפתח API מ-Google Studio:</p>
            <input placeholder="AIza..." value={localKey} onChange={e=>setLocalKey(e.target.value)} style={S.input} />
            <button onClick={() => { localStorage.setItem("gemini_key", localKey.trim()); setIsEditingKey(false); }} style={S.primaryBtn}>שמור מפתח</button>
          </div>
        ) : (
          <>
            <input placeholder="כמה עלמה אכלה היום?" value={q} onChange={e=>setQ(e.target.value)} style={S.input} onKeyDown={e=>e.key==='Enter'&&askAi()} />
            <button onClick={askAi} disabled={loading} style={S.primaryBtn}>{loading?"חושבת...":"שאל אותי"}</button>
            {ans && <div style={S.aiResponse}>{ans}</div>}
            <button onClick={()=>setIsEditingKey(true)} style={{background:'none', border:'none', color:C.textSoft, fontSize:11, marginTop:20, textDecoration:'underline', width:'100%'}}>עדכון מפתח API</button>
          </>
        )}
    </div></div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a,b)=>b.ts-a.ts);
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a,b)=>b.ts-a.ts);
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
          <div style={{flex:1}}>
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
          <div style={{flex:1}}>
            <div style={S.columnHeader}>חיתול ({diapers.length})</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.blueSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <div style={{fontWeight:800}}>{e.pee?"💧":""}{e.poop?"💩":""}</div>
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

const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "calc(15px + env(safe-area-inset-top)) 20px 25px", borderRadius: "0 0 45px 45px", textAlign: "center", boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.9, marginBottom: 5 },
  babyBadge: { fontSize: 38, color: "white", fontWeight: 800, marginBottom: 15, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "25px", padding: "20px", width: "100%", maxWidth: "340px", display: "inline-block" },
  nextFeedBox: { marginTop: 15, background: "rgba(255,255,255,0.7)", padding: "12px", borderRadius: "18px" },
  content: { flex: 1, overflowY: "auto", padding: "25px 20px" },
  actionBtn: { flex: 1, padding: "22px 10px", borderRadius: "24px", fontSize: 20, fontWeight: 800, border:'none' },
  card: { background: "white", borderRadius: "30px", padding: "25px", boxShadow: '0 10px 30px rgba(0,0,0,0.03)', border:'1px solid #f1f5f9' },
  cardTitle: { fontSize: 20, fontWeight: 800, marginBottom: 20, textAlign: "center", color: C.peachDark },
  columnHeader: { textAlign: "center", fontSize: 13, fontWeight: 800, color: C.textSoft, marginBottom: 12, background: '#f8fafc', padding: '8px', borderRadius: '12px' },
  eventMiniCard: { padding: '12px', borderRadius: '18px', marginBottom: 12, border: '1px solid #f1f5f9', position:'relative' },
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
  undoToast: { position: 'fixed', bottom: 110, right: 20, left: 20, background: '#333', color: 'white', padding: '15px 25px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 9999 },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '15px 0' }
};
