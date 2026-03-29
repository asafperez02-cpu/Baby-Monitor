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
