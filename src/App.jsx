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
  // צבעים למשתמשים
  userAbba: "#e0f2fe", // כחול בהיר
  userIma: "#fff7ed",  // שמנת/כתום רך
  userSavta: "#f0fdf4", // ירקרק עדין
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

// עוזר לקבל צבע לפי משתמש
function getUserColor(user) {
  if (user === "אבא") return C.userAbba;
  if (user === "אמא") return C.userIma;
  if (user === "סבתא") return C.userSavta;
  return C.white;
}

function fmt(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}

// פונקציה מעודכנת ללא שניות ועם רווחים תקינים
function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h} ש׳ ו-${rm} דק׳` : `${h} ש׳`;
}

function sinceStr(ts) {
  if (!ts) return "—";
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `לפני ${h} ש׳${rm ? " ו-" + rm + " דק׳" : ""}`;
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
    const id = setInterval(() => setNow(Date.now()), 30000); // עדכון כל 30 שניות מספיק
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
  const todayMl = todayEvents.filter(e => e.type === "feed" && e.ml).reduce((s, e) => s + Number(e.ml || 0), 0);
  const todayFeeds = todayEvents.filter(e => e.type === "feed");
  const todayPee = todayEvents.filter(e => e.type === "diaper" && e.pee).length;
  const todayPoop = todayEvents.filter(e => e.type === "diaper" && e.poop).length;

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, button, select { font-family: ${FONT}; }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.pinkDark }}>
            {babyName} 👶
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={S.content}>
        {tab === "home" && (
          <HomeTab
            events={events} todayEvents={todayEvents}
            lastFeed={lastFeed} lastDiaper={lastDiaper}
            feeding={feeding} now={now}
            todayMl={todayMl} todayFeeds={todayFeeds} 
            todayPee={todayPee} todayPoop={todayPoop}
            userName={userName} modal={modal} setModal={setModal}
            onFeedConfirm={async (feedData) => {
              await addEvent(cleanObj({ type: "feed", ...feedData, ts: feedData.startTs || Date.now() }));
              setModal(null);
            }}
            onDiaperConfirm={async (data) => {
              await addEvent(cleanObj({ type: "diaper", ...data }));
              setModal(null);
            }}
            onNoteConfirm={async (data) => {
              await addEvent(cleanObj({ type: "note", ...data }));
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

      {editEvent && (
        <EditModal ev={editEvent} onSave={async (patch) => {
          await updateEvent(editEvent.id, patch);
          setEditEvent(null);
        }} onClose={() => setEditEvent(null)} />
      )}
    </div>
  );
}

// ── Setup (No changes needed) ──────────────────────────────────────────────
function SetupScreen({ onDone }) {
    const [step, setStep] = useState(0);
    const [uname, setUname] = useState("");
    const [bname, setBname] = useState("");
    return (
      <div style={{ background: `linear-gradient(160deg, ${C.pinkLight} 0%, ${C.peachLight} 100%)`, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 32, fontFamily: FONT, direction: "rtl" }}>
        <div style={{ fontSize: 72 }}>👶</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.pinkDark, fontSize: 28, fontWeight: 900 }}>ברוכים הבאים!</div>
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
  events, lastFeed, lastDiaper, feeding, now,
  todayMl, todayFeeds, todayPee, todayPoop,
  setModal
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* הסטריפ החדש שמחליף את ה"שים לב" */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: "12px 16px", display: "flex", justifyContent: "space-around", boxShadow: `0 2px 8px ${C.shadow}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textSoft, fontWeight: 700 }}>אכלה לפני</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.peachDark }}>{sinceStr(lastFeed?.ts)}</div>
        </div>
        <div style={{ width: 1, background: C.borderSoft }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.textSoft, fontWeight: 700 }}>הוחלפה לפני</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.pinkDark }}>{sinceStr(lastDiaper?.ts)}</div>
        </div>
      </div>

      {/* כפתורי פעולה - ללא שינה/קימה */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ActionBtn icon="🍼" label="האכלה" sub="בקבוק" color={C.peach} onClick={() => setModal("feed")} />
        <ActionBtn icon="🧷" label="החתלה" sub="פיפי / קקי" color={C.pink} onClick={() => setModal("diaper")} />
      </div>

      {/* סיכום יומי - משבצות מעוצבות מחדש */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SummaryCard 
          icon="🍼" title="האכלות היום" 
          value={`${todayFeeds.length} פעמים`} 
          sub={`סה"כ: ${todayMl} מ"ל`} 
          color={C.peach} 
          lastVal={lastFeed?.ml ? `פעם אחרונה: ${lastFeed.ml} מ"ל` : ""}
        />
        <SummaryCard 
          icon="🧷" title="חיתולים" 
          value={`💧${todayPee}  💩${todayPoop}`} 
          sub={`סה"כ ${todayPee + todayPoop} החתלות`} 
          color={C.pink} 
        />
      </div>

      {/* כפתור הערה לפני הטבלה */}
      <button onClick={() => setModal("note")} style={{
        background: C.white, border: `1.5px dashed ${C.border}`, borderRadius: 16,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
        cursor: "pointer", width: "100%",
      }}>
        <span style={{ fontSize: 20 }}>📝</span>
        <span style={{ fontSize: 14, color: C.textSoft, fontWeight: 600 }}>הוסף הערה או אירוע מיוחד...</span>
      </button>

      {/* פעולות אחרונות כטבלה מסודרת */}
      <div style={S.card}>
        <div style={S.cardTitle}>⏱ עדכונים אחרונים</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.borderSoft}`, textAlign: "right" }}>
              <th style={{ padding: "8px 4px", color: C.textSoft, fontWeight: 800 }}>זמן</th>
              <th style={{ padding: "8px 4px", color: C.textSoft, fontWeight: 800 }}>פעולה</th>
              <th style={{ padding: "8px 4px", color: C.textSoft, fontWeight: 800 }}>פרטים</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 10).map(e => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${C.borderSoft}`, background: getUserColor(e.user) }}>
                <td style={{ padding: "12px 4px", fontWeight: 700 }}>{fmt(e.ts)}</td>
                <td style={{ padding: "12px 4px" }}>
                    {e.type === "feed" ? "🍼 אוכל" : e.type === "diaper" ? "🧷 חיתול" : "📝 הערה"}
                </td>
                <td style={{ padding: "12px 4px", fontSize: 12 }}>
                  {e.type === "feed" && `${e.ml || 0} מ"ל`}
                  {e.type === "diaper" && `${e.pee ? "💧" : ""}${e.poop ? "💩" : ""}`}
                  {e.type === "note" && (NOTE_TAGS.find(t=>t.id===e.tag)?.icon || "📝")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    </div>
  );
}

