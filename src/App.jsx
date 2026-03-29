import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc, getDoc
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
  blueSoft: "#e0f2fe", // אבא
  creamSoft: "#fff7ed", // אמא
  greenSoft: "#f0fdf4", // סבתא
  text: "#4a2c2a",
  textSoft: "#8c6d6a",
};

// פונטים מומלצים לעברית (Assistant נראה נהדר באפליקציות)
const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; // פונט עגול ו"ילדותי" יותר

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function getDayName(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("home");
  const [userName, setUserName] = useState(() => localStorage.getItem("baby_username") || "");
  const [babyName, setBabyName] = useState("התינוקת");
  const [setup, setSetup] = useState(!localStorage.getItem("baby_username"));
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("ts", "desc"));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const addEvent = async (ev) => {
    await addDoc(collection(db, "events"), { ts: Date.now(), user: userName, ...ev });
  };

  if (setup) return <SetupScreen onDone={(u, b) => { 
    setUserName(u); setBabyName(b); 
    localStorage.setItem("baby_username", u); 
    setSetup(false); 
  }} />;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { background-color: ${C.bg}; }
      `}</style>

      {/* ── Header אטרקטיבי ── */}
      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div style={S.babyBadge}>{babyName}</div>
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} now={now} />}
        {tab === "history" && <WeeklySummary events={events} />}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 סיכום שבועי</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Home View ──────────────────────────────────────────────────────────────
function HomeView({ events, setModal, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  const lastDiaper = events.find(e => e.type === "diaper");

  // חלוקת אירועים לטורים (רק של היום)
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feedEvents = events.filter(e => e.type === "feed" && isToday(e.ts)).slice(0, 5);
  const diaperEvents = events.filter(e => e.type === "diaper" && isToday(e.ts)).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* סטריפ זמנים */}
      <div style={S.statusStrip}>
        <div style={S.statusItem}>🍼 אכלה לפני: <b>{lastFeed ? "1.5 ש׳" : "—"}</b></div>
        <div style={S.statusItem}>🧷 הוחלפה לפני: <b>{lastDiaper ? "40 דק׳" : "—"}</b></div>
      </div>

      {/* כפתורי פעולה */}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => setModal("feed")} style={{ ...S.actionBtn, background: "#fef3c7" }}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{ ...S.actionBtn, background: "#fce7f3" }}>🧷 החתלה</button>
      </div>

      {/* טבלת טורים (עדכונים אחרונים) */}
      <div style={S.card}>
        <div style={S.cardTitle}>עדכונים מהיום</div>
        <div style={{ display: "flex", gap: 10 }}>
          {/* טור אוכל */}
          <div style={S.column}>
            <div style={S.columnHeader}>🍼 אוכל</div>
            {feedEvents.map(e => (
              <div key={e.id} style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
                <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                <span style={S.eventDetail}>{e.ml} מ"ל</span>
              </div>
            ))}
          </div>

          {/* טור חיתול */}
          <div style={S.column}>
            <div style={S.columnHeader}>🧷 חיתול</div>
            {diaperEvents.map(e => (
              <div key={e.id} style={{ ...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft }}>
                <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                <span style={S.eventDetail}>{e.pee ? "💧" : ""}{e.poop ? "💩" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <WeeklySummary events={events} limit={3} />
    </div>
  );
}

// ── Weekly Summary Component ───────────────────────────────────────────────
function WeeklySummary({ events, limit = 7 }) {
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
      <div style={S.cardTitle}>סיכום ימים אחרונים</div>
      {sortedDays.map(day => (
        <div key={day.ts} style={S.summaryRow}>
          <div style={{ fontWeight: 800, width: 80 }}>{getDayName(day.ts)}</div>
          <div style={{ flex: 1 }}>🍼 {day.ml} מ"ל</div>
          <div style={{ flex: 1 }}>🧷 {day.diapers} חיתולים</div>
        </div>
      ))}
    </div>
  );
}

// ── Modals (Simplified for brevity) ────────────────────────────────────────
function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: 15 }}>כמה {localStorage.getItem("baby_name") || "התינוקת"} אכלה?</h3>
        <input type="number" value={ml} onChange={e => setMl(e.target.value)} placeholder="כמות במ״ל" style={S.input} />
        <button onClick={() => { onConfirm({ type: "feed", ml }); onClose(); }} style={S.primaryBtn}>שמור</button>
      </div>
    </div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ textAlign: "center", marginBottom: 15 }}>מה היה שם?</h3>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
          <button onClick={() => setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
        </div>
        <button onClick={() => { onConfirm({ type: "diaper", pee, poop }); onClose(); }} style={S.primaryBtn}>שמור</button>
      </div>
    </div>
  );
}

function SetupScreen({ onDone }) {
  const [u, setU] = useState("");
  const [b, setB] = useState("");
  return (
    <div style={{ ...S.center, height: "100vh", flexDirection: "column", gap: 20, padding: 20 }}>
      <h1>ברוכים הבאים 🍼</h1>
      <input placeholder="מי המשתמש? (אבא/אמא...)" value={u} onChange={e => setU(e.target.value)} style={S.input} />
      <input placeholder="שם התינוקת" value={b} onChange={e => setB(e.target.value)} style={S.input} />
      <button onClick={() => onDone(u, b)} style={S.primaryBtn}>בואו נתחיל</button>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: FONT_MAIN, direction: "rtl", minHeight: "100vh", maxWidth: 480, margin: "0 auto", color: C.text },
  headerContainer: { 
    background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, 
    padding: "30px 20px", 
    borderRadius: "0 0 40px 40px", 
    textAlign: "center",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
  },
  greeting: { fontSize: 16, color: "white", fontWeight: 600, marginBottom: 5 },
  babyBadge: { fontSize: 32, fontFamily: FONT_KIDS, color: "white", fontWeight: 800, textShadow: "2px 2px 4px rgba(0,0,0,0.2)" },
  content: { padding: "20px 15px 100px" },
  statusStrip: { display: "flex", justifyContent: "space-between", background: "white", padding: "12px", borderRadius: "15px", border: `1px solid ${C.border}` },
  statusItem: { fontSize: 13 },
  actionBtn: { flex: 1, border: "none", padding: "20px", borderRadius: "20px", fontSize: 18, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" },
  card: { background: "white", borderRadius: "25px", padding: "20px", border: `1px solid ${C.border}`, marginBottom: 15 },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 14, marginBottom: 5, padding: "5px", background: C.bg, borderRadius: "10px" },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px", borderRadius: "12px", border: "1px solid #eee" },
  eventTime: { fontSize: 12, fontWeight: 800 },
  eventDetail: { fontSize: 14 },
  summaryRow: { display: "flex", padding: "10px 0", borderBottom: "1px solid #f0f0f0", fontSize: 14 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "white", display: "flex", borderTop: `1px solid ${C.border}`, padding: "10px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "15px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  input: { width: "100%", padding: "15px", borderRadius: "15px", border: `1px solid ${C.border}`, marginBottom: 10, fontSize: 16 },
  primaryBtn: { width: "100%", padding: "15px", borderRadius: "15px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 16 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "white", padding: "25px", borderRadius: "25px", width: "100%", maxWidth: 350 },
  chip: (active) => ({ flex: 1, padding: "15px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700 }),
  center: { display: "flex", alignItems: "center", justifyContent: "center" }
};
