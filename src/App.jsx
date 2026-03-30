import { useState, useEffect } from "react";
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
  blueSoft: "#e0f2fe",
  creamSoft: "#fff7ed",
  text: "#4a2c2a",
  textSoft: "#8c6d6a",
  success: "#86efac", // ירוק נעים
  warning: "#fdba74", // כתום נעים
  danger: "#fca5a5",  // אדום נעים
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function getDayName(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function getTimeGap(ts1, ts2) {
  const diff = Math.abs(ts1 - ts2);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}:${rm < 10 ? '0'+rm : rm} ש׳` : `${h} ש׳`;
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [vitaminDone, setVitaminDone] = useState(false);
  const [tab, setTab] = useState("home");
  const [userName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [now, setNow] = useState(Date.now());
  const [showUndo, setShowUndo] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync Events, Tasks, Shopping & Vitamin
  useEffect(() => {
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsubEvents = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qTasks = query(collection(db, "tasks"));
    const unsubTasks = onSnapshot(qTasks, s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qShop = query(collection(db, "shopping"));
    const unsubShop = onSnapshot(qShop, s => setShopping(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const todayStr = new Date().toDateString();
    const unsubVitamin = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      if (d.exists() && d.data().lastDate === todayStr) setVitaminDone(true);
      else setVitaminDone(false);
    });

    return () => { unsubEvents(); unsubTasks(); unsubShop(); unsubVitamin(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(50);
    const ts = ev.ts || Date.now();
    const hr = new Date(ts).getHours();
    const docRef = await addDoc(collection(db, "events"), { 
      ts, user: userName, isNight: hr >= 22 || hr < 6, ...ev 
    });
    setLastAddedId(docRef.id);
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const updateEventMl = async (id, newMl) => {
    await updateDoc(doc(db, "events", id), { ml: newMl });
  };

  const markVitamin = async () => {
    if ("vibrate" in navigator) navigator.vibrate([30, 50, 30]);
    await setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() });
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        button:active { transform: scale(0.96); }
        .kids-font { font-family: ${FONT_KIDS} !important; }
        .undo-toast { position: fixed; bottom: 90px; left: 20px; right: 20px; background: #333; color: white; padding: 12px; border-radius: 15px; display: flex; justify-content: space-between; z-index: 1000; }
      `}</style>

      {showUndo && (
        <div className="undo-toast">
          <span>עודכן בהצלחה!</span>
          <button onClick={async () => { await deleteDoc(doc(db, "events", lastAddedId)); setShowUndo(false); }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>אלה 🌸</div>
        
        {!vitaminDone && <VitaminWidget onCheck={markVitamin} now={now} />}
        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} onAdd={addEvent} onUpdateMl={updateEventMl} onDelete={id => deleteDoc(doc(db, "events", id))} />}
        {tab === "history" && <WeeklySummary events={events} fullView />}
        {tab === "tasks" && <TasksView tasks={tasks} shopping={shopping} />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 יומן</button>
        <button onClick={() => setTab("tasks")} style={S.navBtn(tab === "tasks")}>📋 ניהול</button>
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function VitaminWidget({ onCheck, now }) {
  const hour = new Date(now).getHours();
  let color = C.success;
  if (hour >= 12 && hour < 17) color = C.warning;
  if (hour >= 17) color = C.danger;

  return (
    <div style={{...S.vitaminBar, background: color}} onClick={onCheck}>
      <span>☀️ תזכורת: ויטמין D לאלה</span>
      <input type="checkbox" readOnly checked={false} style={{transform: 'scale(1.5)'}} />
    </div>
  );
}

function MainTimerWidget({ events, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  const timeAgo = (ts) => {
    if (!ts) return "--";
    const diff = Math.floor((now - ts) / 60000);
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h} ש׳ ו-${m} דק׳` : `${m} דק׳`;
  };
  const nextFeed = lastFeed ? `${fmtTime(lastFeed.ts + 3.5*3600000)} - ${fmtTime(lastFeed.ts + 4*3600000)}` : "--";

  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 12, fontWeight: 700, color: 'white', opacity: 0.9}}>אכלה לפני ({lastFeed?.user || "?"}):</div>
      <div className="kids-font" style={{fontSize: 30, fontWeight: 900, color: 'white'}}>🍼 {timeAgo(lastFeed?.ts)}</div>
      <div style={{fontSize: 12, color: 'white', fontWeight: 700}}>🎯 ארוחה הבאה: {nextFeed}</div>
    </div>
  );
}

function HomeView({ events, onAdd, onUpdateMl, onDelete }) {
  const today = events.filter(e => new Date(e.ts).toDateString() === new Date().toDateString());
  const feeds = today.filter(e => e.type === "feed");

  return (
    <div style={{display:'flex', flexDirection:'column', gap:15}}>
      <div style={{display:'flex', gap:10}}>
        <button onClick={() => onAdd({type:'feed', ml:''})} style={{...S.actionBtn, background:'#fef3c7', color:'#b45309'}}>🍼 האכלה (עכשיו)</button>
        <button onClick={() => onAdd({type:'diaper', pee:true})} style={{...S.actionBtn, background:'#fce7f3', color:'#be185d'}}>🧷 חיתול</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של אלה</div>
        {feeds.map((e, i) => (
          <div key={e.id} style={S.eventRow}>
             <div style={{display:'flex', alignItems:'center', gap:10}}>
                <span style={{fontWeight:800}}>{fmtTime(e.ts)} {e.isNight ? '🌙' : ''}</span>
                <input 
                  type="number" 
                  placeholder="כמה ML?" 
                  value={e.ml || ""} 
                  onChange={(el) => onUpdateMl(e.id, el.target.value)}
                  style={S.mlInput}
                />
                <span style={{fontSize:11, opacity:0.6}}>{e.user}</span>
             </div>
             <button onClick={() => onDelete(e.id)} style={{border:'none', background:'none', color:'#ccc'}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksView({ tasks, shopping }) {
  const [taskType, setTaskType] = useState("טיפת חלב");
  const [taskNote, setTaskNote] = useState("");
  const [taskDate, setTaskDate] = useState("");

  const addTask = async () => {
    await addDoc(collection(db, "tasks"), { type: taskType, note: taskNote, date: taskDate, ts: new Date(taskDate).getTime() });
    setTaskNote(""); setTaskDate("");
  };

  const addShop = async (item) => {
    await addDoc(collection(db, "shopping"), { item, qty: 1 });
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>📅 משימות פתוחות</div>
        <div style={{display:'flex', gap:5, marginBottom:10}}>
          <select value={taskType} onChange={e=>setTaskType(e.target.value)} style={S.input}>
            <option>טיפת חלב</option>
            <option>בדיקת רופא</option>
            <option>חיסון</option>
            <option>אחר</option>
          </select>
          <input type="date" value={taskDate} onChange={e=>setTaskDate(e.target.value)} style={S.input} />
        </div>
        <input placeholder="הערות..." value={taskNote} onChange={e=>setTaskNote(e.target.value)} style={{...S.input, marginBottom:10}} />
        <button onClick={addTask} style={S.primaryBtn}>הוסף משימה</button>
        
        {tasks.map(t => {
          const daysLeft = Math.ceil((new Date(t.date).getTime() - Date.now()) / 86400000);
          return (
            <div key={t.id} style={S.summaryRow}>
               <div style={{fontWeight:800}}>{t.type}</div>
               <div style={{fontSize:12, color: daysLeft < 3 ? 'red' : 'green'}}>עוד {daysLeft} ימים</div>
               <div style={{fontSize:11}}>{t.note}</div>
               <button onClick={()=>deleteDoc(doc(db,"tasks",t.id))} style={{border:'none', background:'none'}}>🗑️</button>
            </div>
          )
        })}
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>🛒 השלמות וקניות</div>
        <div style={{display:'flex', flexWrap:'wrap', gap:5, marginBottom:15}}>
          {["נוטרילון", "מגבונים", "חיתולים", "סופר פארם"].map(i => (
            <button key={i} onClick={() => addShop(i)} style={S.chip(false)}>{i} +</button>
          ))}
        </div>
        {shopping.map(s => (
          <div key={s.id} style={{...S.summaryRow, background:'#f0fdf4', padding:'10px', borderRadius:'10px', marginBottom:5}}>
            <span style={{fontWeight:800}}>{s.item}</span>
            <button onClick={()=>deleteDoc(doc(db,"shopping",s.id))} style={{background:C.peach, color:'white', border:'none', borderRadius:'5px', padding:'2px 8px'}}>נרכש ✓</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklySummary({ events, fullView }) {
  // קוד קיים מהגרסה הקודמת לסיכום שבועי
  return <div style={S.card}><div className="kids-font" style={S.cardTitle}>בקרוב: יומן היסטוריה מלא</div></div>;
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "20px", borderRadius: "0 0 40px 40px", textAlign: "center", zIndex: 10 },
  greeting: { fontSize: 13, color: "white", opacity: 0.8 },
  babyBadge: { fontSize: 32, color: "white", fontWeight: 800, marginBottom: 10 },
  vitaminBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 20px', borderRadius:'15px', color:'white', fontWeight:800, marginBottom:10, cursor:'pointer' },
  mainWidget: { background: "rgba(255,255,255,0.2)", padding: "12px", borderRadius: "20px", width: "100%", maxWidth: "300px", display:'inline-block' },
  content: { flex: 1, overflowY: "auto", padding: "15px 15px 100px" },
  actionBtn: { flex: 1, border: "none", padding: "15px", borderRadius: "15px", fontWeight: 800, fontFamily: FONT_KIDS },
  card: { background: "white", borderRadius: "20px", padding: "15px", border: `1px solid ${C.border}`, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 12, color: C.peachDark },
  eventRow: { display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #eee' },
  mlInput: { width: '80px', padding: '5px', borderRadius: '8px', border: `1px solid ${C.border}`, textAlign: 'center', fontWeight: 800 },
  input: { flex: 1, padding: "10px", borderRadius: "10px", border: `1px solid ${C.border}` },
  primaryBtn: { width: "100%", padding: "12px", borderRadius: "15px", background: C.peach, color: "white", border: "none", fontWeight: 800 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", borderTop: `1px solid ${C.border}`, padding: "10px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "10px", borderRadius: "12px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dotted #eee' },
  chip: (active) => ({ padding: "8px 12px", borderRadius: "10px", border: "1px solid #ddd", background: "white", fontWeight: 700, fontSize: 12 }),
};
