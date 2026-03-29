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

// שם הפונקציה שונה ל-App כדי לפתור את שגיאת ה-Import
export default function App() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("home");
  const [userName, setUserName] = useState(() => localStorage.getItem("baby_username") || "");
  const [setup, setSetup] = useState(!localStorage.getItem("baby_username"));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("ts", "desc"));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const addEvent = async (ev) => {
    const finalTs = ev.manualTime ? manualTimeToTs(ev.manualTime) : Date.now();
    await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
  };

  const deleteEvent = async (id) => {
    if (window.confirm("למחוק את התיעוד הזה?")) {
      await deleteDoc(doc(db, "events", id));
    }
  };

  if (setup) return <SetupScreen onDone={(u) => { 
    setUserName(u); 
    localStorage.setItem("baby_username", u); 
    setSetup(false); 
  }} />;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        h1, h2, h3, button, .kids-font { font-family: ${FONT_KIDS} !important; }
      `}</style>

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div style={S.babyBadge}>עלמה 🌸</div>
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={deleteEvent} />}
        {tab === "history" && <WeeklySummary events={events} fullView />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 סיכום</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Home View ──────────────────────────────────────────────────────────────
function HomeView({ events, setModal, onDelete }) {
  const lastFeed = events.find(e => e.type === "feed");
  const lastDiaper = events.find(e => e.type === "diaper");

  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feedEvents = events.filter(e => e.type === "feed" && isToday(e.ts));
  const diaperEvents = events.filter(e => e.type === "diaper" && isToday(e.ts));

  const timeAgo = (ts) => {
    if (!ts) return "—";
    const diff = Math.floor((Date.now() - ts) / 60000);
    if (diff < 60) return `${diff} דק׳`;
    return `${Math.floor(diff/60)} ש׳ ו-${diff%60} דק׳`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={S.statusStrip}>
        <div style={S.statusItem}>⏳ אכלה לפני: <b style={{color: C.peachDark}}>{timeAgo(lastFeed?.ts)}</b></div>
        <div style={S.statusItem}>⏳ הוחלפה לפני: <b style={{color: C.pinkDark}}>{timeAgo(lastDiaper?.ts)}</b></div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setModal("feed")} style={{ ...S.actionBtn, background: "#fef3c7", color: "#b45309" }}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{ ...S.actionBtn, background: "#fce7f3", color: "#be185d" }}>🧷 החתלה</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        <div style={{ display: "flex", gap: 10 }}>
          <ColumnWithTimeline title="🍼 אוכל" events={feedEvents} type="feed" onDelete={onDelete} />
          <ColumnWithTimeline title="🧷 חיתול" events={diaperEvents} type="diaper" onDelete={onDelete} />
        </div>
      </div>
      
      <WeeklySummary events={events} limit={3} />
    </div>
  );
}

function ColumnWithTimeline({ title, events, type, onDelete }) {
  return (
    <div style={S.column}>
      <div className="kids-font" style={S.columnHeader}>{title}</div>
      {events.map((e, i) => {
        const nextEv = events[i + 1];
        let timeDiff = null;
        if (nextEv) {
          const diffMin = Math.floor((e.ts - nextEv.ts) / 60000);
          const hrs = Math.floor(diffMin / 60);
          const mins = diffMin % 60;
          timeDiff = hrs > 0 ? `${hrs}ש׳ ${mins}ד׳` : `${mins}ד׳`;
        }
        return (
          <div key={e.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
              <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                <button onClick={() => onDelete(e.id)} style={S.delBtn}>✕</button>
              </div>
              <span style={S.eventDetail}>{type === 'feed' ? `${e.ml} מ"ל` : (e.pee ? "💧" : "") + (e.poop ? "💩" : "")}</span>
            </div>
            {timeDiff && (
              <div style={S.timelineConnector}>
                <div style={S.timelineLine}></div>
                <div style={S.timelineBadge}>{timeDiff}</div>
                <div style={S.timelineLine}></div>
              </div>
            )}
          </div>
        );
      })}
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
          <div style={{ flex: 1, color: C.peachDark }}>🍼 {day.ml} מ"ל</div>
          <div style={{ flex: 1, color: C.pinkDark }}>🧷 {day.diapers}</div>
        </div>
      ))}
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [step, setStep] = useState("check");
  const [ml, setMl] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [isManual, setIsManual] = useState(false);

  if (step === "check") return (
    <div style={S.overlay}><div style={S.modal}>
      <h3 style={{textAlign:'center', marginBottom:20}}>החלפת חיתול לפני? 🧷</h3>
      <div style={{display:'flex', gap:10}}>
        <button onClick={() => setStep("form")} style={S.primaryBtn}>כן!</button>
        <button onClick={() => setStep("form")} style={{...S.primaryBtn, background:'#ccc'}}>עוד מעט</button>
      </div>
    </div></div>
  );

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: 15 }}>כמות האכלה 🍼</h3>
        <div style={{marginBottom: 15}}>
          <div style={{display:'flex', gap:5, marginBottom:10}}>
            <button onClick={()=>setIsManual(false)} style={S.miniChip(!isManual)}>עכשיו</button>
            <button onClick={()=>setIsManual(true)} style={S.miniChip(isManual)}>שעה אחרת</button>
          </div>
          {isManual && <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={S.input} />}
        </div>
        <div style={{display:'flex', flexWrap:'wrap', gap:8, marginBottom:15}}>
            {[60,90,120,150,180].map(v => (
                <button key={v} onClick={()=>setMl(v)} style={S.chip(ml==v)}>{v}</button>
            ))}
        </div>
        <input type="number" value={ml} onChange={e => setMl(e.target.value)} placeholder="כמות אחרת..." style={S.input} />
        <button onClick={() => { onConfirm({ type: "feed", ml, manualTime: isManual ? manualTime : null }); onClose(); }} style={S.primaryBtn} disabled={!ml}>שמור</button>
      </div>
    </div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [manualTime, setManualTime] = useState("");
  const [isManual, setIsManual] = useState(false);
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: 15 }}>מה החלפנו? 💩</h3>
        <div style={{display:'flex', gap:5, marginBottom:15}}>
          <button onClick={()=>setIsManual(false)} style={S.miniChip(!isManual)}>עכשיו</button>
          <button onClick={()=>setIsManual(true)} style={S.miniChip(isManual)}>שעה אחרת</button>
        </div>
        {isManual && <input type="time" value={manualTime} onChange={e => setManualTime(e.target.value)} style={{...S.input, marginBottom:15}} />}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
          <button onClick={() => setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
        </div>
        <button onClick={() => { onConfirm({ type: "diaper", pee, poop, manualTime: isManual ? manualTime : null }); onClose(); }} style={S.primaryBtn} disabled={!pee && !poop}>שמור</button>
      </div>
    </div>
  );
}

