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
    if (window.confirm("בטוח שרוצה למחוק את האירוע?")) {
      await deleteDoc(doc(db, "events", id));
    }
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
              await addEvent({ type: "feed", ...fd });
              setModal(null);
            }}
            onEndFeed={async () => {
              if (!feeding) return;
              await addEvent({ type: "feed", ...feeding, duration: Date.now() - feeding.ts });
              await saveState({ feeding: null });
            }}
            onDiaperConfirm={async (data) => {
              await addEvent({ type: "diaper", ...data });
              setModal(null);
            }}
            onNoteConfirm={async (data) => {
              await addEvent({ type: "note", ...data });
              setModal(null);
            }}
            onDelete={deleteEvent}
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

// ── Components ─────────────────────────────────────────────────────────────
function HomeTab({ events, lastFeed, lastDiaper, sleeping, feeding, now, todaySleepMs, todayMl, modal, setModal, onStartSleep, onEndSleep, onFeedConfirm, onEndFeed, onDiaperConfirm, onNoteConfirm, onDelete }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>📍 מצב עכשיו</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Stat label="ארוחה אחרונה" value={lastFeed ? sinceStr(lastFeed.ts) : "—"} color={C.accent} />
          <Stat label="חיתול אחרון" value={lastDiaper ? sinceStr(lastDiaper.ts) : "—"} color={C.pink} />
          <Stat label="שינה היום" value={todaySleepMs ? elapsed(todaySleepMs) : "—"} color={C.lavender} />
          <Stat label="נוזלים היום" value={todayMl ? `${todayMl} מ"ל` : "—"} color={C.mint} />
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>⚡ פעולה מהירה</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <BigBtn icon="🍼" label={feeding ? "סיים האכלה" : "האכלה"} sub={feeding ? elapsed(now - feeding.ts) : "לחץ להתחיל"} color={C.accent} onClick={() => feeding ? onEndFeed() : setModal("feed")} />
          <BigBtn icon={sleeping ? "☀️" : "😴"} label={sleeping ? "קמה!" : "לישון"} sub={sleeping ? elapsed(now - sleeping.ts) : "לחץ לתיעוד"} color={C.lavender} onClick={() => sleeping ? onEndSleep() : onStartSleep()} />
          <BigBtn icon="🧷" label="חיתול" sub="פיפי / קקי" color={C.pink} onClick={() => setModal("diaper")} />
          <BigBtn icon="📝" label="הערה" sub="אירוע חופשי" color={C.yellow} onClick={() => setModal("note")} />
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>⏱ אחרונים</div>
        {events.slice(0, 8).map((e, idx) => (
          <EventRow key={e.id} ev={e} allEvents={events} index={idx} onDelete={() => onDelete(e.id)} />
        ))}
      </div>
      {modal === "feed" && <FeedModal onConfirm={onFeedConfirm} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={onDiaperConfirm} onClose={() => setModal(null)} />}
      {modal === "note" && <NoteModal onConfirm={onNoteConfirm} onClose={() => setModal(null)} />}
    </div>
  );
}

