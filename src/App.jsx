import { useState, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
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
  success: "#86efac",
  warning: "#fdba74",
  danger: "#fca5a5",
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
function manualTimeToTs(manualTime) {
  if (!manualTime) return Date.now();
  const [hours, minutes] = manualTime.split(':');
  const d = new Date();
  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return d.getTime();
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
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showUndo, setShowUndo] = useState(false);
  const [lastAddedId, setLastAddedId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsubEvents = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qTasks = query(collection(db, "tasks"), orderBy("ts", "asc"));
    const unsubTasks = onSnapshot(qTasks, s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qShop = query(collection(db, "shopping"));
    const unsubShop = onSnapshot(qShop, s => setShopping(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVit = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      setVitaminDone(d.exists() && d.data().lastDate === new Date().toDateString());
    });
    return () => { unsubEvents(); unsubTasks(); unsubShop(); unsubVit(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(50);
    const finalTs = ev.manualTime ? manualTimeToTs(ev.manualTime) : (ev.ts || Date.now());
    const hr = new Date(finalTs).getHours();
    const docRef = await addDoc(collection(db, "events"), { 
      ts: finalTs, user: ev.parent || userName, isNight: hr >= 22 || hr < 6, ...ev 
    });
    setLastAddedId(docRef.id);
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const deleteEvent = async (id, skipConfirm = false) => {
    if (skipConfirm || window.confirm("למחוק?")) await deleteDoc(doc(db, "events", id));
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
          <button onClick={() => deleteEvent(lastAddedId, true)} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>אלה 🌸</div>
        {!vitaminDone && <VitaminWidget onCheck={() => setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() })} now={now} />}
        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onAddNow={addEvent} onDelete={deleteEvent} />}
        {tab === "history" && <WeeklySummary events={events} fullView />}
        {tab === "tasks" && <TasksView tasks={tasks} shopping={shopping} />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 יומן</button>
        <button onClick={() => setTab("tasks")} style={S.navBtn(tab === "tasks")}>📋 ניהול</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function VitaminWidget({ onCheck, now }) {
  const hr = new Date(now).getHours();
  const color = hr < 12 ? C.success : (hr < 17 ? C.warning : C.danger);
  return (
    <div style={{...S.vitaminBar, background: color}} onClick={onCheck}>
      <span>☀️ ויטמין D לאלה</span>
      <input type="checkbox" readOnly checked={false} />
    </div>
  );
}

function MainTimerWidget({ events, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  const diff = lastFeed ? Math.floor((now - lastFeed.ts) / 60000) : null;
  const timeAgo = diff !== null ? (diff < 60 ? `${diff} דק׳` : `${Math.floor(diff/60)}:${(diff%60).toString().padStart(2,'0')} ש׳`) : "--";
  const nextRange = lastFeed ? `${fmtTime(lastFeed.ts + 3.5*3600000)} - ${fmtTime(lastFeed.ts + 4*3600000)}` : "--";
  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 12, fontWeight: 700, color: 'white', opacity: 0.9}}>אכלה לפני ({lastFeed?.user || "?"}):</div>
      <div className="kids-font" style={{fontSize: 30, fontWeight: 900, color: 'white'}}>🍼 {timeAgo}</div>
      <div style={{fontSize: 11, color: 'white', fontWeight: 700, marginTop: 4}}>🎯 יעד הבא: {nextRange}</div>
    </div>
  );
}

function HomeView({ events, setModal, onAddNow, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts));

  return (
    <div style={{display:'flex', flexDirection:'column', gap:15}}>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        <button onClick={() => onAddNow({type:'feed', ml:''})} style={{...S.actionBtn, background:'#fef3c7', color:'#b45309', flex:'1.5'}}>🍼 עכשיו</button>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffbeb', color:'#d97706', fontSize:14}}>🍼 רטרו</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fce7f3', color:'#be185d'}}>🧷 חיתול</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של אלה</div>
        <div style={{display:'flex', gap:10}}>
          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🍼 אוכל</div>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={S.eventTime}>{fmtTime(e.ts)} {e.isNight?'🌙':''}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input 
                    style={S.mlEditInput} 
                    value={e.ml || ""} 
                    placeholder="ML?"
                    onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} 
                  />
                  <span style={{fontSize:9, opacity:0.6}}>{e.user}</span>
                </div>
                {feeds[i+1] && <div style={S.gapIndicator}>↓ {getTimeGap(e.ts, feeds[i+1].ts)} ↓</div>}
              </div>
            ))}
          </div>

          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.pee?"💧":""}{e.poop?"💩":""}</span>
                  <span style={{fontSize:9, opacity:0.6}}>{e.user}</span>
                </div>
                {diapers[i+1] && <div style={S.gapIndicator}>↓ {getTimeGap(e.ts, diapers[i+1].ts)} ↓</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  const [parent, setParent] = useState("אבא");
  const [time, setTime] = useState(() => `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}`);
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font">האכלה רטרו 🍼</h3>
        <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={S.input} />
        <div style={{display:'flex', gap:5, margin:'10px 0'}}>
          {["אמא","אבא"].map(p => <button key={p} onClick={()=>setParent(p)} style={S.chip(parent===p)}>{p}</button>)}
        </div>
        <input type="number" placeholder="כמות ML" value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
        <button onClick={()=>{onConfirm({type:'feed', ml, manualTime:time, parent}); onClose();}} style={{...S.primaryBtn, marginTop:10}}>שמור</button>
      </div>
    </div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  const [time, setTime] = useState(() => `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}`);
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font">החתלה 🧷</h3>
        <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={S.input} />
        <div style={{display:'flex', gap:10, margin:'15px 0'}}>
          <button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
          <button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
        </div>
        <button onClick={()=>{onConfirm({type:'diaper', pee, poop, manualTime:time}); onClose();}} style={S.primaryBtn}>שמור</button>
      </div>
    </div>
  );
}

