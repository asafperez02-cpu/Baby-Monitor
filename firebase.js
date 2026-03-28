import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, setDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebaseConfig";
// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg: "#0d1117", surface: "#161b22", card: "#1c2230", border: "#2d3748",
  accent: "#7ee8a2", blue: "#60a5fa", purple: "#a78bfa",
  rose: "#fb7185", amber: "#fbbf24", muted: "#64748b",
  text: "#e2e8f0", textSoft: "#94a3b8",
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

  // Tick every 10s
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // Load shared state (sleeping/feeding/babyName) from Firestore
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
      } catch {}
      setLoading(false);
    }
    loadState();
  }, []);

  // Real-time events listener
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
    await addDoc(collection(db, "events"), {
      ts: Date.now(), user: userName, ...ev
    });
  }, [userName]);

  const deleteEvent = useCallback(async (id) => {
    await deleteDoc(doc(db, "events", id));
  }, []);

  if (loading) return (
    <div style={{ ...S.center, background: C.bg, height: "100vh", flexDirection: "column", gap: 16, fontFamily: "'Heebo', sans-serif" }}>
      <div style={{ fontSize: 48 }}>👶</div>
      <div style={{ color: C.textSoft }}>טוען...</div>
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
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>👶</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{babyName}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{userName}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {sleeping && <div style={S.badge("purple")}>😴 {elapsed(now - sleeping.ts)}</div>}
          {feeding && <div style={S.badge("blue")}>🍼 {elapsed(now - feeding.ts)}</div>}
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
              setSleeping(s);
              await saveState({ sleeping: s });
              await addEvent({ type: "sleep_start" });
            }}
            onEndSleep={async () => {
              if (!sleeping) return;
              const dur = Date.now() - sleeping.ts;
              await addEvent({ type: "sleep_end", duration: dur });
              setSleeping(null);
              await saveState({ sleeping: null });
            }}
            onFeedConfirm={async (feedData) => {
              if (feedData.timed) {
                const f = { ts: Date.now(), user: userName, ...feedData };
                setFeeding(f);
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
              setFeeding(null);
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
        {[{ id: "home", icon: "🏠", label: "בית" }, { id: "history", icon: "📋", label: "היסטוריה" }, { id: "stats", icon: "📊", label: "תובנות" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.navBtn(tab === t.id)}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span style={{ fontSize: 10, color: tab === t.id ? C.accent : C.muted }}>{t.label}</span>
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
      <div style={{ fontSize: 60 }}>👶</div>
      {step === 0 ? (
        <>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>ברוכים הבאים!</div>
          <div style={{ color: C.textSoft }}>מי את/ה?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {USERS.map(u => (
              <button key={u} onClick={() => { setUname(u); setStep(1); }} style={{ ...S.chip(false), padding: "10px 20px", fontSize: 15 }}>{u}</button>
            ))}
          </div>
          <input value={uname} onChange={e => setUname(e.target.value)} placeholder="שם אחר..." style={{ ...S.input, width: 200, textAlign: "center" }} />
          {uname && <button onClick={() => setStep(1)} style={S.primaryBtn}>המשך →</button>}
        </>
      ) : (
        <>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>מה שמה של התינוקת?</div>
          <input value={bname} onChange={e => setBname(e.target.value)} placeholder="שם..." style={{ ...S.input, width: 220, textAlign: "center", fontSize: 18 }} />
          <button onClick={() => onDone(uname, bname || "התינוקת")} style={S.primaryBtn}>🍼 בואו נתחיל!</button>
        </>
      )}
    </div>
  );
}

// ── Home Tab ───────────────────────────────────────────────────────────────
function HomeTab({ events, lastFeed, lastDiaper, sleeping, feeding, now, todaySleepMs, todayMl, userName, modal, setModal, onStartSleep, onEndSleep, onFeedConfirm, onEndFeed, onDiaperConfirm, onNoteConfirm }) {
  const sinceLastFeed = lastFeed ? now - lastFeed.ts : null;
  const sinceLastDiaper = lastDiaper ? now - lastDiaper.ts : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={S.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>📍 מצב עכשיו</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Stat label="ארוחה אחרונה" value={lastFeed ? sinceStr(lastFeed.ts) : "—"} warn={sinceLastFeed && sinceLastFeed > 3 * 3600000} />
          <Stat label="חיתול אחרון" value={lastDiaper ? sinceStr(lastDiaper.ts) : "—"} warn={sinceLastDiaper && sinceLastDiaper > 4 * 3600000} />
          <Stat label="שינה היום" value={todaySleepMs ? elapsed(todaySleepMs) : "—"} />
          <Stat label="נוזלים היום" value={todayMl ? `${todayMl} מ"ל` : "—"} />
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>⚡ פעולה מהירה</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {feeding
            ? <BigBtn icon="🍼" label="סיים האכלה" sub={elapsed(now - feeding.ts)} color={C.blue} onClick={onEndFeed} />
            : <BigBtn icon="🍼" label="האכלה" sub="לחץ להתחיל" color={C.accent} onClick={() => setModal("feed")} />}
          {sleeping
            ? <BigBtn icon="☀️" label="קמה!" sub={elapsed(now - sleeping.ts)} color={C.amber} onClick={onEndSleep} />
            : <BigBtn icon="😴" label="הלכה לישון" sub="לחץ לתיעוד" color={C.purple} onClick={onStartSleep} />}
          <BigBtn icon="🧷" label="חיתול" sub="פיפי / קקי" color={C.rose} onClick={() => setModal("diaper")} />
          <BigBtn icon="📝" label="הערה" sub="אירוע חופשי" color={C.muted} onClick={() => setModal("note")} />
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>⏱ אחרונים</div>
        {events.slice(0, 6).map(e => <EventRow key={e.id} ev={e} now={now} />)}
        {events.length === 0 && <div style={{ color: C.muted, textAlign: "center", padding: 20, fontSize: 13 }}>עוד אין אירועים 🍼</div>}
      </div>

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
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>{day.label}</div>
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
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>📊 7 ימים אחרונים</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <StatCard label="ממוצע בין ארוחות" value={avgGap ? elapsed(avgGap) : "—"} color={C.accent} />
          <StatCard label="ממוצע תנומה" value={avgSleep ? elapsed(avgSleep) : "—"} color={C.purple} />
          <StatCard label="שינה ב-24ש'" value={totalSleep24 ? elapsed(totalSleep24) : "—"} color={C.blue} />
          <StatCard label="ממוצע לארוחה" value={avgMl ? `${Math.round(avgMl)} מ"ל` : "—"} color={C.amber} />
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>🍼 האכלות לפי שעה</div>
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 60 }}>
          {hourCounts.map((c, h) => (
            <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "100%", borderRadius: 2, height: Math.max(3, (c / maxHour) * 52), background: c > 0 ? C.accent : C.border }} />
              {h % 6 === 0 && <div style={{ fontSize: 7, color: C.muted, marginTop: 2 }}>{h}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>🧷 חיתולים היום</div>
        <div style={{ display: "flex", gap: 10 }}>
          <StatCard label="💧 פיפי" value={diapersToday.filter(e => e.pee).length} color={C.blue} />
          <StatCard label="💩 קקי" value={diapersToday.filter(e => e.poop).length} color={C.amber} />
          <StatCard label="סה״כ" value={diapersToday.length} color={C.muted} />
        </div>
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>💡 תובנות</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 18 }}>{icons[ev.type] || "•"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{labels[ev.type] || ev.type}</div>
        {detail && <div style={{ fontSize: 11, color: C.textSoft }}>{detail}</div>}
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 12, color: C.muted }}>{fmt(ev.ts)}</div>
        {ev.user && <div style={{ fontSize: 10, color: C.border }}>{ev.user}</div>}
      </div>
      {onDelete && <button onClick={onDelete} style={{ background: "none", border: "none", color: C.muted, fontSize: 14, padding: 4 }}>🗑</button>}
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
        <div style={{ marginBottom: 12 }}>
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
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>צד</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["שמאל", "ימין", "שניהם"].map(s => (
              <button key={s} onClick={() => setSide(s)} style={S.chip(side === s)}>{s}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
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
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>צבע (אופציונלי)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["צהוב", "ירוק", "חום", "שחור", "אחר"].map(c => (
              <button key={c} onClick={() => setColor(c)} style={S.chip(color === c)}>{c}</button>
            ))}
          </div>
        </div>
      )}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="הערה..." style={{ ...S.input, marginBottom: 14 }} />
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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {["חיסון", "תרופה", "רופא", "חסרת שקט", "חולה", "אחר"].map(t => (
          <button key={t} onClick={() => setTag(t)} style={S.chip(tag === t)}>{t}</button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="כתוב הערה..."
        style={{ ...S.input, height: 80, resize: "none", width: "100%", marginBottom: 14 }} />
      <button onClick={() => onConfirm({ note: text, tag: tag || undefined })}
        style={S.primaryBtn} disabled={!text && !tag}>✅ שמור</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Small components ───────────────────────────────────────────────────────
function Stat({ label, value, warn }) {
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", flex: "1 1 110px" }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: warn ? C.rose : C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function StatCard({ label, value, color }) {
  return (
    <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", flex: "1 1 90px" }}>
      <div style={{ fontSize: 11, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function BigBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: `${color}18`, border: `2px solid ${color}40`, borderRadius: 16, padding: "16px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
      <span style={{ fontSize: 30 }}>{icon}</span>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>
    </button>
  );
}
function Insight({ icon, text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 13, color: C.textSoft }}>{text}</span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Heebo', sans-serif", direction: "rtl", color: C.text, maxWidth: 480, margin: "0 auto" },
  header: { background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 },
  content: { flex: 1, padding: "14px 14px 80px", overflowY: "auto" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0" },
  navBtn: (active) => ({ background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 20px", opacity: active ? 1 : 0.5, cursor: "pointer" }),
  card: { background: C.surface, borderRadius: 16, padding: "14px", border: `1px solid ${C.border}` },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: C.card, borderRadius: "20px 20px 0 0", padding: "20px 18px", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", border: `1px solid ${C.border}` },
  input: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", color: C.text, fontSize: 14, outline: "none", width: "100%" },
  label: { display: "block", fontSize: 12, color: C.muted, marginBottom: 8 },
  chip: (active) => ({ background: active ? C.accent + "30" : C.bg, border: `1.5px solid ${active ? C.accent : C.border}`, color: active ? C.accent : C.textSoft, borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }),
  primaryBtn: { background: C.accent, color: C.bg, border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 15, fontWeight: 700, width: "100%", cursor: "pointer" },
  badge: (color) => ({ background: color === "purple" ? C.purple + "25" : C.blue + "25", border: `1px solid ${color === "purple" ? C.purple + "60" : C.blue + "60"}`, color: color === "purple" ? C.purple : C.blue, borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 600 }),
  center: { display: "flex", alignItems: "center", justifyContent: "center" },
};
