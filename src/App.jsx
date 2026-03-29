import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, setDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Pastel Palette ─────────────────────────────────────────────────────────
const C = {
  bg: "#fdf6f0",
  surface: "#ffffff",
  card: "#fff9f5",
  border: "#f0d9cc",
  accent: "#f4a58a",
  accentDark: "#e8845e",
  pink: "#f9b8c4",
  pinkDark: "#e8899a",
  lavender: "#c9b8e8",
  mint: "#a8d8c8",
  yellow: "#f9e4a0",
  muted: "#b0998a",
  text: "#5c3d2e",
  textSoft: "#9c7b6a",
  white: "#ffffff",
  shadow: "rgba(244,165,138,0.15)",
};

const USERS = ["אמא", "אבא", "סבתא", "אחר"];

// ── Utilities ──────────────────────────────────────────────────────────────
function fmt(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
}
function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} דק'`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}ש' ${rm}ד'` : `${h}ש'`;
}
function sinceStr(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק'`;
  const h = Math.floor(m / 60);
  return `לפני ${h}ש'${m % 60 ? " " + (m % 60) + "ד'" : ""}`;
}
function groupByDay(events) {
  const days = {};
  events.forEach(e => {
    const d = new Date(e.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!days[key]) days[key] = { label: fmtDate(e.ts), events: [] };
    days[key].events.push(e);
  });
  return Object.values(days);
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("home");
  const [userName, setUserName] = useState(() => localStorage.getItem("baby_username") || "");
  const [babyName, setBabyName] = useState("התינוקת");
  const [setup, setSetup] = useState(!localStorage.getItem("baby_username"));
  const [sleeping, setSleeping] = useState(null);
  const [feeding, setFeeding] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function loadState() {
      try {
        const snap = await getDoc(doc(db, "state", "global"));
        if (snap.exists()) {
          const d = snap.data();
          if (d.sleeping) setSleeping(d.sleeping);
          if (d.feeding) setFeeding(d.feeding);
          if (d.babyName) setBabyName(d.babyName);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    loadState();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "state", "global"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setSleeping(d.sleeping || null);
        setFeeding(d.feeding || null);
        if (d.babyName) setBabyName(d.babyName);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const saveState = useCallback(async (patch) => {
    await setDoc(doc(db, "state", "global"), patch, { merge: true });
  }, []);

  const addEvent = useCallback(async (ev) => {
    await addDoc(collection(db, "events"), { ts: Date.now(), user: userName, ...ev });
  }, [userName]);

  const deleteEvent = useCallback(async (id) => {
    await deleteDoc(doc(db, "events", id));
  }, []);

  if (loading) return (
    <div style={{ ...S.center, background: C.bg, height: "100vh", flexDirection: "column", gap: 16, fontFamily: "'Heebo', sans-serif" }}>
      <div style={{ fontSize: 56 }}>🍼</div>
      <div style={{ color: C.textSoft, fontSize: 15 }}>טוען...</div>
    </div>
  );

  if (setup) return (
    <SetupScreen onDone={async (uname, bname) => {
      setUserName(uname);
      setBabyName(bname);
      localStorage.setItem("baby_username", uname);
      await saveState({ babyName: bname });
      setSetup(false);
    }} />
  );

  const lastFeed = events.find(e => e.type === "feed");
  const lastDiaper = events.find(e => e.type === "diaper");
  const todayEvents = events.filter(e => {
    const d = new Date(e.ts), t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth();
  });
  const todaySleepMs = todayEvents.filter(e => e.type === "sleep_end" && e.duration).reduce((s, e) => s + e.duration, 0);
  const todayMl = todayEvents.filter(e => e.type === "feed" && e.ml).reduce((s, e) => s + Number(e.ml || 0), 0);

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, button { font-family: 'Heebo', sans-serif; }
      `}</style>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>👶</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{babyName}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{userName}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {sleeping && <div style={S.badge(C.lavender, C.text)}>😴 {elapsed(now - sleeping.ts)}</div>}
          {feeding && <div style={S.badge(C.mint, C.text)}>🍼 {elapsed(now - feeding.ts)}</div>}
        </div>
      </div>
      <div style={S.content}>
        {tab === "home" && (
          <HomeTab
            events={events} lastFeed={lastFeed} lastDiaper={lastDiaper}
            sleeping={sleeping} feeding={feeding} now={now}
            todaySleepMs={todaySleepMs} todayMl={todayMl}
            userName={userName} modal={modal} setModal={setModal}
            onStartSleep={async () => {
              await saveState({ sleeping: { ts: Date.now(), user: userName } });
              await addEvent({ type: "sleep_start" });
            }}
            onEndSleep={async () => {
              if (!sleeping) return;
              await addEvent({ type: "sleep_end", duration: Date.now() - sleeping.ts });
              await saveState({ sleeping: null });
            }}
            onFeedConfirm={async (fd) => {
              if (fd.timed) {
                await saveState({ feeding: { ts: Date.now(), user: userName, ...fd } });
                await addEvent({ type: "feed_start", ...fd });
              } else { await addEvent({ type: "feed", ...fd }); }
              setModal(null);
            }}
            onEndFeed={async () => {
              if (!feeding) return;
              await addEvent({ type: "feed", ...feeding, duration: Date.now() - feeding.ts });
              await saveState({ feeding: null });
            }}
            onDiaperConfirm={async (data) => {
              const clean = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
              await addEvent({ type: "diaper", ...clean });
              setModal(null);
            }}
            onNoteConfirm={async (data) => {
              await addEvent({ type: "note", ...data });
              setModal(null);
            }}
          />
        )}
        {tab === "history" && <HistoryTab events={events} onDelete={deleteEvent} now={now} />}
        {tab === "stats" && <StatsTab events={events} now={now} />}
      </div>
      <div style={S.nav}>
        {[{ id: "home", icon: "🏠", label: "בית" }, { id: "history", icon: "📋", label: "היסטוריה" }, { id: "stats", icon: "📊", label: "תובנות" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.navBtn(tab === t.id)}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: tab === t.id ? C.accentDark : C.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Setup Screen ───────────────────────────────────────────────────────────
function SetupScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [uname, setUname] = useState("");
  const [bname, setBname] = useState("");
  return (
    <div style={{ ...S.center, background: C.bg, height: "100vh", flexDirection: "column", gap: 20, padding: 32, fontFamily: "'Heebo', sans-serif", direction: "rtl" }}>
      <div style={{ fontSize: 64 }}>👶</div>
      {step === 0 ? (
        <>
          <div style={{ color: C.text, fontSize: 24, fontWeight: 800 }}>ברוכים הבאים!</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {USERS.map(u => <button key={u} onClick={() => { setUname(u); setStep(1); }} style={S.chip(false)}>{u}</button>)}
          </div>
        </>
      ) : (
        <>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>מה שמה של התינוקת?</div>
          <input value={bname} onChange={e => setBname(e.target.value)} placeholder="שם..." style={S.input} />
          <button onClick={() => onDone(uname, bname || "התינוקת")} style={S.primaryBtn}>בואו נתחיל!</button>
        </>
      )}
    </div>
  );
}

// ── Tabs & Modals (Simplified for fix) ─────────────────────────────────────
function HomeTab({ events, lastFeed, lastDiaper, sleeping, feeding, now, todaySleepMs, todayMl, modal, setModal, onStartSleep, onEndSleep, onFeedConfirm, onEndFeed, onDiaperConfirm, onNoteConfirm }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>📍 מצב עכשיו</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Stat label="ארוחה אחרונה" value={lastFeed ? sinceStr(lastFeed.ts) : "—"} color={C.accent} />
          <Stat label="חיתול אחרון" value={lastDiaper ? sinceStr(lastDiaper.ts) : "—"} color={C.pink} />
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>⚡ פעולה מהירה</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <BigBtn icon="🍼" label={feeding ? "סיים האכלה" : "האכלה"} color={C.accent} onClick={() => feeding ? onEndFeed() : setModal("feed")} />
          <BigBtn icon={sleeping ? "☀️" : "😴"} label={sleeping ? "קמה!" : "לישון"} color={C.lavender} onClick={() => sleeping ? onEndSleep() : onStartSleep()} />
          <BigBtn icon="🧷" label="חיתול" color={C.pink} onClick={() => setModal("diaper")} />
          <BigBtn icon="📝" label="הערה" color={C.yellow} onClick={() => setModal("note")} />
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>⏱ אחרונים</div>
        {events.slice(0, 5).map(e => <EventRow key={e.id} ev={e} />)}
      </div>
      {modal === "feed" && <FeedModal onConfirm={onFeedConfirm} onClose={() => setModal
