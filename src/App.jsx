import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg: "#fff8f5",
  bgSoft: "#fdf0eb",
  white: "#ffffff",
  border: "#fad4c0",
  borderSoft: "#fce8dc",
  pink: "#f9a8c9",
  pinkDark: "#e879a0",
  pinkLight: "#fde8f2",
  rose: "#fca5a5",
  peach: "#f4a58a",
  peachDark: "#e8845e",
  peachLight: "#fdeee8",
  lavender: "#d4b8f0",
  lavenderLight: "#f0e8fc",
  mint: "#a8dcc8",
  mintLight: "#e8f8f0",
  yellow: "#fde68a",
  yellowLight: "#fef9e0",
  text: "#6b3d2e",
  textSoft: "#a07060",
  textMuted: "#c0987e",
  shadow: "rgba(249,168,201,0.18)",
  shadowDeep: "rgba(244,165,138,0.22)",
};

const FONT = "'Nunito', sans-serif";
const USERS = ["אמא", "אבא", "סבתא", "אחר"];

const NOTE_TAGS = [
  { id: "unwell", label: "לא מרגישה טוב", icon: "🤒" },
  { id: "restless", label: "חסרת שקט", icon: "😣" },
  { id: "crying", label: "בוכה הרבה", icon: "😢" },
  { id: "vaccine", label: "חיסון", icon: "💉" },
  { id: "medicine", label: "תרופה", icon: "💊" },
  { id: "doctor", label: "ביקור רופא", icon: "👨‍⚕️" },
  { id: "milestone", label: "אבן דרך", icon: "⭐" },
  { id: "other", label: "אחר", icon: "📝" },
];

