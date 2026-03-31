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
  peach: "#f4a58a",
  peachDark: "#e8845e",
  blueSoft: "#e0f2fe",
  creamSoft: "#fff7ed",
  text: "#4a2c2a",
  textSoft: "#8c6d6a",
  success: "#86efac",
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [vouchers, setVouchers] = useState([]);
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
    
    const qShop = query(collection(db, "shopping"), orderBy("createdAt", "desc"));
    const unsubShop = onSnapshot(qShop, s => setShopping(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qVouch = query(collection(db, "vouchers"));
    const unsubVouch = onSnapshot(qVouch, s => setVouchers(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsubVit = onSnapshot(doc(db, "settings", "vitaminD"), d => {
      setVitaminDone(d.exists() && d.data().lastDate === new Date().toDateString());
    });
    return () => { unsubEvents(); unsubShop(); unsubVouch(); unsubVit(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    const finalTs = Date.now();
    const docRef = await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
    setUndoAction({ type: 'event', id: docRef.id });
    setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
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
          <button onClick={async () => { if(undoAction.type==='event') await deleteDoc(doc(db,"events",undoAction.id)); setShowUndo(false); }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>אלה 🌸</div>
        {!vitaminDone && <div style={S.vitaminBar} onClick={() => setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() })}>☀️ ויטמין D לאלה ✅</div>}
        <MainTimerWidget events={events} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "history" && <WeeklySummary events={events} />}
        {tab === "tasks" && <ManagementView shopping={shopping} vouchers={vouchers} />}
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

function MainTimerWidget({ events, now }) {
  const lastFeed = events.find(e => e.type === "feed");
  const diff = lastFeed ? Math.floor((now - lastFeed.ts) / 60000) : 0;
  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 12, fontWeight: 700, color: 'white', opacity: 0.9}}>אכלה לפני:</div>
      <div className="kids-font" style={{fontSize: 34, fontWeight: 900, color: 'white'}}>🍼 {diff} דק׳</div>
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
            {feeds.map(e => <div key={e.id} style={S.miniCard}>{new Date(e.ts).getHours()}:{new Date(e.ts).getMinutes().toString().padStart(2,'0')} | {e.ml} מ"ל <button onClick={()=>onDelete(e.id)} style={{border:'none', background:'none'}}>✕</button></div>)}
          </div>
          <div style={S.column}><div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diapers.map(e => <div key={e.id} style={S.miniCard}>{new Date(e.ts).getHours()}:{new Date(e.ts).getMinutes().toString().padStart(2,'0')} | {e.pee?"💧":""}{e.poop?"💩":""}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MANAGEMENT VIEW (Shopping & Vouchers) ──────────────────────────────────
function ManagementView({ shopping, vouchers }) {
  const [newShop, setNewShop] = useState({ item: "נוטרילון", qty: "1", other: "" });
  const [newVouch, setNewVouch] = useState({ name: "", balance: "" });

  const addShop = async () => {
    const item = newShop.item === "אחר" ? newShop.other : newShop.item;
    await addDoc(collection(db, "shopping"), { item, qty: newShop.qty, createdAt: Date.now() });
    setNewShop({ item: "נוטרילון", qty: "1", other: "" });
  };

  const addVouch = async () => {
    await addDoc(collection(db, "vouchers"), { name: newVouch.name, balance: newVouch.balance });
    setNewVouch({ name: "", balance: "" });
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      {/* טבלת קניות */}
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>🛒 השלמות וקניות</div>
        <div style={{display:'flex', gap:5, marginBottom:10}}>
          <select value={newShop.item} onChange={e=>setNewShop({...newShop, item:e.target.value})} style={S.input}>
            <option>נוטרילון</option><option>מגבונים</option><option>חיתולים</option><option>אחר</option>
          </select>
          <select value={newShop.qty} onChange={e=>setNewShop({...newShop, qty:e.target.value})} style={{...S.input, width:70}}>
            {[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
        {newShop.item === "אחר" && <input placeholder="שם המוצר..." value={newShop.other} onChange={e=>setNewShop({...newShop, other:e.target.value})} style={{...S.input, marginBottom:10}} />}
        <button onClick={addShop} style={S.primaryBtn}>הוסף לסל</button>
        {shopping.map(s => (
          <div key={s.id} style={S.itemRow}>
            <span><b>{s.item}</b> (x{s.qty})</span>
            <button onClick={()=>deleteDoc(doc(db,"shopping",s.id))} style={S.doneBtn}>נרכש ✓</button>
          </div>
        ))}
      </div>

      {/* מעקב תווים */}
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>🎫 מעקב תווים</div>
        <div style={{display:'flex', gap:5, marginBottom:10}}>
          <input placeholder="סוג התו" value={newVouch.name} onChange={e=>setNewVouch({...newVouch, name:e.target.value})} style={S.input} />
          <input placeholder="יתרה" type="number" value={newVouch.balance} onChange={e=>setNewVouch({...newVouch, balance:e.target.value})} style={{...S.input, width:100}} />
          <button onClick={addVouch} style={{...S.primaryBtn, width:60}}>+</button>
        </div>
        <table style={{width:'100%', borderCollapse:'collapse', marginTop:10}}>
          <thead><tr style={{textAlign:'right', fontSize:12, color:C.textSoft}}><th style={{padding:5}}>סוג</th><th style={{padding:5}}>יתרה</th><th style={{padding:5}}>✕</th></tr></thead>
          <tbody>
            {vouchers.map(v => (
              <tr key={v.id} style={{borderBottom:'1px solid #eee'}}>
                <td style={{padding:8, fontWeight:700}}>{v.name}</td>
                <td style={{padding:8}}>
                  <input 
                    type="number" 
                    value={v.balance} 
                    onChange={(e)=>updateDoc(doc(db,"vouchers",v.id), {balance: e.target.value})} 
                    style={{width:70, padding:5, border:'1px solid #ddd', borderRadius:5, fontWeight:800}}
                  />
                </td>
                <td><button onClick={()=>deleteDoc(doc(db,"vouchers",v.id))} style={{border:'none', background:'none'}}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────
function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font">האכלה 🍼</h3>
      <input type="number" placeholder="כמות ML" value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml}); onClose();}} style={{...S.primaryBtn, marginTop:10}}>שמור</button>
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
  return <div style={S.card}><div className="kids-font" style={S.cardTitle}>היסטוריה תופיע כאן</div></div>;
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "40px 20px 25px", borderRadius: "0 0 40px 40px", textAlign: "center", zIndex: 10 },
  greeting: { fontSize: 13, color: "white", opacity: 0.8 },
  babyBadge: { fontSize: 36, color: "white", fontWeight: 800, marginBottom: 15 },
  vitaminBar: { background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '15px', color: 'white', fontWeight: 800, marginBottom: 12, cursor: 'pointer', textAlign: 'center' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", padding: "15px", borderRadius: "25px", width: "100%", maxWidth: "300px", display: 'inline-block' },
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 100px" },
  actionBtn: { flex: 1, border: "none", padding: "18px", borderRadius: "20px", fontSize: 18, fontWeight: 800, fontFamily: FONT_KIDS },
  card: { background: "white", borderRadius: "25px", padding: "20px", border: `1px solid ${C.border}`, marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 15, color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 13, padding: "6px", background: "#fff5f0", borderRadius: "8px", color: C.peachDark },
  miniCard: { padding: '8px', border: '1px solid #f0f0f0', borderRadius: '10px', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between' },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", borderTop: `1px solid ${C.border}`, padding: "10px" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "15px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  input: { width: "100%", padding: "10px", borderRadius: "10px", border: `1px solid ${C.border}`, fontWeight: 700 },
  primaryBtn: { width: "100%", padding: "12px", borderRadius: "15px", background: C.peach, color: "white", border: "none", fontWeight: 800 },
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dotted #eee' },
  doneBtn: { background: C.success, border: 'none', borderRadius: '8px', padding: '5px 10px', fontWeight: 800, fontSize: 12 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "white", padding: "25px", borderRadius: "30px", width: "90%", maxWidth: 350 },
  chip: (active) => ({ flex: 1, padding: "10px", borderRadius: "10px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700 }),
};
