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
  accent: "#f4a58a",       // אפרסקה
  accentDark: "#e8845e",
  pink: "#f9b8c4",         // ורוד
  pinkDark: "#e8899a",
  lavender: "#c9b8e8",     // סגול פסטלי
  mint: "#a8d8c8",         // ירוק מנטה
  yellow: "#f9e4a0",       // צהוב חמאה
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

  // Load global state once
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
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    loadState();
  }, []);

  // Real-time listener for global state (sleep/feed across users)
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

  // Real-time events
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
const clean = Object.fromEntries(Object.entries({ ts: Date.now(), user: userName, ...ev }).filter(([_, v]) => v !== undefined));
await addDoc(collection(db, "events"), clean);
  const addEvent = useCallback(async (ev) => {

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
  const todaySleepMs = todayEvents.filter(e => e.type === "sleep_end" && e.duration)
    .reduce((s, e) => s + e.duration, 0);
  const todayMl = todayEvents.filter(e => e.type === "feed" && e.ml)
    .reduce((s, e) => s + Number(e.ml || 0), 0);

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        input, textarea, button { font-family: 'Heebo', sans-serif; }
        button:active { opacity: 0.75; }
      `}</style>

      {/* Header */}
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

      {/* Content */}
      <div style={S.content}>
        {tab === "home" && (
          <HomeTab
            events={events} lastFeed={lastFeed} lastDiaper={lastDiaper}
            sleeping={sleeping} feeding={feeding} now={now}
            todaySleepMs={todaySleepMs} todayMl={todayMl}
            userName={userName} modal={modal} setModal={setModal}
            onStartSleep={async () => {
              const s = { ts: Date.now(), user: userName };
              await saveState({ sleeping: s });
              await addEvent({ type: "sleep_start" });
            }}
            onEndSleep={async () => {
              if (!sleeping) return;
              const dur = Date.now() - sleeping.ts;
              await addEvent({ type: "sleep_end", duration: dur });
              await saveState({ sleeping: null });
            }}
            onFeedConfirm={async (feedData) => {
              if (feedData.timed) {
                const f = { ts: Date.now(), user: userName, ...feedData };
                await saveState({ feeding: f });
                await addEvent({ type: "feed_start", feedType: feedData.feedType, side: feedData.side });
              } else {
                await addEvent({ type: "feed", ...feedData });
              }
              setModal(null);
            }}
            onEndFeed={async () => {
              if (!feeding) return;
              const dur = Date.now() - feeding.ts;
              await addEvent({ type: "feed", feedType: feeding.feedType, side: feeding.side, ml: feeding.ml, duration: dur });
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
          />
        )}
        {tab === "history" && <HistoryTab events={events} onDelete={deleteEvent} now={now} />}
        {tab === "stats" && <StatsTab events={events} now={now} />}
      </div>

      {/* Bottom nav */}
      <div style={S.nav}>
        {[
          { id: "home", icon: "🏠", label: "בית" },
          { id: "history", icon: "📋", label: "היסטוריה" },
          { id: "stats", icon: "📊", label: "תובנות" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.navBtn(tab === t.id)}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: tab === t.id ? C.accentDark : C.muted }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────
function SetupScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [uname, setUname] = useState("");
  const [bname, setBname] = useState("");
  return (
    <div style={{ ...S.center, background: C.bg, height: "100vh", flexDirection: "column", gap: 20, padding: 32, fontFamily: "'Heebo', sans-serif", direction: "rtl" }}>
      <style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;800&display=swap');</style>
      <div style={{ fontSize: 64 }}>👶</div>
      {step === 0 ? (
        <>
          <div style={{ color: C.text, fontSize: 24, fontWeight: 800 }}>ברוכים הבאים!</div>
          <div style={{ color: C.textSoft, fontSize: 15 }}>מי את/ה?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {USERS.map(u => (
              <button key={u} onClick={() => { setUname(u); setStep(1); }}
                style={{ ...S.chip(false), padding: "12px 22px", fontSize: 15 }}>{u}</button>
            ))}
          </div>
          <input value={uname} onChange={e => setUname(e.target.value)} placeholder="שם אחר..."
            style={{ ...S.input, width: 200, textAlign: "center" }} />
          {uname && <button onClick={() => setStep(1)} style={S.primaryBtn}>המשך →</button>}
        </>
      ) : (
        <>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>מה שמה של התינוקת?</div>
          <input value={bname} onChange={e => setBname(e.target.value)} placeholder="שם..."
            style={{ ...S.input, width: 220, textAlign: "center", fontSize: 18 }} />
          <button onClick={() => onDone(uname, bname || "התינוקת")} style={S.primaryBtn}>
            🍼 בואו נתחיל!
          </button>
        </>
      )}
    </div>
  );
}

// ── Home Tab ───────────────────────────────────────────────────────────────
function HomeTab({ events, lastFeed, lastDiaper, sleeping, feeding, now, todaySleepMs, todayMl, modal, setModal, onStartSleep, onEndSleep, onFeedConfirm, onEndFeed, onDiaperConfirm, onNoteConfirm }) {
  const sinceLastFeed = lastFeed ? now - lastFeed.ts : null;
  const sinceLastDiaper = lastDiaper ? now - lastDiaper.ts : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Status */}
      <div style={S.card}>
        <div style={S.cardTitle}>📍 מצב עכשיו</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Stat label="ארוחה אחרונה" value={lastFeed ? sinceStr(lastFeed.ts) : "—"} warn={sinceLastFeed && sinceLastFeed > 3 * 3600000} color={C.accent} />
          <Stat label="חיתול אחרון" value={lastDiaper ? sinceStr(lastDiaper.ts) : "—"} warn={sinceLastDiaper && sinceLastDiaper > 4 * 3600000} color={C.pink} />
          <Stat label="שינה היום" value={todaySleepMs ? elapsed(todaySleepMs) : "—"} color={C.lavender} />
          <Stat label="נוזלים היום" value={todayMl ? `${todayMl} מ"ל` : "—"} color={C.mint} />
        </div>
      </div>

      {/* Actions */}
      <div style={S.card}>
        <div style={S.cardTitle}>⚡ פעולה מהירה</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {feeding
            ? <BigBtn icon="🍼" label="סיים האכלה" sub={elapsed(now - feeding.ts)} color={C.mint} onClick={onEndFeed} />
            : <BigBtn icon="🍼" label="האכלה" sub="לחץ להתחיל" color={C.accent} onClick={() => setModal("feed")} />}
          {sleeping
            ? <BigBtn icon="☀️" label="קמה!" sub={elapsed(now - sleeping.ts)} color={C.yellow} onClick={onEndSleep} />
            : <BigBtn icon="😴" label="הלכה לישון" sub="לחץ לתיעוד" color={C.lavender} onClick={onStartSleep} />}
          <BigBtn icon="🧷" label="חיתול" sub="פיפי / קקי" color={C.pink} onClick={() => setModal("diaper")} />
          <BigBtn icon="📝" label="הערה" sub="אירוע חופשי" color={C.yellow} onClick={() => setModal("note")} />
        </div>
      </div>

      {/* Recent */}
      <div style={S.card}>
        <div style={S.cardTitle}>⏱ אחרונים</div>
        {events.slice(0, 6).map(e => <EventRow key={e.id} ev={e} now={now} />)}
        {events.length === 0 && (
          <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 14 }}>
            עוד אין אירועים — בואו נתחיל! 🍼
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === "feed" && <FeedModal onConfirm={onFeedConfirm} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={onDiaperConfirm} onClose={() => setModal(null)} />}
      {modal === "note" && <NoteModal onConfirm={onNoteConfirm} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────
function HistoryTab({ events, onDelete, now }) {
  const days = groupByDay(events);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {days.map(day => (
        <div key={day.label}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 700 }}>{day.label}</div>
          <div style={S.card}>
            {day.events.map(e => <EventRow key={e.id} ev={e} now={now} onDelete={() => onDelete(e.id)} />)}
          </div>
        </div>
      ))}
      {days.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 32 }}>אין היסטוריה עדיין</div>}
    </div>
  );
}