function TasksView({ tasks, shopping }) {
  const [shopItem, setShopItem] = useState("");
  const [shopQty, setShopQty] = useState("");
  const [shopNote, setShopNote] = useState("");
  const [isOther, setIsOther] = useState(false);

  const addShop = async (item) => {
    await addDoc(collection(db, "shopping"), { item, qty: shopQty || 1, note: shopNote });
    setShopItem(""); setShopQty(""); setShopNote(""); setIsOther(false);
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:15}}>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>🛒 קניות והשלמות</div>
        <div style={{display:'flex', gap:5, flexWrap:'wrap', marginBottom:10}}>
          {["נוטרילון", "מגבונים", "חיתולים"].map(i => <button key={i} onClick={()=>addDoc(collection(db,"shopping"),{item:i, qty:1})} style={S.chip(false)}>{i}+</button>)}
          <button onClick={()=>setIsOther(true)} style={S.chip(isOther)}>➕ אחר</button>
        </div>
        {isOther && (
          <div style={{background:'#f9fafb', padding:10, borderRadius:10, marginBottom:10}}>
            <input placeholder="מה חסר?" value={shopItem} onChange={e=>setShopItem(e.target.value)} style={{...S.input, marginBottom:5}} />
            <div style={{display:'flex', gap:5}}>
              <input placeholder="כמות" value={shopQty} onChange={e=>setShopQty(e.target.value)} style={S.input} />
              <input placeholder="הערות" value={shopNote} onChange={e=>setShopNote(e.target.value)} style={S.input} />
            </div>
            <button onClick={()=>addShop(shopItem)} style={{...S.primaryBtn, marginTop:5, padding:8}}>הוסף לרשימה</button>
          </div>
        )}
        {shopping.map(s => (
          <div key={s.id} style={S.summaryRow}>
            <span><b>{s.item}</b> {s.qty > 1 && `(${s.qty})`} <small>{s.note}</small></span>
            <button onClick={()=>deleteDoc(doc(db,"shopping",s.id))} style={{background:C.success, border:'none', borderRadius:5, padding:'2px 8px'}}>נרכש ✓</button>
          </div>
        ))}
      </div>
      
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>📅 משימות פתוחות</div>
        {/* לוגיקת המשימות נשארת כפי שביקשת קודם עם טיפת חלב והערות */}
        {tasks.map(t => {
          const days = Math.ceil((t.ts - Date.now())/86400000);
          return (
            <div key={t.id} style={S.summaryRow}>
              <div><b>{t.type}</b> <small>({t.note})</small></div>
              <div style={{color: days < 3 ? 'red' : 'green'}}>עוד {days} ימים</div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function WeeklySummary({ events }) {
  return <div style={S.card}><div className="kids-font" style={S.cardTitle}>היסטוריה (בקרוב)</div></div>;
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "15px 20px 25px", borderRadius: "0 0 40px 40px", textAlign: "center", zIndex: 10 },
  greeting: { fontSize: 13, color: "white", opacity: 0.8 },
  babyBadge: { fontSize: 32, color: "white", fontWeight: 800, marginBottom: 8 },
  vitaminBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 15px', borderRadius:'12px', color:'white', fontWeight:800, marginBottom:10, fontSize:14 },
  mainWidget: { background: "rgba(255,255,255,0.22)", padding: "10px", borderRadius: "20px", display:'inline-block', width:'100%', maxWidth:300 },
  content: { flex: 1, overflowY: "auto", padding: "15px 12px 100px" },
  actionBtn: { border: "none", padding: "15px", borderRadius: "15px", fontWeight: 800, fontFamily: FONT_KIDS, fontSize: 16 },
  card: { background: "white", borderRadius: "22px", padding: "15px", border: `1px solid ${C.border}`, marginBottom: 15 },
  cardTitle: { fontSize: 17, fontWeight: 800, marginBottom: 12, color: C.peachDark, textAlign:'center' },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 13, padding: "6px", background: "#fff5f0", borderRadius: "8px", color: C.peachDark },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px", borderRadius: "12px", border: "1px solid #f1f5f9" },
  gapIndicator: { textAlign: "center", fontSize: 10, color: C.textMuted, margin: "2px 0", fontWeight: 700 },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.03)', borderRadius:5, textAlign:'center', fontWeight:800, fontSize:14, padding:2, marginTop:4 },
  delBtn: { background:'none', border:'none', color: '#ccc', fontSize: 12 },
  eventTime: { fontSize: 11, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 15, fontWeight: 700 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", borderTop: `1px solid ${C.border}`, padding: "10px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "10px", borderRadius: "12px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  input: { width: "100%", padding: "10px", borderRadius: "10px", border: `1px solid ${C.border}`, fontSize:16 },
  primaryBtn: { width: "100%", padding: "12px", borderRadius: "15px", background: C.peach, color: "white", border: "none", fontWeight: 800 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "white", padding: "20px", borderRadius: "25px", width: "100%", maxWidth: 340 },
  chip: (active) => ({ padding: "8px 12px", borderRadius: "10px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700 }),
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dotted #eee', fontSize:14 }
};