function HistoryTab({ events, onDelete, now }) {
  const days = groupByDay(events);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {days.map(d => (
        <div key={d.label}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, paddingRight: 5 }}>{d.label}</div>
          <div style={S.card}>
            {d.events.map((e, idx) => (
              <EventRow key={e.id} ev={e} allEvents={events} index={events.indexOf(e)} onDelete={() => onDelete(e.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsTab({ events, now }) {
  const last24 = events.filter(e => now - e.ts < 86400000);
  return (
    <div style={S.card}>
      <div style={S.cardTitle}>📊 סיכום 24 שעות</div>
      <div style={{ display: "flex", gap: 10 }}>
        <Stat label="האכלות" value={last24.filter(e => e.type === "feed").length} />
        <Stat label="חיתולים" value={last24.filter(e => e.type === "diaper").length} />
      </div>
    </div>
  );
}

function EventRow({ ev, allEvents, index, onDelete }) {
  const icons = { feed: "🍼", feed_start: "🍼", sleep_start: "😴", sleep_end: "☀️", diaper: "🧷", note: "📝" };
  
  // לוגיקת חישוב מרווח האכלה
  let interval = null;
  if (ev.type === "feed") {
    const prevFeed = allEvents.slice(index + 1).find(p => p.type === "feed");
    if (prevFeed) {
      interval = elapsed(ev.ts - prevFeed.ts);
    }
  }

  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}`, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {icons[ev.type]} {fmt(ev.ts)} 
            {ev.ml && <span style={{ marginRight: 8, color: C.accentDark }}>{ev.ml} מ"ל</span>}
          </div>
          {interval && <div style={{ fontSize: 11, color: C.accentDark, fontWeight: 600 }}>⏱ מרווח: {interval}</div>}
          {ev.type === "diaper" && <div style={{ fontSize: 11, color: C.muted }}>{ev.pee ? "פיפי " : ""}{ev.poop ? "קקי" : ""}</div>}
          {ev.note && <div style={{ fontSize: 12, color: C.textSoft, marginTop: 2, fontStyle: "italic" }}>"{ev.note}"</div>}
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", opacity: 0.4 }}>🗑️</button>
      </div>
    </div>
  );
}

function SetupScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [uname, setUname] = useState("");
  const [bname, setBname] = useState("");
  return (
    <div style={{ ...S.center, background: C.bg, height: "100vh", flexDirection: "column", gap: 20, padding: 32, direction: "rtl" }}>
      <div style={{ fontSize: 64 }}>👶</div>
      {step === 0 ? (
        <>
          <div style={{ color: C.text, fontSize: 24, fontWeight: 800 }}>מי את/ה?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {USERS.map(u => <button key={u} onClick={() => { setUname(u); setStep(1); }} style={S.chip(false)}>{u}</button>)}
          </div>
        </>
      ) : (
        <>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>שם התינוקת?</div>
          <input value={bname} onChange={e => setBname(e.target.value)} placeholder="שם..." style={S.input} />
          <button onClick={() => onDone(uname, bname || "התינוקת")} style={S.primaryBtn}>בואו נתחיל!</button>
        </>
      )}
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("90");
  const [note, setNote] = useState("");
  return (
    <Modal title="🍼 האכלה" onClose={onClose}>
      <div style={{ marginBottom: 10 }}>כמות (מ"ל):</div>
      <input type="number" value={ml} onChange={e => setMl(e.target.value)} style={S.input} />
      <div style={{ marginBottom: 10 }}>הערה:</div>
      <input value={note} onChange={e => setNote(e.target.value)} style={S.input} placeholder="אופציונלי..." />
      <button onClick={() => onConfirm({ type: "feed", ml, note })} style={S.primaryBtn}>שמור ארוחה</button>
    </Modal>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  return (
    <Modal title="🧷 חיתול" onClose={onClose}>
      <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
        <button onClick={() => setPee(!pee)} style={S.chip(pee)}>פיפי</button>
        <button onClick={() => setPoop(!poop)} style={S.chip(poop)}>קקי</button>
      </div>
      <button onClick={() => onConfirm({ type: "diaper", pee, poop })} style={S.primaryBtn}>שמור</button>
    </Modal>
  );
}

function NoteModal({ onConfirm, onClose }) {
  const [note, setNote] = useState("");
  return (
    <Modal title="📝 הערה" onClose={onClose}>
      <textarea value={note} onChange={e => setNote(e.target.value)} style={{ ...S.input, height: 80 }} />
      <button onClick={() => onConfirm({ type: "note", note })} style={S.primaryBtn}>שמור</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ flex: "1 1 40%", minWidth: 80 }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
  );
}

function BigBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: color + "20", border: `1px solid ${color}60`, borderRadius: 18, padding: "12px 8px", cursor: "pointer", textAlign: "center", transition: "transform 0.1s" }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{label}</div>
      <div style={{ fontSize: 9, color: C.muted }}>{sub}</div>
    </button>
  );
}

const S = {
  app: { background: C.bg, minHeight: "100vh", direction: "rtl", maxWidth: 480, margin: "0 auto", fontFamily: "Heebo" },
  header: { background: C.white, padding: "12px 15px", display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 10 },
  content: { padding: 15, paddingBottom: 85 },
  card: { background: C.white, borderRadius: 18, padding: 15, marginBottom: 15, border: `1px solid ${C.border}`, boxShadow: `0 2px 8px ${C.shadow}` },
  cardTitle: { fontSize: 11, color: C.muted, marginBottom: 12, fontWeight: 600, letterSpacing: 0.5 },
  nav: { position: "fixed", bottom: 0, width: "100%", maxWidth: 480, background: C.white, display: "flex", justifyContent: "space-around", padding: "8px 0", borderTop: `1px solid ${C.border}`, zIndex: 10 },
  navBtn: (active) => ({ background: "none", border: "none", padding: "5px 15px", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }),
  primaryBtn: { background: C.accent, color: C.white, border: "none", padding: 14, borderRadius: 14, width: "100%", fontWeight: 700, cursor: "pointer", fontSize: 16 },
  input: { width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 15, background: C.bg, fontSize: 16 },
  chip: (a) => ({ background: a ? C.accent : C.bg, color: a ? "white" : C.text, border: "none", padding: "10px 18px", borderRadius: 12, marginLeft: 8, fontWeight: 600, fontSize: 14 }),
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 },
  modal: { background: "white", padding: 20, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480 },
  center: { display: "flex", alignItems: "center", justifyContent: "center" },
  badge: (bg, c) => ({ background: bg, color: c, padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700 })
};