// ── Stats Tab ──────────────────────────────────────────────────────────────
function StatsTab({ events, now }) {
  const last7 = events.filter(e => now - e.ts < 7 * 86400000);
  const feeds = last7.filter(e => e.type === "feed").sort((a, b) => a.ts - b.ts);
  let avgGap = null;
  if (feeds.length > 1) {
    const gaps = feeds.slice(1).map((f, i) => f.ts - feeds[i].ts).filter(g => g < 6 * 3600000);
    if (gaps.length) avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  }
  const sleeps = last7.filter(e => e.type === "sleep_end" && e.duration);
  const avgSleep = sleeps.length ? sleeps.reduce((s, e) => s + e.duration, 0) / sleeps.length : null;
  const totalSleep24 = events.filter(e => e.type === "sleep_end" && e.duration && now - e.ts < 86400000).reduce((s, e) => s + e.duration, 0);
  const diapersToday = events.filter(e => e.type === "diaper" && now - e.ts < 86400000);
  const mlFeeds = last7.filter(e => e.type === "feed" && e.ml);
  const avgMl = mlFeeds.length ? mlFeeds.reduce((s, e) => s + Number(e.ml), 0) / mlFeeds.length : null;
  const hourCounts = Array(24).fill(0);
  feeds.forEach(f => { hourCounts[new Date(f.ts).getHours()]++; });
  const maxHour = Math.max(...hourCounts, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>📊 7 ימים אחרונים</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <StatCard label="ממוצע בין ארוחות" value={avgGap ? elapsed(avgGap) : "—"} color={C.accent} />
          <StatCard label="ממוצע תנומה" value={avgSleep ? elapsed(avgSleep) : "—"} color={C.lavender} />
          <StatCard label="שינה ב-24ש'" value={totalSleep24 ? elapsed(totalSleep24) : "—"} color={C.mint} />
          <StatCard label="ממוצע לארוחה" value={avgMl ? `${Math.round(avgMl)} מ"ל` : "—"} color={C.yellow} />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>🍼 האכלות לפי שעה</div>
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 60 }}>
          {hourCounts.map((c, h) => (
            <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "100%", borderRadius: 3, height: Math.max(3, (c / maxHour) * 52), background: c > 0 ? C.accent : C.border }} />
              {h % 6 === 0 && <div style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>{h}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>🧷 חיתולים היום</div>
        <div style={{ display: "flex", gap: 10 }}>
          <StatCard label="💧 פיפי" value={diapersToday.filter(e => e.pee).length} color={C.mint} />
          <StatCard label="💩 קקי" value={diapersToday.filter(e => e.poop).length} color={C.yellow} />
          <StatCard label="סה״כ" value={diapersToday.length} color={C.accent} />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>💡 תובנות</div>
        {avgGap && <Insight icon="🍼" text={`בדרך כלל רעבה כל ${elapsed(avgGap)}`} />}
        {avgSleep && <Insight icon="😴" text={`ממוצע תנומה: ${elapsed(avgSleep)}`} />}
        {avgMl && <Insight icon="📈" text={`שותה בממוצע ${Math.round(avgMl)} מ"ל לארוחה`} />}
        {feeds.length < 3 && <Insight icon="⏳" text="צריך עוד נתונים לתובנות" />}
      </div>
    </div>
  );
}

