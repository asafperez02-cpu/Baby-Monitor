import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, limit as firestoreLimit
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme ────────────────────────────────────────────────────────
const C = {
  bg: "#fffcfb",
  white: "#ffffff",
  border: "#f7d7c4",
  pinkDark: "#e879f9",
  peach: "#f4a58a",
  peachDark: "#e8845e",
  blueSoft: "#e0f2fe",
  creamSoft: "#fff7ed",
  text: "#4a2c2a",
  textSoft: "#8c6d6a",
  textMuted: "#c0987e",
  nightBg: "#2d3436",
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function getDayName(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function manualTimeToTs(manualTime) {
  if (!manualTime) return Date.now();
  const [hours, minutes] = manualTime.split(':');
  const d = new Date();
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return d.getTime();
}

function getTimeGap(ts1, ts2) {
  const diff = Math.abs(ts1 - ts2);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}:${rm < 10 ? '0'+rm : rm} ש׳` : `${h} ש׳`;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("home");
  const [userName, setUserName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [lastAddedId, setLastAddedId] = useState(null);
  const [showUndo, setShowUndo] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("ts", "desc"));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const addEvent = async (ev) => {
    // רטט (שיפור 2)
    if ("vibrate" in navigator) navigator.vibrate(50);
    
    // סימון לילה אוטומטי (שיפור 9)
    const eventTs = ev.manualTime ? manualTimeToTs(ev.manualTime) : Date.now();
    const hr = new Date(eventTs).getHours();
    const isNight = hr >= 22 || hr < 6;

    const docRef = await addDoc(collection(db, "events"), { 
      ts: eventTs, 
      user: ev.parent || userName, 
      isNight,
      ...ev 
    });

    // מנגנון Undo (שיפור 6)
    setLastAddedId(docRef.id);
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const deleteEvent = async (id, skipConfirm = false) => {
    if (skipConfirm || window.confirm("למחוק את התיעוד הזה?")) {
      await deleteDoc(doc(db, "events", id));
      if (id === lastAddedId) setShowUndo(false);
    }
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        button:active { transform: scale(0.96); filter: brightness(0.9); }
        .kids-font { font-family: ${FONT_KIDS} !important; }
        .undo-toast {
          position: fixed; bottom: 85px; left: 20px; right: 20px;
          background: #333; color: white; padding: 12px 20px;
          borderRadius: 15px; display: flex; justify-content: space-between;
          align-items: center; z-index: 1000; boxShadow: 0 4px 12px rgba(0,0,0,0.2);
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Undo Toast */}
      {showUndo && (
        <div className="undo-toast">
          <span>עודכן בהצלחה!</span>
          <button onClick={() => deleteEvent(lastAddedId, true)} style={{background:'none', border:'none', color: C.peach, fontWeight:800, fontSize:16}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>אלה 🌸</div>
        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && (
          <>
            <HomeView events={events} setModal={setModal} onDelete={deleteEvent} />
            <ParentWeeklyStats events={events} />
          </>
        )}
        {tab === "history" && <WeeklySummary events={events} fullView />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 יומן</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} currentUser={userName} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} currentUser={userName} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  const lastDiaper = events.find(e => e.type === "diaper");

  const timeAgo = (ts) => {
    if (!ts) return "--";
    const diff = Math.floor((now - ts) / 60000);
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h} ש׳ ו-${m} דק׳` : `${m} דק׳`;
  };

  // חיזוי ארוחה הבאה (3.5 עד 4 שעות)
  const getNextFeedRange = (ts) => {
    if (!ts) return "";
    const start = new Date(ts + 3.5 * 60 * 60 * 1000);
    const end = new Date(ts + 4 * 60 * 60 * 1000);
    return `${fmtTime(start.getTime())} - ${fmtTime(end.getTime())}`;
  };

  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 2}}>אכלה לפני ({lastFeed?.user || "?"}):</div>
      <div className="kids-font" style={{fontSize: 32, fontWeight: 900, color: 'white'}}>🍼 {timeAgo(lastFeed?.ts)}</div>
      <div style={{fontSize: 12, fontWeight: 700, color: 'white', marginTop: 4, opacity: 0.9}}>
        🎯 ארוחה הבאה: {getNextFeedRange(lastFeed?.ts)}
      </div>
      <div style={S.subTimer}>⏳ הוחלפה לפני {timeAgo(lastDiaper?.ts)}</div>
    </div>
  );
}