function fmt(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}
function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}ש׳ ${rm}ד׳` : `${h}ש׳`;
}
function sinceStr(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  return `לפני ${h}ש׳${m % 60 ? " " + (m % 60) + "ד׳" : ""}`;
}
function groupByDay(events) {
  const days = {};
  events.forEach(e => {
    const d = new Date(e.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!days[key]) days[key] = { label: fmtDate(e.ts), ts: e.ts, events: [] };
    days[key].events.push(e);
  });
  return Object.values(days).sort((a, b) => b.ts - a.ts);
}
function cleanObj(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null));
}
function greetUser(name) {
  const hour = new Date().getHours();
  if (hour < 5) return `לילה טוב, ${name} 🌙`;
  if (hour < 12) return `בוקר טוב, ${name} ☀️`;
  if (hour < 17) return `צהריים טובים, ${name} 🌤`;
  if (hour < 21) return `ערב טוב, ${name} 🌆`;
  return `לילה טוב, ${name} 🌙`;
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
  const [editEvent, setEditEvent] = useState(null);
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
    const data = cleanObj({ ts: Date.now(), user: userName, ...ev });
    await addDoc(collection(db, "events"), data);
  }, [userName]);

  const updateEvent = useCallback(async (id, patch) => {
    await updateDoc(doc(db, "events", id), patch);
  }, []);

  const deleteEvent = useCallback(async (id) => {
    await deleteDoc(doc(db, "events", id));
  }, []);

  if (loading) return (
    <div style={{ ...S.center, background: `linear-gradient(135deg, ${C.pinkLight}, ${C.peachLight})`, height: "100vh", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      <div style={{ fontSize: 60 }}>🍼</div>
      <div style={{ color: C.pinkDark, fontSize: 18, fontWeight: 700 }}>טוען...</div>
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

  const todayEvents = events.filter(e => {
    const d = new Date(e.ts), t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth();
  });
  const lastFeed = events.find(e => e.type === "feed");
  const lastDiaper = events.find(e => e.type === "diaper");
  const todaySleepMs = todayEvents.filter(e => e.type === "sleep_end" && e.duration).reduce((s, e) => s + e.duration, 0);
  const todayMl = todayEvents.filter(e => e.type === "feed" && e.ml).reduce((s, e) => s + Number(e.ml || 0), 0);
  const todayFeeds = todayEvents.filter(e => e.type === "feed");
  const todayPee = todayEvents.filter(e => e.type === "diaper" && e.pee).length;
  const todayPoop = todayEvents.filter(e => e.type === "diaper" && e.poop).length;
  const todayAwakeMs = 86400000 - todaySleepMs;

  // Alert: no poop for 24h
  const lastPoop = events.find(e => e.type === "diaper" && e.poop);
  const noPoopAlert = !lastPoop || (Date.now() - lastPoop.ts > 24 * 3600000);

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        input, textarea, button, select { font-family: ${FONT}; }
        button:active { transform: scale(0.97); }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.pinkDark, letterSpacing: 1 }}>
            {babyName} 👶
          </div>
          <div style={{ fontSize: 13, color: C.textSoft, fontWeight: 600, marginTop: 2 }}>
            {greetUser(userName)}
          </div>
        </div>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 6 }}>
          {sleeping && <Pill bg={C.lavenderLight} color={C.pinkDark} text={`😴 ${elapsed(now - sleeping.ts)}`} />}
          {feeding && <Pill bg={C.mintLight} color={C.pinkDark} text={`🍼 ${elapsed(now - feeding.ts)}`} />}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={S.content}>
        {tab === "home" && (
          <HomeTab
            events={events} todayEvents={todayEvents}
            lastFeed={lastFeed} lastDiaper={lastDiaper}
            sleeping={sleeping} feeding={feeding} now={now}
            todaySleepMs={todaySleepMs} todayMl={todayMl}
            todayFeeds={todayFeeds} todayPee={todayPee} todayPoop={todayPoop}
            todayAwakeMs={todayAwakeMs} noPoopAlert={noPoopAlert}
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
                const f = cleanObj({ ts: feedData.startTs || Date.now(), user: userName, ...feedData });
                await saveState({ feeding: f });
                await addEvent(cleanObj({ type: "feed_start", feedType: feedData.feedType, side: feedData.side, ts: feedData.startTs || Date.now() }));
              } else {
                await addEvent(cleanObj({ type: "feed", ...feedData, ts: feedData.startTs || Date.now() }));
              }
              setModal(null);
            }}
            onEndFeed={async () => {
              if (!feeding) return;
              const dur = Date.now() - feeding.ts;
              await addEvent(cleanObj({ type: "feed", feedType: feeding.feedType, side: feeding.side, ml: feeding.ml, duration: dur, ts: feeding.ts }));
              await saveState({ feeding: null });
            }}
            onDiaperConfirm={async (data) => {
              await addEvent(cleanObj({ type: "diaper", ...data }));
              setModal(null);
            }}
            onNoteConfirm={async (data) => {
              await addEvent(cleanObj({ type: "note", ...data }));
              setModal(null);
            }}
            onSleepRetro={async (data) => {
              await addEvent(cleanObj({ type: "sleep_end", ...data }));
              setModal(null);
            }}
          />
        )}
        {tab === "history" && (
          <HistoryTab events={events} onDelete={deleteEvent} onEdit={setEditEvent} now={now} />
        )}
        {tab === "stats" && <StatsTab events={events} now={now} />}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={S.nav}>
        {[
          { id: "home", icon: "🏠", label: "בית" },
          { id: "history", icon: "📋", label: "יומן" },
          { id: "stats", icon: "📊", label: "תובנות" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.navBtn(tab === t.id)}>
            <span style={{ fontSize: 24 }}>{t.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: tab === t.id ? C.pinkDark : C.textMuted }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Edit modal */}
      {editEvent && (
        <EditModal ev={editEvent} onSave={async (patch) => {
          await updateEvent(editEvent.id, patch);
          setEditEvent(null);
        }} onClose={() => setEditEvent(null)} />
      )}
    </div>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────
function SetupScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [uname, setUname] = useState("");
  const [bname, setBname] = useState("");
  return (
    <div style={{ background: `linear-gradient(160deg, ${C.pinkLight} 0%, ${C.peachLight} 100%)`, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32, fontFamily: FONT, direction: "rtl" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap');`}</style>
      <div style={{ fontSize: 72 }}>👶</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: C.pinkDark, fontSize: 28, fontWeight: 900 }}>ברוכים הבאים!</div>
        <div style={{ color: C.textSoft, fontSize: 15, marginTop: 4 }}>אפליקציית המעקב שלכם</div>
      </div>
      {step === 0 ? (
        <>
          <div style={{ color: C.text, fontSize: 17, fontWeight: 700 }}>מי את/ה?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {USERS.map(u => (
              <button key={u} onClick={() => { setUname(u); setStep(1); }}
                style={{ ...S.chip(false), padding: "14px 26px", fontSize: 16, borderRadius: 20 }}>{u}</button>
            ))}
          </div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>— או כתוב שם אחר —</div>
          <input value={uname} onChange={e => setUname(e.target.value)} placeholder="שם..."
            style={{ ...S.input, width: 200, textAlign: "center", fontSize: 16 }} />
          {uname && <button onClick={() => setStep(1)} style={S.primaryBtn}>המשך ←</button>}
        </>
      ) : (
        <>
          <div style={{ color: C.text, fontSize: 17, fontWeight: 700 }}>מה שמה של התינוקת? 🌸</div>
          <input value={bname} onChange={e => setBname(e.target.value)} placeholder="שם התינוקת..."
            style={{ ...S.input, width: 240, textAlign: "center", fontSize: 18, fontWeight: 700 }} />
          <button onClick={() => onDone(uname, bname || "התינוקת")} style={S.primaryBtn}>
            🍼 בואו נתחיל!
          </button>
        </>
      )}
    </div>
  );
}