// ── Event Row ──────────────────────────────────────────────────────────────
function EventRow({ ev, now, onDelete }) {
  const icons = { feed: "🍼", feed_start: "🍼", sleep_start: "😴", sleep_end: "☀️", diaper: "🧷", note: "📝" };
  const labels = { feed: "האכלה", feed_start: "התחלת האכלה", sleep_start: "הלכה לישון", sleep_end: "קמה", diaper: "חיתול", note: "הערה" };
  let detail = "";
  if (ev.type === "feed") {
    if (ev.ml) detail += `${ev.ml} מ"ל `;
    if (ev.side) detail += `(${ev.side}) `;
    if (ev.duration) detail += `• ${elapsed(ev.duration)}`;
  }
  if (ev.type === "diaper") {
    const parts = [];
    if (ev.pee) parts.push("💧פיפי");
    if (ev.poop) parts.push("💩קקי");
    if (ev.color) parts.push(ev.color);
    detail = parts.join(" ");
  }
  if (ev.type === "sleep_end" && ev.duration) detail = elapsed(ev.duration);
  if (ev.note) detail = ev.note;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 20 }}>{icons[ev.type] || "•"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{labels[ev.type] || ev.type}</div>
        {detail && <div style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>{detail}</div>}
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 12, color: C.muted }}>{fmt(ev.ts)}</div>
        {ev.user && <div style={{ fontSize: 10, color: C.border }}>{ev.user}</div>}
      </div>
      {onDelete && (
        <button onClick={onDelete} style={{ background: "none", border: "none", color: C.muted, fontSize: 15, padding: 4, cursor: "pointer" }}>🗑</button>
      )}
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────
function FeedModal({ onConfirm, onClose }) {
  const [feedType, setFeedType] = useState("bottle");
  const [ml, setMl] = useState("");
  const [side, setSide] = useState("");
  const [timed, setTimed] = useState(false);
  return (
    <Modal title="🍼 האכלה" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["bottle", "breast"].map(t => (
          <button key={t} onClick={() => setFeedType(t)} style={{ ...S.chip(feedType === t), flex: 1 }}>
            {t === "bottle" ? "🍼 בקבוק" : "🤱 הנקה"}
          </button>
        ))}
      </div>
      {feedType === "bottle" && (
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>כמות (מ"ל)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[60, 80, 90, 100, 120, 150].map(v => (
              <button key={v} onClick={() => setMl(v)} style={S.chip(ml == v)}>{v}</button>
            ))}
            <input value={ml} onChange={e => setMl(e.target.value)} placeholder="אחר..." style={{ ...S.input, width: 70 }} />
          </div>
        </div>
      )}
      {feedType === "breast" && (
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>צד</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["שמאל", "ימין", "שניהם"].map(s => (
              <button key={s} onClick={() => setSide(s)} style={S.chip(side === s)}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} id="timed" />
        <label htmlFor="timed" style={{ color: C.textSoft, fontSize: 13 }}>⏱ טיימר — אני מתחיל עכשיו</label>
      </div>
      <button onClick={() => onConfirm({ feedType, ml: ml || undefined, side: side || undefined, timed })} style={S.primaryBtn}>
        {timed ? "▶ התחל טיימר" : "✅ שמור"}
      </button>
    </Modal>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [color, setColor] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title="🧷 חיתול" onClose={onClose}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button onClick={() => setPee(!pee)} style={{ ...S.chip(pee), flex: 1 }}>💧 פיפי</button>
        <button onClick={() => setPoop(!poop)} style={{ ...S.chip(poop), flex: 1 }}>💩 קקי</button>
      </div>
      {poop && (
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>צבע (אופציונלי)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["צהוב", "ירוק", "חום", "שחור", "אחר"].map(c => (
              <button key={c} onClick={() => setColor(c)} style={S.chip(color === c)}>{c}</button>
            ))}
          </div>
        </div>
      )}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="הערה..."
        style={{ ...S.input, marginBottom: 16 }} />
      <button onClick={() => onConfirm({ pee, poop, color: color || undefined, note: note || undefined })}
        style={S.primaryBtn} disabled={!pee && !poop}>✅ שמור</button>
    </Modal>
  );
}