function ParentWeeklyStats({ events }) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stats = events
    .filter(e => e.ts > weekAgo && e.type === "feed")
    .reduce((acc, e) => {
      acc[e.user] = (acc[e.user] || 0) + 1;
      return acc;
    }, { "אמא": 0, "אבא": 0 });

  return (
    <div style={{...S.card, marginTop: 10, background: '#f8fafc'}}>
      <div className="kids-font" style={{...S.cardTitle, fontSize: 16}}>סיכום האכלות שבועי 🏆</div>
      <div style={{display:'flex', justifyContent:'space-around', textAlign:'center'}}>
        <div>
          <div style={{fontSize: 24}}>👩‍🍼</div>
          <div style={{fontWeight: 800, color: C.pinkDark}}>אמא</div>
          <div style={{fontSize: 18, fontWeight: 900}}>{stats["אמא"]}</div>
        </div>
        <div style={{width:1, background: '#e2e8f0'}}></div>
        <div>
          <div style={{fontSize: 24}}>👨‍🍼</div>
          <div style={{fontWeight: 800, color: '#3b82f6'}}>אבא</div>
          <div style={{fontSize: 18, fontWeight: 900}}>{stats["אבא"]}</div>
        </div>
      </div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feedEvents = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a,b) => b.ts - a.ts);
  const diaperEvents = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a,b) => b.ts - a.ts);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setModal("feed")} style={{ ...S.actionBtn, background: "#fef3c7", color: "#b45309" }}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{ ...S.actionBtn, background: "#fce7f3", color: "#be185d" }}>🧷 החתלה</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של אלה</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🍼 אוכל</div>
            {feedEvents.map((e, i) => (
              <div key={e.id}>
                <div style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                      <span style={S.eventTime}>{fmtTime(e.ts)} {e.isNight ? '🌙' : ''}</span>
                      <button onClick={() => onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.ml} מ"ל</span>
                  <span style={{fontSize: 10, fontWeight: 700, opacity: 0.6}}>{e.user}</span>
                </div>
                {feedEvents[i+1] && (
                  <div style={S.gapIndicator}>↓ {getTimeGap(e.ts, feedEvents[i+1].ts)} ↓</div>
                )}
              </div>
            ))}
          </div>

          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diaperEvents.map((e, i) => (
              <div key={e.id}>
                <div style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                      <span style={S.eventTime}>{fmtTime(e.ts)} {e.isNight ? '🌙' : ''}</span>
                      <button onClick={() => onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.pee ? "💧" : ""}{e.poop ? "💩" : ""}</span>
                  <span style={{fontSize: 10, fontWeight: 700, opacity: 0.6}}>{e.user}</span>
                </div>
                {diaperEvents[i+1] && (
                  <div style={S.gapIndicator}>↓ {getTimeGap(e.ts, diaperEvents[i+1].ts)} ↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedModal({ onConfirm, onClose, currentUser }) {
  const [step, setStep] = useState("checkDiaper");
  const [ml, setMl] = useState("");
  const [customMl, setCustomMl] = useState("");
  const [parent, setParent] = useState(currentUser);
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  if (step === "checkDiaper") return (
    <div style={S.overlay}><div style={S.modal}>
      <h3 className="kids-font" style={{textAlign:'center', marginBottom:20, color: C.peachDark}}>רגע לפני... 🧷</h3>
      <p style={{textAlign:'center', marginBottom:20, fontWeight:700}}>האם החלפת לאלה טיטול?</p>
      <div style={{display:'flex', gap:10}}>
        <button onClick={() => setStep("entry")} style={S.primaryBtn}>כן, הכל נקי!</button>
        <button onClick={() => setStep("entry")} style={{...S.primaryBtn, background:'#eee', color: C.textSoft}}>אחליף אחר כך</button>
      </div>
    </div></div>
  );

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 className="kids-font" style={{ textAlign: "center", marginBottom: 15 }}>מתי וכמה? 🍼</h3>
        
        <div style={{marginBottom: 15}}>
          <label style={S.label}>מי האכיל?</label>
          <div style={{display:'flex', gap:10}}>
            <button onClick={() => setParent("אמא")} style={S.chip(parent === "אמא")}>👩‍🍼 אמא</button>
            <button onClick={() => setParent("אבא")} style={S.chip(parent === "אבא")}>👨‍🍼 אבא</button>
          </div>
        </div>

        <div style={{marginBottom: 15}}>
          <label style={S.label}>שעת האכלה:</label>
          <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={S.input} />
        </div>

        <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:15}}>
            {[60,90,120,150,180].map(v => (
                <button key={v} onClick={()=>{setMl(v); setCustomMl("");}} style={S.chip(ml==v)}>{v}</button>
            ))}
        </div>
        <div style={{marginBottom: 20}}>
          <input type="number" value={customMl} onChange={e => { setCustomMl(e.target.value); setMl(""); }} placeholder="כמות אחרת..." style={S.input} />
        </div>
        <button onClick={() => { onConfirm({ type: "feed", ml: ml || customMl, manualTime, parent }); onClose(); }} style={S.primaryBtn} disabled={(!ml && !customMl) || !manualTime}>שמור עדכון</button>
      </div>
    </div>
  );
}

function DiaperModal({ onConfirm, onClose, currentUser }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [parent, setParent] = useState(currentUser);
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 className="kids-font" style={{ textAlign: "center", marginBottom: 15 }}>מתי ומה היה? 💩</h3>
        
        <div style={{marginBottom: 15}}>
          <label style={S.label}>מי החליף?</label>
          <div style={{display:'flex', gap:10}}>
            <button onClick={() => setParent("אמא")} style={S.chip(parent === "אמא")}>👩‍🍼 אמא</button>
            <button onClick={() => setParent("אבא")} style={S.chip(parent === "אבא")}>👨‍🍼 אבא</button>
          </div>
        </div>

        <div style={{marginBottom: 15}}>
          <label style={S.label}>שעת החתלה:</label>
          <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={S.input} />
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
          <button onClick={() => setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
        </div>
        <button onClick={() => { onConfirm({ type: "diaper", pee, poop, manualTime, parent }); onClose(); }} style={S.primaryBtn} disabled={(!pee && !poop) || !manualTime}>שמור עדכון</button>
      </div>
    </div>
  );
}

function WeeklySummary({ events, limit = 7, fullView = false }) {
  const days = {};
  events.forEach(e => {
    const date = new Date(e.ts).toDateString();
    if (!days[date]) days[date] = { ts: e.ts, ml: 0, diapers: 0 };
    if (e.type === "feed") days[date].ml += Number(e.ml || 0);
    if (e.type === "diaper") days[date].diapers += 1;
  });
  const sortedDays = Object.values(days).sort((a, b) => b.ts - a.ts).slice(0, limit);
  return (
    <div style={S.card}>
      <div className="kids-font" style={S.cardTitle}>{fullView ? "יומן שבועי" : "סיכום קצר"}</div>
      {sortedDays.map(day => (
        <div key={day.ts} style={S.summaryRow}>
          <div style={{ fontWeight: 800, width: 90 }}>{getDayName(day.ts)}</div>
          <div style={{ flex: 1, color: C.peachDark, fontWeight: 700 }}>🍼 {day.ml} מ"ל</div>
          <div style={{ flex: 1, color: C.pinkDark, fontWeight: 700 }}>🧷 {day.diapers}</div>
        </div>
      ))}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { 
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    display: "flex", flexDirection: "column",
    color: C.text, background: C.bg, 
    userSelect: "none", WebkitUserSelect: "none",
  },
  headerContainer: { 
    flexShrink: 0,
    background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, 
    padding: "calc(15px + env(safe-area-inset-top)) 20px 25px",
    borderRadius: "0 0 40px 40px", textAlign: "center",
    boxShadow: "0 8px 20px rgba(232, 121, 249, 0.2)",
    zIndex: 10
  },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.85, marginBottom: 2 },
  babyBadge: { fontSize: 32, color: "white", fontWeight: 800, marginBottom: 10 },
  mainWidget: {
    background: "rgba(255, 255, 255, 0.22)", backdropFilter: "blur(10px)",
    borderRadius: "22px", padding: "12px", border: "1px solid rgba(255, 255, 255, 0.3)",
    display: "inline-block", width: "100%", maxWidth: "320px"
  },
  subTimer: {
    marginTop: 6, fontSize: 11, fontWeight: 700, color: "white",
    background: "rgba(0,0,0,0.12)", padding: "3px 10px", borderRadius: "15px", display:'inline-block'
  },
  content: { 
    flex: 1,
    overflowY: "auto",
    padding: "15px 12px 100px",
    WebkitOverflowScrolling: "touch",
  },
  actionBtn: { flex: 1, border: "none", padding: "18px", borderRadius: "18px", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: FONT_KIDS },
  card: { background: "white", borderRadius: "22px", padding: "15px", border: `1px solid ${C.border}`, marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: 800, marginBottom: 12, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 13, padding: "6px", background: "#fff5f0", borderRadius: "8px", color: C.peachDark, marginBottom: 5 },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px", borderRadius: "12px", border: "1px solid #f1f5f9", background: "white" },
  gapIndicator: { textAlign: "center", fontSize: 10, color: C.textMuted, margin: "2px 0", fontWeight: 700 },
  delBtn: { background:'none', border:'none', color: '#cbd5e1', fontSize: 12, cursor:'pointer' },
  eventTime: { fontSize: 11, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 14, fontWeight: 700 },
  summaryRow: { display: "flex", padding: "8px 0", borderBottom: "1px dotted #f1f5f9", fontSize: 13 },
  nav: { 
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "rgba(255,255,255,0.96)", backdropFilter:'blur(10px)', 
    display: "flex", borderTop: `1px solid ${C.border}`, 
    padding: "10px 10px calc(10px + env(safe-area-inset-bottom))",
    zIndex: 10 
  },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "10px", borderRadius: "12px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 15 }),
  input: { width: "100%", padding: "10px", borderRadius: "10px", border: `2px solid ${C.border}`, fontSize: 17, textAlign:'center', fontWeight: 700 },
  label: { fontSize: 12, fontWeight: 800, color: C.peachDark, marginBottom: 4, display: "block" },
  primaryBtn: { width: "100%", padding: "14px", borderRadius: "18px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 17, cursor:'pointer' },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "white", padding: "20px", borderRadius: "25px", width: "100%", maxWidth: 340 },
  chip: (active) => ({ flex: "1", padding: "10px", borderRadius: "10px", border: active ? `2px solid ${C.peach}` : "1px solid #e2e8f0", background: active ? C.creamSoft : "white", fontWeight: 700, cursor:'pointer', fontSize: 14 }),
};