// ── Home Tab ───────────────────────────────────────────────────────────────
function HomeTab({
  events, todayEvents, lastFeed, lastDiaper, sleeping, feeding, now,
  todaySleepMs, todayMl, todayFeeds, todayPee, todayPoop, todayAwakeMs,
  noPoopAlert, userName, modal, setModal,
  onStartSleep, onEndSleep, onFeedConfirm, onEndFeed, onDiaperConfirm, onNoteConfirm, onSleepRetro
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Alert */}
      {noPoopAlert && (
        <div style={{ background: "#fff3cd", border: "1.5px solid #f9c74f", borderRadius: 16, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#856404" }}>שים לב!</div>
            <div style={{ fontSize: 12, color: "#856404" }}>
              {lastDiaper ? `לא היה קקי מזה ${elapsed(Date.now() - (events.find(e => e.type === "diaper" && e.poop)?.ts || 0))}` : "עוד לא תועד קקי היום"}
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {feeding
          ? <ActionBtn icon="🍼" label="סיים האכלה" sub={elapsed(now - feeding.ts)} color={C.mint} onClick={onEndFeed} active />
          : <ActionBtn icon="🍼" label="האכלה" sub="לחץ להתחיל" color={C.peach} onClick={() => setModal("feed")} />}
        <ActionBtn icon="🧷" label="החתלה" sub="פיפי / קקי" color={C.pink} onClick={() => setModal("diaper")} />
        {sleeping
          ? <ActionBtn icon="☀️" label="קמה!" sub={elapsed(now - sleeping.ts)} color={C.yellow} onClick={onEndSleep} active />
          : <ActionBtn icon="😴" label="שינה" sub="לחץ לתיעוד" color={C.lavender} onClick={() => setModal("sleep")} />}
      </div>

      {/* Note button */}
      <button onClick={() => setModal("note")} style={{
        background: C.white, border: `1.5px dashed ${C.border}`, borderRadius: 16,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
        cursor: "pointer", boxShadow: `0 2px 8px ${C.shadow}`, width: "100%",
      }}>
        <span style={{ fontSize: 20 }}>📝</span>
        <span style={{ fontSize: 14, color: C.textSoft, fontWeight: 600 }}>הוסף הערה או אירוע מיוחד...</span>
      </button>

      {/* Daily Summary */}
      <div style={{ ...S.card, background: `linear-gradient(135deg, ${C.pinkLight}, ${C.peachLight})`, border: `1.5px solid ${C.border}` }}>
        <div style={S.cardTitle}>✨ סיכום היום</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SummaryCard icon="🍼" title="האכלות" value={`${todayFeeds.length} פעמים`} sub={todayMl ? `${todayMl} מל סהכ` : "ללא כמות"} color={C.peach} />
          <SummaryCard icon="🧷" title="חיתולים" value={`💧${todayPee} 💩${todayPoop}`} sub={`סהכ ${todayPee + todayPoop}`} color={C.pink} warn={noPoopAlert} />
          <SummaryCard icon="😴" title="שינה" value={todaySleepMs ? elapsed(todaySleepMs) : "—"} sub={sleeping ? "ישנה כרגע" : "סהכ היום"} color={C.lavender} />
          <SummaryCard icon="🌟" title="זמן ערות" value={todayFeeds.length > 0 ? elapsed(Math.min(todayAwakeMs, 86400000)) : "—"} sub="מתחילת היום" color={C.mint} />
        </div>
      </div>

      {/* Recent */}
      <div style={S.card}>
        <div style={S.cardTitle}>⏱ פעולות אחרונות</div>
        {events.slice(0, 8).map(e => <EventRow key={e.id} ev={e} now={now} />)}
        {events.length === 0 && (
          <div style={{ color: C.textMuted, textAlign: "center", padding: "24px 0", fontSize: 14 }}>
            עוד אין אירועים — בואו נתחיל! 🌸
          </div>
        )}
      </div>

      {/* Modals */}
      {modal === "feed" && <FeedModal onConfirm={onFeedConfirm} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={onDiaperConfirm} onClose={() => setModal(null)} />}
      {modal === "note" && <NoteModal onConfirm={onNoteConfirm} onClose={() => setModal(null)} />}
      {modal === "sleep" && <SleepModal onConfirm={(data) => { if (data.now) { onStartSleep(); setModal(null); } else onSleepRetro(data); }} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── History Tab ────────────────────────────────────────────────────────────
function HistoryTab({ events, onDelete, onEdit, now }) {
  const days = groupByDay(events);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {days.map(day => (
        <div key={day.label}>
          <div style={{ fontSize: 13, color: C.pinkDark, marginBottom: 8, fontWeight: 800, paddingRight: 4 }}>{day.label}</div>
          <div style={S.card}>
            {day.events.map(e => (
              <EventRow key={e.id} ev={e} now={now} onDelete={() => onDelete(e.id)} onEdit={() => onEdit(e)} showUser />
            ))}
          </div>
        </div>
      ))}
      {days.length === 0 && (
        <div style={{ color: C.textMuted, textAlign: "center", padding: 40, fontSize: 15 }}>אין היסטוריה עדיין 🌸</div>
      )}
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
  const mlFeeds = last7.filter(e => e.type === "feed" && e.ml);
  const avgMl = mlFeeds.length ? mlFeeds.reduce((s, e) => s + Number(e.ml), 0) / mlFeeds.length : null;
  const hourCounts = Array(24).fill(0);
  feeds.forEach(f => { hourCounts[new Date(f.ts).getHours()]++; });
  const maxHour = Math.max(...hourCounts, 1);
  const diapersToday = events.filter(e => e.type === "diaper" && now - e.ts < 86400000);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={S.card}>
        <div style={S.cardTitle}>📊 ממוצעים — 7 ימים</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard label="בין ארוחות" value={avgGap ? elapsed(avgGap) : "—"} color={C.peach} icon="🍼" />
          <StatCard label="תנומה ממוצעת" value={avgSleep ? elapsed(avgSleep) : "—"} color={C.lavender} icon="😴" />
          <StatCard label="שינה 24ש׳" value={totalSleep24 ? elapsed(totalSleep24) : "—"} color={C.mint} icon="🌙" />
          <StatCard label="מ״ל לארוחה" value={avgMl ? `${Math.round(avgMl)}` : "—"} color={C.pink} icon="💧" />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>🍼 האכלות לפי שעה (7 ימים)</div>
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 70, padding: "0 4px" }}>
          {hourCounts.map((c, h) => (
            <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: "100%", borderRadius: 4, height: Math.max(4, (c / maxHour) * 58), background: c > 0 ? `linear-gradient(180deg, ${C.pink}, ${C.peach})` : C.borderSoft, transition: "height .3s" }} />
              {h % 6 === 0 && <div style={{ fontSize: 8, color: C.textMuted }}>{h}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>🧷 חיתולים היום</div>
        <div style={{ display: "flex", gap: 10 }}>
          <StatCard label="💧 פיפי" value={diapersToday.filter(e => e.pee).length} color={C.mint} icon="" />
          <StatCard label="💩 קקי" value={diapersToday.filter(e => e.poop).length} color={C.yellow} icon="" />
          <StatCard label="סה״כ" value={diapersToday.length} color={C.peach} icon="" />
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>💡 תובנות</div>
        {avgGap && <Insight icon="🍼" text={`בדרך כלל רעבה כל ${elapsed(avgGap)}`} />}
        {avgSleep && <Insight icon="😴" text={`ממוצע תנומה: ${elapsed(avgSleep)}`} />}
        {avgMl && <Insight icon="📈" text={`שותה בממוצע ${Math.round(avgMl)} מ"ל לארוחה`} />}
        {feeds.length < 3 && <Insight icon="⏳" text="צריך עוד נתונים לתובנות טובות" />}
      </div>
    </div>
  );
}

// ── Event Row ──────────────────────────────────────────────────────────────
function EventRow({ ev, now, onDelete, onEdit, showUser }) {
  const typeMap = {
    feed: { icon: "🍼", label: "האכלה", color: C.peachLight },
    feed_start: { icon: "🍼", label: "התחלת האכלה", color: C.peachLight },
    sleep_start: { icon: "😴", label: "הלכה לישון", color: C.lavenderLight },
    sleep_end: { icon: "☀️", label: "קמה", color: C.yellowLight },
    diaper: { icon: "🧷", label: "החתלה", color: C.pinkLight },
    note: { icon: "📝", label: "הערה", color: C.mintLight },
  };
  const t = typeMap[ev.type] || { icon: "•", label: ev.type, color: C.white };

  let detail = "";
  if (ev.type === "feed") {
    if (ev.ml) detail += `${ev.ml} מ"ל `;
    if (ev.side) detail += `(${ev.side}) `;
    if (ev.duration) detail += `• ${elapsed(ev.duration)}`;
    if (ev.feedType === "breast") detail = `הנקה ${detail}`;
  }
  if (ev.type === "diaper") {
    const parts = [];
    if (ev.pee) parts.push("💧פיפי");
    if (ev.poop) parts.push("💩קקי");
    if (ev.color) parts.push(ev.color);
    detail = parts.join(" ");
  }
  if (ev.type === "sleep_end" && ev.duration) detail = `${elapsed(ev.duration)}`;
  if (ev.type === "note") {
    const tag = NOTE_TAGS.find(t => t.id === ev.tag);
    detail = tag ? `${tag.icon} ${tag.label}` : "";
    if (ev.note) detail += (detail ? " — " : "") + ev.note;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
        {t.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{t.label}</div>
        {detail && <div style={{ fontSize: 12, color: C.textSoft, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</div>}
        {showUser && ev.user && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>👤 {ev.user}</div>
        )}
      </div>
      <div style={{ textAlign: "left", flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: C.textSoft, fontWeight: 600 }}>{fmt(ev.ts)}</div>
        {!showUser && ev.user && <div style={{ fontSize: 10, color: C.textMuted }}>{ev.user}</div>}
      </div>
      {onEdit && (
        <button onClick={onEdit} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 16, padding: "4px 2px", cursor: "pointer" }}>✏️</button>
      )}
      {onDelete && (
        <button onClick={onDelete} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 16, padding: "4px 2px", cursor: "pointer" }}>🗑</button>
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
  const [retro, setRetro] = useState(false);
  const [retroTime, setRetroTime] = useState("");
  const [showDiaperQ, setShowDiaperQ] = useState(false);
  const [pendingData, setPendingData] = useState(null);

  function handleSave() {
    let startTs = Date.now();
    if (retro && retroTime) {
      const [h, m] = retroTime.split(":").map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      startTs = d.getTime();
    }
    const data = cleanObj({ feedType, ml: ml || undefined, side: side || undefined, timed, startTs });
    setPendingData(data);
    setShowDiaperQ(true);
  }

  if (showDiaperQ) return (
    <Modal title="🧷 תזכורת" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧷</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>זכרת להחליף חיתול לפני ההאכלה?</div>
        <div style={{ fontSize: 13, color: C.textSoft, marginBottom: 20 }}>מומלץ להחליף לפני כל ארוחה</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onConfirm(pendingData)} style={{ ...S.primaryBtn, background: C.mint, flex: 1 }}>✅ כן, כבר החלפתי</button>
          <button onClick={() => onConfirm(pendingData)} style={{ ...S.primaryBtn, background: C.peach, flex: 1 }}>דלג →</button>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal title="🍼 האכלה" onClose={onClose}>
      <div style={{ background: C.peachLight, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: C.peachDark, fontWeight: 600 }}>
        💡 הכנס את שעת תחילת ההאכלה של התינוקת
      </div>
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
            <input value={ml} onChange={e => setMl(e.target.value)} placeholder="אחר..." style={{ ...S.input, width: 75 }} />
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => { setTimed(true); setRetro(false); }} style={{ ...S.chip(timed && !retro), flex: 1 }}>⏱ טיימר עכשיו</button>
        <button onClick={() => { setRetro(true); setTimed(false); }} style={{ ...S.chip(retro), flex: 1 }}>🕐 הזן שעה</button>
      </div>
      {retro && (
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>שעת תחילת ההאכלה</label>
          <input type="time" value={retroTime} onChange={e => setRetroTime(e.target.value)} style={S.input} />
        </div>
      )}
      <button onClick={handleSave} style={S.primaryBtn}>המשך ←</button>
    </Modal>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  const [color, setColor] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title="🧷 החתלה" onClose={onClose}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button onClick={() => setPee(!pee)} style={{ ...S.chip(pee), flex: 1, fontSize: 15 }}>💧 פיפי</button>
        <button onClick={() => setPoop(!poop)} style={{ ...S.chip(poop), flex: 1, fontSize: 15 }}>💩 קקי</button>
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
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="הערה..." style={{ ...S.input, marginBottom: 16 }} />
      <button onClick={() => onConfirm({ pee, poop, color: color || undefined, note: note || undefined })}
        style={S.primaryBtn} disabled={!pee && !poop}>✅ שמור</button>
    </Modal>
  );
}

function NoteModal({ onConfirm, onClose }) {
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");
  const selectedTag = NOTE_TAGS.find(t => t.id === tag);
  return (
    <Modal title="📝 הערה ואירועים" onClose={onClose}>
      <label style={S.label}>סוג האירוע</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {NOTE_TAGS.map(t => (
          <button key={t.id} onClick={() => setTag(t.id)}
            style={{ ...S.chip(tag === t.id), display: "flex", alignItems: "center", gap: 4 }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>
      <label style={S.label}>פירוט (אופציונלי)</label>
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder={selectedTag ? `פרט על ${selectedTag.label}...` : "כתוב הערה חופשית..."}
        style={{ ...S.input, height: 80, resize: "none", width: "100%", marginBottom: 16 }} />
      <button onClick={() => onConfirm({ tag: tag || undefined, note: text || undefined })}
        style={S.primaryBtn} disabled={!text && !tag}>✅ שמור</button>
    </Modal>
  );
}

function SleepModal({ onConfirm, onClose }) {
  const [retroTime, setRetroTime] = useState("");
  const [duration, setDuration] = useState("");
  return (
    <Modal title="😴 שינה" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <button onClick={() => onConfirm({ now: true })} style={{ ...S.primaryBtn, background: C.lavender, color: C.text }}>
          😴 ישנה עכשיו — התחל טיימר
        </button>
        <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13 }}>— או הזן שינה שכבר הייתה —</div>
        <div>
          <label style={S.label}>שעת כניסה לשינה</label>
          <input type="time" value={retroTime} onChange={e => setRetroTime(e.target.value)} style={{ ...S.input, marginBottom: 10 }} />
          <label style={S.label}>משך (דקות)</label>
          <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="45" style={S.input} />
        </div>
        <button onClick={() => {
          if (!retroTime || !duration) return;
          const [h, m] = retroTime.split(":").map(Number);
          const d = new Date(); d.setHours(h, m, 0, 0);
          onConfirm({ ts: d.getTime(), duration: Number(duration) * 60000, now: false });
        }} style={{ ...S.primaryBtn, opacity: (!retroTime || !duration) ? 0.5 : 1 }}>✅ שמור שינה</button>
      </div>
    </Modal>
  );
}

function EditModal({ ev, onSave, onClose }) {
  const [note, setNote] = useState(ev.note || "");
  const [ml, setMl] = useState(ev.ml || "");
  return (
    <Modal title="✏️ עריכת אירוע" onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label style={S.label}>שעה</label>
        <div style={{ fontSize: 14, color: C.textSoft, padding: "8px 0" }}>{fmt(ev.ts)} — {new Date(ev.ts).toLocaleDateString("he-IL")}</div>
      </div>
      {ev.type === "feed" && (
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>כמות (מ"ל)</label>
          <input value={ml} onChange={e => setMl(e.target.value)} style={S.input} />
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>הערה</label>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          style={{ ...S.input, height: 70, resize: "none", width: "100%" }} />
      </div>
      <button onClick={() => onSave(cleanObj({ note: note || undefined, ml: ml ? Number(ml) : undefined }))}
        style={S.primaryBtn}>💾 שמור שינויים</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Small Components ───────────────────────────────────────────────────────
function ActionBtn({ icon, label, sub, color, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color + "50" : color + "25",
      border: `2px solid ${color}${active ? "cc" : "60"}`,
      borderRadius: 20, padding: "14px 8px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
      cursor: "pointer", boxShadow: `0 3px 10px ${color}30`, width: "100%",
      transition: "all .15s",
    }}>
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{label}</div>
      <div style={{ fontSize: 10, color: C.textSoft }}>{sub}</div>
    </button>
  );
}

function SummaryCard({ icon, title, value, sub, color, warn }) {
  return (
    <div style={{
      background: warn ? "#fff3cd" : C.white,
      border: `2px solid ${warn ? "#f9c74f" : color + "60"}`,
      borderRadius: 16, padding: "12px 14px",
      boxShadow: `0 2px 8px ${color}20`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: warn ? "#856404" : C.text }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{ background: color + "25", border: `1.5px solid ${color}60`, borderRadius: 14, padding: "12px 14px", flex: "1 1 90px" }}>
      <div style={{ fontSize: 12, color: C.textSoft, fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Pill({ bg, color, text }) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}40`, color, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>{text}</div>
  );
}

function Insight({ icon, text }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13, color: C.textSoft, fontWeight: 600 }}>{text}</span>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: FONT, direction: "rtl", color: C.text, maxWidth: 480, margin: "0 auto" },
  header: { background: C.white, borderBottom: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "center", position: "sticky", top: 0, zIndex: 10, boxShadow: `0 3px 12px ${C.shadow}` },
  content: { flex: 1, padding: "16px 14px 90px", overflowY: "auto" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "10px 0 14px", boxShadow: `0 -3px 12px ${C.shadow}` },
  navBtn: (active) => ({ background: active ? C.pinkLight : "none", border: "none", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 22px", cursor: "pointer", transition: "background .2s" }),
  card: { background: C.white, borderRadius: 20, padding: "16px", border: `1px solid ${C.border}`, boxShadow: `0 3px 12px ${C.shadow}` },
  cardTitle: { fontSize: 14, color: C.pinkDark, marginBottom: 14, fontWeight: 800 },
  overlay: { position: "fixed", inset: 0, background: "rgba(107,61,46,0.18)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: C.white, borderRadius: "26px 26px 0 0", padding: "24px 18px", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", boxShadow: `0 -6px 24px ${C.shadowDeep}` },
  input: { background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: "10px 14px", color: C.text, fontSize: 14, fontWeight: 600, outline: "none", width: "100%" },
  label: { display: "block", fontSize: 12, color: C.pinkDark, marginBottom: 8, fontWeight: 800 },
  chip: (active) => ({ background: active ? C.pink + "40" : C.bg, border: `2px solid ${active ? C.pinkDark : C.border}`, color: active ? C.pinkDark : C.textSoft, borderRadius: 12, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s" }),
  primaryBtn: { background: `linear-gradient(135deg, ${C.pink}, ${C.peach})`, color: C.white, border: "none", borderRadius: 16, padding: "14px 24px", fontSize: 15, fontWeight: 800, width: "100%", cursor: "pointer", boxShadow: `0 4px 14px ${C.shadowDeep}` },
  center: { display: "flex", alignItems: "center", justifyContent: "center" },
};