// ── Stats Tab (No changes needed) ──────────────────────────────────────────────
function StatsTab({ events, now }) {
    return <div style={{padding: 20, textAlign: 'center'}}>הסטטיסטיקה תעודכן בקרוב בהתאם למבנה החדש 📊</div>
}

// ── Event Row ──────────────────────────────────────────────────────────────
function EventRow({ ev, now, onDelete, onEdit, showUser }) {
  const typeMap = {
    feed: { icon: "🍼", label: "האכלה", color: C.peachLight },
    diaper: { icon: "🧷", label: "החתלה", color: C.pinkLight },
    note: { icon: "📝", label: "הערה", color: C.mintLight },
  };
  const t = typeMap[ev.type] || { icon: "•", label: ev.type, color: C.white };

  return (
    <div style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 10, 
        padding: "12px 8px", 
        borderBottom: `1px solid ${C.borderSoft}`,
        background: getUserColor(ev.user),
        borderRadius: 8,
        marginBottom: 4
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {t.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label} {ev.ml ? `(${ev.ml} מ"ל)` : ""}</div>
        <div style={{ fontSize: 11, color: C.textSoft }}>{ev.user} • {fmt(ev.ts)}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} style={{ background: "none", border: "none" }}>✏️</button>
        <button onClick={() => onDelete(ev.id)} style={{ background: "none", border: "none" }}>🗑</button>
      </div>
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────
function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  const [showDiaperQ, setShowDiaperQ] = useState(true); // מתחיל בשאלה על החיתול

  function handleSave() {
    onConfirm({ ml: ml || 0, startTs: Date.now() });
  }

  if (showDiaperQ) return (
    <Modal title="🧷 בדיקה מהירה" onClose={onClose}>
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🧷</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>החלפת חיתול לפני האוכל?</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowDiaperQ(false)} style={{ ...S.primaryBtn, background: C.mint, flex: 1 }}>כן, הכל מוכן ✅</button>
          <button onClick={() => setShowDiaperQ(false)} style={{ ...S.primaryBtn, background: C.peach, flex: 1 }}>אחר כך →</button>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal title="🍼 כמה היא אכלה?" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {[60, 90, 120, 150, 180].map(v => (
          <button key={v} onClick={() => setMl(v)} style={{...S.chip(ml == v), flex: "1 0 30%"}}>{v} מ"ל</button>
        ))}
      </div>
      <input type="number" value={ml} onChange={e => setMl(e.target.value)} placeholder="כמות אחרת..." style={{ ...S.input, marginBottom: 20 }} />
      <button onClick={handleSave} style={S.primaryBtn}>שמור האכלה</button>
    </Modal>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(false);
  const [poop, setPoop] = useState(false);
  return (
    <Modal title="🧷 מה היה בחיתול?" onClose={onClose}>
      <div style={{ display: "flex", gap: 15, marginBottom: 24 }}>
        <button onClick={() => setPee(!pee)} style={{ ...S.chip(pee), flex: 1, padding: 20, fontSize: 18 }}>💧 פיפי</button>
        <button onClick={() => setPoop(!poop)} style={{ ...S.chip(poop), flex: 1, padding: 20, fontSize: 18 }}>💩 קקי</button>
      </div>
      <button onClick={() => onConfirm({ pee, poop })} style={S.primaryBtn} disabled={!pee && !poop}>שמור</button>
    </Modal>
  );
}