function NoteModal({ onConfirm, onClose }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  return (
    <Modal title="📝 הערה" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {["חיסון", "תרופה", "רופא", "חסרת שקט", "חולה", "אחר"].map(t => (
          <button key={t} onClick={() => setTag(t)} style={S.chip(tag === t)}>{t}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="כתוב הערה..."
        style={{ ...S.input, height: 80, resize: "none", width: "100%", marginBottom: 16 }} />
      <button onClick={() => onConfirm({ note: text, tag: tag || undefined })}
        style={S.primaryBtn} disabled={!text && !tag}>✅ שמור</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Small Components ───────────────────────────────────────────────────────
function Stat({ label, value, warn, color }) {
  return (
    <div style={{ background: warn ? "#fff0f0" : C.bg, borderRadius: 12, padding: "10px 14px", flex: "1 1 110px", border: `1.5px solid ${warn ? "#ffcccc" : C.border}` }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: warn ? "#e05555" : C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: color + "30", borderRadius: 12, padding: "10px 14px", flex: "1 1 90px", border: `1.5px solid ${color}60` }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function BigBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: color + "30", border: `2px solid ${color}80`,
      borderRadius: 18, padding: "16px 10px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      cursor: "pointer", boxShadow: `0 2px 8px ${color}20`,
    }}>
      <span style={{ fontSize: 30 }}>{icon}</span>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{label}</div>
      <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>
    </button>
  );
}

function Insight({ icon, text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 13, color: C.textSoft }}>{text}</span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Heebo', sans-serif", direction: "rtl", color: C.text, maxWidth: 480, margin: "0 auto" },
  header: { background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, boxShadow: `0 2px 8px ${C.shadow}` },
  content: { flex: 1, padding: "14px 14px 85px", overflowY: "auto" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0", boxShadow: `0 -2px 8px ${C.shadow}` },
  navBtn: (active) => ({ background: active ? C.accent + "20" : "none", border: "none", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 20px", cursor: "pointer" }),
  card: { background: C.white, borderRadius: 18, padding: "16px", border: `1px solid ${C.border}`, boxShadow: `0 2px 8px ${C.shadow}` },
  cardTitle: { fontSize: 13, color: C.muted, marginBottom: 12, fontWeight: 600 },
  overlay: { position: "fixed", inset: 0, background: "rgba(92,61,46,0.2)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: C.white, borderRadius: "24px 24px 0 0", padding: "22px 18px", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", border: `1px solid ${C.border}`, boxShadow: `0 -4px 20px ${C.shadow}` },
  input: { background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "9px 14px", color: C.text, fontSize: 14, outline: "none", width: "100%" },
  label: { display: "block", fontSize: 12, color: C.muted, marginBottom: 8, fontWeight: 600 },
  chip: (active) => ({ background: active ? C.accent + "30" : C.bg, border: `1.5px solid ${active ? C.accentDark : C.border}`, color: active ? C.accentDark : C.textSoft, borderRadius: 10, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  primaryBtn: { background: C.accent, color: C.white, border: "none", borderRadius: 14, padding: "13px 24px", fontSize: 15, fontWeight: 700, width: "100%", cursor: "pointer", boxShadow: `0 3px 10px ${C.accent}50` },
  badge: (bg, color) => ({ background: bg + "60", border: `1px solid ${bg}`, color, borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }),
  center: { display: "flex", alignItems: "center", justifyContent: "center" },
};
