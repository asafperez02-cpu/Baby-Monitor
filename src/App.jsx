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
  priority: { 1: "#fee2e2", 2: "#ffedd5", 3: "#f0fdf4" }, // אדום, כתום, ירוק
  priorityText: { 1: "#991b1b", 2: "#9a3412", 3: "#166534" }
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
  const [shopping, setShopping] = useState([]);
  const [vitaminDone, setVitaminDone] = useState(false);
  const [tab, setTab] = useState("home");
  const [userName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showUndo, setShowUndo] = useState(false);
  const [undoAction, setUndoAction] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsubEvents = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qShop = query(collection(db, "shopping"), orderBy("priority", "asc"), orderBy("createdAt", "desc"));
    const unsubShop = onSnapshot(qShop, s => setShopping(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubVit = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      setVitaminDone(d.exists() && d.data().lastDate === new Date().toDateString());
    });
    return () => { unsubEvents(); unsubShop(); unsubVit(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    const finalTs = ev.manualTime ? manualTimeToTs(ev.manualTime) : Date.now();
    const hr = new Date(finalTs).getHours();
    const docRef = await addDoc(collection(db, "events"), { 
      ts: finalTs, user: ev.parent || userName, isNight: hr >= 22 || hr < 6, ...ev 
    });
    setUndoAction({ type: 'event', id: docRef.id });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const markVitamin = async () => {
    await setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() });
    setUndoAction({ type: 'vitamin' });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const handleUndo = async () => {
    if (undoAction.type === 'event') await deleteDoc(doc(db, "events", undoAction.id));
    if (undoAction.type === 'vitamin') await setDoc(doc(db, "settings", "vitaminD"), { lastDate: "" });
    setShowUndo(false);
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;800&family=Varela+Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
        .undo-toast { position: fixed; bottom: 95px; left: 20px; right: 20px; background: #333; color: white; padding: 14px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; }
      `}</style>

      {showUndo && (
        <div className="undo-toast">
          <span>עודכן בהצלחה! ✨</span>
          <button onClick={handleUndo} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>אלה 🌸</div>
        {!vitaminDone && <div style={{...S.vitaminBar, background: (new Date(now).getHours() < 12 ? C.success : C.warning)}} onClick={markVitamin}>☀️ ויטמין D לאלה ✅</div>}
        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "history" && <WeeklySummary events={events} />}
        {tab === "tasks" && <ShoppingManagement shopping={shopping} />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("history")} style={S.navBtn(tab === "history")}>📅 יומן</button>
        <button onClick={() => setTab("tasks")} style={S.navBtn(tab === "tasks")}>🛒 השלמות</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  const lastDiaper = events.find(e => e.type === "diaper");
  const timeAgo = (ts) => {
    if (!ts) return "--";
    const diff = Math.floor((now - ts) / 60000);
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `${h} ש׳ ו-${m} דק׳` : `${m} דק׳`;
  };
  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 12, fontWeight: 700, color: 'white', opacity: 0.9}}>אכלה לפני ({lastFeed?.user || "?"}):</div>
      <div className="kids-font" style={{fontSize: 34, fontWeight: 900, color: 'white'}}>🍼 {timeAgo(lastFeed?.ts)}</div>
      <div style={S.subTimer}>⏳ הוחלפה לפני {timeAgo(lastDiaper?.ts)}</div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts));

  return (
    <div style={{display:'flex', flexDirection:'column', gap:15}}>
      <div style={{display:'flex', gap:12}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fef3c7', color:'#b45309'}}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fce7f3', color:'#be185d'}}>🧷 החתלה</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של אלה</div>
        <div style={{display:'flex', gap:10}}>
          <div style={S.column}><div className="kids-font" style={S.columnHeader}>🍼 אוכל</div>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span style={S.eventTime}>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <input style={S.mlEditInput} value={e.ml || ""} onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} />
                </div>
                {feeds[i+1] && <div style={S.gapIndicator}>↓ {getTimeGap(e.ts, feeds[i+1].ts)} ↓</div>}
              </div>
            ))}
          </div>
          <div style={S.column}><div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: e.user === "אבא" ? C.blueSoft : C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}><span style={S.eventTime}>{fmtTime(e.ts)}</span><button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button></div>
                  <span style={S.eventDetail}>{e.pee?"💧":""}{e.poop?"💩":""}</span>
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

// ── NEW: Shopping Management (Lishonit Nihul) ──────────────────────────────
function ShoppingManagement({ shopping }) {
  const [form, setForm] = useState({ product: "נוטרילון", qty: "1", hasVoucher: "לא", voucherType: "", priority: "3", note: "" });
  const [isAdding, setIsAdding] = useState(false);

  const saveItem = async () => {
    await addDoc(collection(db, "shopping"), { ...form, createdAt: Date.now(), priority: Number(form.priority) });
    setForm({ product: "נוטרילון", qty: "1", hasVoucher: "לא", voucherType: "", priority: "3", note: "" });
    setIsAdding(false);
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:15}}>
      <div style={S.card}>
        <div className="kids-font" style={{...S.cardTitle, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          🛒 השלמות וקניות
          <button onClick={() => setIsAdding(!isAdding)} style={{background:C.peach, border:'none', color:'white', borderRadius:'50%', width:35, height:35, fontSize:22}}>{isAdding ? '✕' : '+'}</button>
        </div>

        {isAdding && (
          <div style={S.addForm}>
            <div style={S.formRow}>
              <select value={form.product} onChange={e=>setForm({...form, product:e.target.value})} style={S.input}>
                <option>נוטרילון</option><option>מגבונים</option><option>חיתולים</option><option value="other">אחר...</option>
              </select>
              {form.product === "other" && <input placeholder="שם המוצר" onChange={e=>setForm({...form, otherName: e.target.value})} style={S.input} />}
            </div>
            
            <div style={S.formRow}>
              <div style={{flex:1}}>
                <label style={S.label}>כמות</label>
                <select value={form.qty} onChange={e=>setForm({...form, qty:e.target.value})} style={S.input}>
                  {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div style={{flex:2}}>
                <label style={S.label}>דחיפות</label>
                <select value={form.priority} onChange={e=>setForm({...form, priority:e.target.value})} style={S.input}>
                  <option value="1">🔴 גבוהה (אדום)</option>
                  <option value="2">🟠 בינונית (כתום)</option>
                  <option value="3">🟢 רגילה (ירוק)</option>
                </select>
              </div>
            </div>

            <div style={S.formRow}>
              <div style={{flex:1}}>
                <label style={S.label}>יש תווים?</label>
                <select value={form.hasVoucher} onChange={e=>setForm({...form, hasVoucher:e.target.value})} style={S.input}>
                  <option>לא</option><option>כן</option>
                </select>
              </div>
              {form.hasVoucher === "כן" && (
                <div style={{flex:2}}>
                  <label style={S.label}>איזה תווים?</label>
                  <input placeholder="למשל: תווי הזהב" value={form.voucherType} onChange={e=>setForm({...form, voucherType:e.target.value})} style={S.input} />
                </div>
              )}
            </div>

            <input placeholder="הערות נוספות" value={form.note} onChange={e=>setForm({...form, note:e.target.value})} style={S.input} />
            <button onClick={saveItem} style={S.primaryBtn}>הוסף לרשימה</button>
          </div>
        )}

        <div style={{marginTop:15, display:'flex', flexDirection:'column', gap:10}}>
          {shopping.map(item => (
            <div key={item.id} style={{...S.shopCard, borderRight: `8px solid ${C.priorityText[item.priority] || C.peach}`}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                  <div style={{fontWeight:800, fontSize:17}}>{item.product === 'other' ? item.otherName : item.product} <span style={{color:C.textSoft, fontSize:14}}>(x{item.qty})</span></div>
                  {item.hasVoucher === "כן" && <div style={S.voucherBadge}>🎫 {item.voucherType || "יש תווים"}</div>}
                  {item.note && <div style={{fontSize:13, marginTop:4, color:C.textSoft}}>📝 {item.note}</div>}
                </div>
                <button onClick={()=>deleteDoc(doc(db,"shopping",item.id))} style={S.purchasedBtn}>נרכש ✓</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared Modals & Summary ──────────────────────────────────────────────────
function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  const [timeMode, setTimeMode] = useState("now");
  const [manualTime, setManualTime] = useState(() => `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}`);
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font">האכלה 🍼</h3>
      <div style={{display:'flex', gap:5, marginBottom:10}}><button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button><button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button></div>
      {timeMode === "manual" && <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} style={S.input} />}
      <input type="number" placeholder="כמות ML" value={ml} onChange={e=>setMl(e.target.value)} style={{...S.input, marginTop:10}} />
      <button onClick={()=>{onConfirm({type:'feed', ml, manualTime: timeMode==="manual"?manualTime:null}); onClose();}} style={{...S.primaryBtn, marginTop:10}}>שמור</button>
    </div></div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font">החתלה 🧷</h3>
      <div style={{display:'flex', gap:10, marginBottom:20}}><button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button><button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button></div>
      <button onClick={()=>{onConfirm({type:'diaper', pee, poop}); onClose();}} style={S.primaryBtn}>שמור</button>
    </div></div>
  );
}

function WeeklySummary({ events }) {
  const days = {};
  events.forEach(e => {
    const d = new Date(e.ts).toDateString();
    if (!days[d]) days[d] = { ts: e.ts, ml: 0, diapers: 0 };
    if (e.type === "feed") days[d].ml += Number(e.ml || 0);
    if (e.type === "diaper") days[d].diapers += 1;
  });
  const sorted = Object.values(days).sort((a,b)=>b.ts-a.ts).slice(0, 7);
  return (
    <div style={S.card}>
      <div className="kids-font" style={S.cardTitle}>יומן שבועי</div>
      {sorted.map(d => (
        <div key={d.ts} style={{...S.summaryRow, padding:'12px 0'}}>
          <div style={{fontWeight:800, width:95}}>{getDayName(d.ts)}</div>
          <div style={{flex:1, color:C.peachDark}}>🍼 {d.ml} מ"ל</div>
          <div style={{flex:1, color:C.pinkDark}}>🧷 {d.diapers}</div>
        </div>
      ))}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "40px 20px 25px", borderRadius: "0 0 45px 45px", textAlign: "center", zIndex: 10 },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.85, marginBottom: 5 },
  babyBadge: { fontSize: 36, color: "white", fontWeight: 800, marginBottom: 15 },
  vitaminBar: { padding:'10px', borderRadius:'15px', color:'white', fontWeight:800, marginBottom:12, fontSize:14, cursor:'pointer', background:'rgba(255,255,255,0.2)' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(12px)", borderRadius: "25px", padding: "15px", border: "1px solid rgba(255, 255, 255, 0.3)", width: "100%", maxWidth: "300px", display:'inline-block' },
  subTimer: { marginTop: 8, fontSize: 12, fontWeight: 700, color: "white", background: "rgba(0,0,0,0.1)", padding: "4px 12px", borderRadius: "20px" },
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 100px" },
  actionBtn: { flex: 1, border: "none", padding: "18px", borderRadius: "20px", fontSize: 18, fontWeight: 800, fontFamily: FONT_KIDS },
  card: { background: "white", borderRadius: "25px", padding: "20px", border: `1px solid ${C.border}`, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 15, color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 10 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 13, padding: "8px", background: "#fff5f0", borderRadius: "10px", color: C.peachDark },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", borderRadius: "15px", border: "1px solid #f1f5f9" },
  gapIndicator: { textAlign: "center", fontSize: 11, color: C.textSoft, margin: "5px 0", fontWeight: 700 },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:6, textAlign:'center', fontWeight:800, fontSize:14, padding:4, marginTop:5 },
  delBtn: { background:'none', border:'none', color: '#ccc', fontSize: 14 },
  eventTime: { fontSize: 11, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 15, fontWeight: 700 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", borderTop: `1px solid ${C.border}`, padding: "10px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "15px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  input: { width: "100%", padding: "12px", borderRadius: "12px", border: `2px solid ${C.border}`, fontSize: 16, fontWeight: 700, marginBottom: 8, background: '#fff' },
  label: { fontSize: 12, fontWeight: 800, color: C.textSoft, display:'block', marginBottom:4, marginRight:5 },
  formRow: { display:'flex', gap:10, marginBottom:5 },
  primaryBtn: { width: "100%", padding: "15px", borderRadius: "20px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 18 },
  shopCard: { background: "#fff", padding: "15px", borderRadius: "15px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: `1px solid ${C.border}` },
  voucherBadge: { display:'inline-block', background: C.blueSoft, color: '#0369a1', padding: '2px 8px', borderRadius: '8px', fontSize: 12, fontWeight: 800, marginTop: 5 },
  purchasedBtn: { background: C.success, border:'none', borderRadius:'10px', padding:'8px 12px', fontWeight:800, fontSize:13 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 100 },
  modal: { background: "white", padding: "25px", borderRadius: "30px", width: "100%", maxWidth: 350 },
  chip: (active) => ({ flex: 1, padding: "10px", borderRadius: "10px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700 }),
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px dotted #eee' },
  addForm: { background: '#fef3c733', padding: '15px', borderRadius: '20px', border: `1px dashed ${C.peach}` }
};
