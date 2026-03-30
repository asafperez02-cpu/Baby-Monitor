import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy
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
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function manualTimeToTs(manualTime) {
  const [hours, minutes] = manualTime.split(':');
  const d = new Date();
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return d.getTime();
}

// חישוב הפרש זמנים בין שני אירועים (בפורמט קריא)
function getTimeGap(ts1, ts2) {
  const diff = Math.abs(ts1 - ts2);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}:${rm < 10 ? '0'+rm : rm} ש׳` : `${h} ש׳`;
}

export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("home");
  const [userName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());

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
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(25);
    const finalTs = ev.manualTime ? manualTimeToTs(ev.manualTime) : Date.now();
    await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
  };

  const deleteEvent = async (id) => {
    if (window.confirm("למחוק את התיעוד הזה?")) {
      await deleteDoc(doc(db, "events", id));
    }
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior-y: contain; margin: 0; background: ${C.bg}; }
        button:active { transform: scale(0.96); filter: brightness(0.9); }
      `}</style>

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div style={S.babyBadge}>עלמה 🌸</div>
        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={deleteEvent} />}
        {tab === "history" && <WeeklySummary events={events} fullView />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 יומן</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
    </div>
  );
}

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

  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 5}}>אכלה לפני:</div>
      <div style={{fontSize: 34, fontWeight: 900, color: 'white', fontFamily: FONT_KIDS}}>🍼 {timeAgo(lastFeed?.ts)}</div>
      <div style={S.subTimer}>⏳ הוחלפה לפני {timeAgo(lastDiaper?.ts)}</div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  
  // מיון אירועים מהחדש לישן
  const feedEvents = events.filter(e => e.type === "feed" && isToday(e.ts)).sort((a,b) => b.ts - a.ts);
  const diaperEvents = events.filter(e => e.type === "diaper" && isToday(e.ts)).sort((a,b) => b.ts - a.ts);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setModal("feed")} style={{ ...S.actionBtn, background: "#fef3c7", color: "#b45309" }}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{ ...S.actionBtn, background: "#fce7f3", color: "#be185d" }}>🧷 החתלה</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        <div style={{ display: "flex", gap: 15 }}>
          {/* טור אוכל עם שרשרת הפרשים */}
          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🍼 אוכל</div>
            {feedEvents.map((e, i) => (
              <div key={e.id}>
                <div style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                      <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                      <button onClick={() => onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.ml} מ"ל</span>
                </div>
                {/* הצגת פער זמנים לאירוע הבא (הקודם כרונולוגית) */}
                {feedEvents[i+1] && (
                  <div style={S.gapIndicator}>
                    ↓ {getTimeGap(e.ts, feedEvents[i+1].ts)} ↓
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* טור חיתול עם שרשרת הפרשים */}
          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diaperEvents.map((e, i) => (
              <div key={e.id}>
                <div style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                      <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                      <button onClick={() => onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.pee ? "💧" : ""}{e.poop ? "💩" : ""}</span>
                </div>
                {diaperEvents[i+1] && (
                  <div style={S.gapIndicator}>
                    ↓ {getTimeGap(e.ts, diaperEvents[i+1].ts)} ↓
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [step, setStep] = useState("checkDiaper");
  const [ml, setMl] = useState("");
  const [customMl, setCustomMl] = useState("");
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  if (step === "checkDiaper") return (
    <div style={S.overlay}><div style={S.modal}>
      <h3 style={{textAlign:'center', marginBottom:20, color: C.peachDark, fontFamily: FONT_KIDS}}>רגע לפני... 🧷</h3>
      <p style={{textAlign:'center', marginBottom:20, fontWeight:700}}>האם החלפת לעלמה טיטול?</p>
      <div style={{display:'flex', gap:10}}>
        <button onClick={() => setStep("entry")} style={S.primaryBtn}>כן, הכל נקי!</button>
        <button onClick={() => setStep("entry")} style={{...S.primaryBtn, background:'#eee', color: C.textSoft}}>אחליף אחר כך</button>
      </div>
    </div></div>
  );

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: 15, fontFamily: FONT_KIDS }}>מתי וכמה? 🍼</h3>
        
        <div style={{marginBottom: 20}}>
          <label style={S.label}>שעת האכלה (רטרו):</label>
          <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={S.input} />
        </div>

        <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:15}}>
            {[60,90,120,150,180].map(v => (
                <button key={v} onClick={()=>{setMl(v); setCustomMl("");}} style={S.chip(ml==v)}>{v}</button>
            ))}
        </div>
        
        <div style={{marginBottom: 20}}>
          <input 
            type="number" 
            value={customMl} 
            onChange={e => { setCustomMl(e.target.value); setMl(""); }} 
            placeholder="כמות אחרת במ״ל..." 
            style={S.input} 
          />
        </div>

        <button onClick={() => { 
          onConfirm({ type: "feed", ml: ml || customMl, manualTime }); 
          onClose(); 
        }} style={S.primaryBtn} disabled={(!ml && !customMl) || !manualTime}>שמור עדכון</button>
      </div>
    </div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [manualTime, setManualTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: 15, fontFamily: FONT_KIDS }}>מתי ומה היה? 💩</h3>

        <div style={{marginBottom: 20}}>
          <label style={S.label}>שעת החתלה:</label>
          <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={S.input} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
          <button onClick={() => setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
        </div>
        <button onClick={() => { 
          onConfirm({ type: "diaper", pee, poop, manualTime }); 
          onClose(); 
        }} style={S.primaryBtn} disabled={(!pee && !poop) || !manualTime}>שמור עדכון</button>
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
    direction: "rtl", minHeight: "100vh", maxWidth: 480, margin: "0 auto", 
    color: C.text, background: C.bg, fontFamily: FONT_MAIN,
    userSelect: "none", WebkitUserSelect: "none"
  },
  headerContainer: { 
    background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, 
    padding: "30px 20px 40px", borderRadius: "0 0 60px 60px", textAlign: "center",
    boxShadow: "0 10px 25px rgba(232, 121, 249, 0.25)"
  },
  greeting: { fontSize: 14, color: "white", fontWeight: 600, opacity: 0.85, marginBottom: 5 },
  babyBadge: { fontSize: 36, fontFamily: FONT_KIDS, color: "white", fontWeight: 800, marginBottom: 20 },
  mainWidget: {
    background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(12px)",
    borderRadius: "30px", padding: "20px", border: "1px solid rgba(255, 255, 255, 0.3)",
    display: "inline-block", width: "100%", maxWidth: "320px"
  },
  subTimer: {
    marginTop: 10, fontSize: 13, fontWeight: 700, color: "white",
    background: "rgba(0,0,0,0.1)", padding: "4px 12px", borderRadius: "20px"
  },
  content: { padding: "20px 15px 120px" },
  actionBtn: { flex: 1, border: "none", padding: "22px", borderRadius: "25px", fontSize: 20, fontWeight: 800, cursor: "pointer", fontFamily: FONT_KIDS },
  card: { background: "white", borderRadius: "30px", padding: "20px", border: `1px solid ${C.border}`, marginBottom: 20 },
  cardTitle: { fontSize: 20, fontWeight: 800, marginBottom: 20, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column" },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 16, padding: "8px", background: "#fff5f0", borderRadius: "12px", color: C.peachDark, marginBottom: 10 },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", borderRadius: "15px", border: "1px solid #eee", background: "white" },
  gapIndicator: { 
    textAlign: "center", fontSize: 11, color: C.textMuted, 
    margin: "8px 0", fontWeight: 700, opacity: 0.7 
  },
  delBtn: { background:'none', border:'none', color: '#ccc', fontSize: 14, cursor:'pointer' },
  eventTime: { fontSize: 13, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 16, fontWeight: 700 },
  summaryRow: { display: "flex", padding: "12px 0", borderBottom: "1px dotted #eee", fontSize: 15 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.9)", backdropFilter:'blur(10px)', display: "flex", borderTop: `1px solid ${C.border}`, padding: "15px 10px 30px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft, fontFamily: FONT_KIDS, fontSize: 16 }),
  input: { width: "100%", padding: "12px", borderRadius: "12px", border: `2px solid ${C.border}`, fontSize: 18, textAlign:'center', fontFamily: FONT_MAIN, fontWeight: 700 },
  label: { fontSize: 14, fontWeight: 800, color: C.peachDark, marginBottom: 8, display: "block" },
  primaryBtn: { width: "100%", padding: "15px", borderRadius: "20px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 18, cursor:'pointer', fontFamily: FONT_KIDS },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "white", padding: "30px", borderRadius: "35px", width: "100%", maxWidth: 350 },
  chip: (active) => ({ flex: "1 0 30%", padding: "12px", borderRadius: "12px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700, cursor:'pointer' }),
};