function SetupScreen({ onDone }) {
  const [u, setU] = useState("");
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height: "100vh", flexDirection: "column", gap: 20, padding: 20 }}>
      <h1 className="kids-font">מי המשתמש? 🍼</h1>
      <div style={{display:'flex', gap:10}}>
          {["אבא", "אמא", "סבתא"].map(name => (
              <button key={name} onClick={()=>onDone(name)} style={S.primaryBtn}>{name}</button>
          ))}
      </div>
    </div>
  );
}

const S = {
  app: { direction: "rtl", minHeight: "100vh", maxWidth: 480, margin: "0 auto", color: C.text, background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "35px 20px", borderRadius: "0 0 50px 50px", textAlign: "center", boxShadow: "0 10px 20px rgba(0,0,0,0.05)" },
  greeting: { fontSize: 16, color: "white", fontWeight: 600 },
  babyBadge: { fontSize: 38, color: "white", fontWeight: 800, marginTop: 5 },
  content: { padding: "20px 15px 120px" },
  statusStrip: { display: "flex", justifyContent: "space-around", background: "white", padding: "15px", borderRadius: "20px", border: `1px solid ${C.border}` },
  statusItem: { fontSize: 14, fontWeight: 600 },
  actionBtn: { flex: 1, border: "none", padding: "22px", borderRadius: "25px", fontSize: 20, fontWeight: 800, cursor: "pointer" },
  card: { background: "white", borderRadius: "30px", padding: "20px", border: `1px solid ${C.border}`, marginBottom: 20 },
  cardTitle: { fontSize: 20, fontWeight: 800, marginBottom: 20, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 5 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 16, padding: "8px", background: "#fff5f0", borderRadius: "12px", color: C.peachDark },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", borderRadius: "15px", border: "1px solid #eee", width:'100%' },
  delBtn: { background:'none', border:'none', color: '#ccc', fontSize: 14, cursor:'pointer' },
  eventTime: { fontSize: 13, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 16, fontWeight: 700 },
  timelineConnector: { display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' },
  timelineLine: { width: '2px', height: '6px', background: '#f7d7c4' },
  timelineBadge: { fontSize: '9px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' },
  summaryRow: { display: "flex", padding: "12px 0", borderBottom: "1px dotted #eee", fontSize: 15 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,255,255,0.9)", backdropFilter:'blur(10px)', display: "flex", borderTop: `1px solid ${C.border}`, padding: "15px 10px 30px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 16 }),
  input: { width: "100%", padding: "12px", borderRadius: "12px", border: `2px solid ${C.border}`, fontSize: 16, textAlign:'center' },
  primaryBtn: { width: "100%", padding: "15px", borderRadius: "20px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 18, cursor:'pointer' },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "white", padding: "30px", borderRadius: "35px", width: "100%", maxWidth: 350 },
  chip: (active) => ({ flex: "1 0 30%", padding: "12px", borderRadius: "12px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700, cursor:'pointer' }),
  miniChip: (active) => ({ padding: "6px 12px", borderRadius: "8px", border: active ? `1px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontSize: 12, fontWeight: 700, cursor:'pointer' }),
};