function NoteModal({ onConfirm, onClose }) {
  const [tag, setTag] = useState("");
  const [text, setText] = useState("");
  return (
    <Modal title="📝 הערה חדשה" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {NOTE_TAGS.map(t => (
          <button key={t.id} onClick={() => setTag(t.id)} style={S.chip(tag === t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="פרטים נוספים..." style={{ ...S.input, height: 80, marginBottom: 16 }} />
      <button onClick={() => onConfirm({ tag, note: text })} style={S.primaryBtn}>שמור הערה</button>
    </Modal>
  );
}

function EditModal({ ev, onSave, onClose }) {
  const [ml, setMl] = useState(ev.ml || "");
  return (
    <Modal title="עריכה" onClose={onClose}>
      {ev.type === "feed" && <input value={ml} onChange={e => setMl(e.target.value)} style={S.input} />}
      <button onClick={() => onSave({ ml })} style={{...S.primaryBtn, marginTop: 10}}>שמור</button>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Small Components ───────────────────────────────────────────────────────
function ActionBtn({ icon, label, sub, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: color + "20",
      border: `2px solid ${color}`,
      borderRadius: 24, padding: "20px 10px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      width: "100%", cursor: "pointer",
    }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{label}</div>
      <div style={{ fontSize: 12, color: C.textSoft }}>{sub}</div>
    </button>
  );
}

function SummaryCard({ icon, title, value, sub, color, lastVal }) {
  return (
    <div style={{
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 20, padding: "16px",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      boxShadow: `0 2px 8px ${C.shadow}`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.textSoft, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textSoft }}>{sub}</div>
      {lastVal && <div style={{ fontSize: 10, color: color, fontWeight: 700, marginTop: 4 }}>{lastVal}</div>}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: FONT, direction: "rtl", color: C.text, maxWidth: 480, margin: "0 auto" },
  header: { background: C.white, borderBottom: `1px solid ${C.border}`, padding: "16px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 10 },
  content: { flex: 1, padding: "16px 14px 100px", overflowY: "auto" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "10px 0 20px" },
  navBtn: (active) => ({ background: active ? C.pinkLight : "none", border: "none", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 20px", cursor: "pointer" }),
  card: { background: C.white, borderRadius: 24, padding: "18px", border: `1px solid ${C.border}`, boxShadow: `0 4px 12px ${C.shadow}` },
  cardTitle: { fontSize: 15, color: C.pinkDark, marginBottom: 16, fontWeight: 900, textAlign: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: C.white, borderRadius: "30px 30px 0 0", padding: "24px", width: "100%", maxWidth: 480 },
  input: { background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "12px 16px", width: "100%", outline: "none", fontSize: 16, fontWeight: 600 },
  chip: (active) => ({ background: active ? C.pinkDark : C.white, border: `2px solid ${C.pinkDark}`, color: active ? C.white : C.pinkDark, borderRadius: 14, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }),
  primaryBtn: { background: `linear-gradient(135deg, ${C.pink}, ${C.peach})`, color: C.white, border: "none", borderRadius: 18, padding: "16px", fontSize: 16, fontWeight: 800, width: "100%", cursor: "pointer" },
  center: { display: "flex", alignItems: "center", justifyContent: "center" },
};
