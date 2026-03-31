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
  warning: "#fdba74",
  danger: "#fca5a5",
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
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
    let finalTs = Date.now();
    if (ev.manualTime) {
      const [h, m] = ev.manualTime.split(':');
      const d = new Date();
      d.setHours(h, m, 0, 0);
      finalTs = d.getTime();
    }
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
        .undo-toast { position: fixed; bottom: 95px; left: 20px; right: 20px; background: #333; color: white; padding: 14px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
      `}</style>

      {showUndo && (
        <div className="undo-toast">
          <span>עודכן בהצלחה! ✨</span>
          <button onClick={async () => { 
            if(undoAction.type==='event') await deleteDoc(doc(db,"events",undoAction.id));
            else await setDoc(doc(db, "settings", "vitaminD"), { lastDate: "" });
            setShowUndo(false); 
          }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל (Undo)</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={S.greeting}>שלום {userName} 👋</div>
        <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        {!vitaminDone && (
          <div style={{...S.vitaminBar, background: (new Date(now).getHours() < 12 ? C.success : C.warning)}} onClick={() => {
            setDoc(doc(db, "settings", "vitaminD"), { lastDate: new Date().toDateString() });
            setUndoAction({ type: 'vitamin' });
            setShowUndo(true);
            setTimeout(() => setShowUndo(false), 5000);
          }}>
            <span>☀️ ויטמין D לעלמה</span>
            <input type="checkbox" readOnly checked={false} style={{transform: 'scale(1.2)'}} />
          </div>
        )}
        <MainTimerWidget events={events} now={now} onOpenFutureFeeds={() => setModal("futureFeeds")} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "tasks" && <ManagementView shopping={shopping} vouchers={vouchers} />}
      </div>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ראשי</button>
        <button onClick={() => setTab("tasks")} style={S.navBtn(tab === "tasks")}>📋 ניהול</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "futureFeeds" && <FutureFeedsModal events={events} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now, onOpenFutureFeeds }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 5}}>אכלה פעם אחרונה:</div>
      <div className="kids-font" style={{fontSize: 42, fontWeight: 900, color: 'white'}}>--</div>
    </div>
  );
  
  const diffMin = Math.floor((now - lastFeed.ts) / 60000);
  const timeStr = diffMin < 60 ? `${diffMin} דק׳` : `${Math.floor(diffMin/60)}:${(diffMin%60).toString().padStart(2,'0')} ש׳`;
  
  // Progress Bar Logic (Max 4 hours = 240 mins)
  const maxMins = 240;
  const progressPercent = Math.min((diffMin / maxMins) * 100, 100);
  
  // הצבע משתנה ככל שמתקרבים לארוחה הבאה
  let progColor = C.success; // עד שעתיים וחצי - ירוק רגוע
  if (diffMin > 150) progColor = "#facc15"; // שעתיים וחצי עד 3 - צהוב
  if (diffMin > 180) progColor = C.warning; // 3 עד 3.5 שעות - כתום
  if (diffMin > 210) progColor = "#ef4444"; // מעל 3.5 שעות - אדום רעב!

  const nextStart = new Date(lastFeed.ts + 3.5 * 60 * 60 * 1000);
  const nextEnd = new Date(lastFeed.ts + 4 * 60 * 60 * 1000);
  
  return (
    <div style={S.mainWidget}>
      <div style={{fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 5}}>אכלה פעם אחרונה:</div>
      <div className="kids-font" style={{fontSize: 42, fontWeight: 900, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>🍼 {timeStr}</div>
      
      {/* מד התקדמות */}
      <div style={{width: '100%', height: '6px', background: 'rgba(255,255,255,0.3)', borderRadius: '10px', marginTop: '10px', overflow: 'hidden'}}>
        <div style={{width: `${progressPercent}%`, height: '100%', background: progColor, transition: 'width 0.5s ease', borderRadius: '10px'}}></div>
      </div>

      <div style={{...S.nextFeedBox, cursor: 'pointer'}} onClick={onOpenFutureFeeds}>
        <div style={{fontSize: 11, opacity: 0.9, marginBottom: 2}}>🎯 טווח האכלה משוער הבא:</div>
        <div style={{fontSize: 16, fontWeight: 800}}>{fmtTime(nextStart)} - {fmtTime(nextEnd)} 👈</div>
      </div>
    </div>
  );
}

function FutureFeedsModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;

  // יצירת מערך של 8 האכלות עתידיות (24 שעות) במרווחים של 3-3.5 שעות
  const futureFeeds = Array.from({length: 8}).map((_, i) => {
    const start = new Date(lastFeed.ts + (i + 1) * 3 * 60 * 60 * 1000);
    const end = new Date(lastFeed.ts + (i + 1) * 3.5 * 60 * 60 * 1000);
    return { start, end };
  });

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal, maxHeight: '80vh', overflowY: 'auto'}} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', marginBottom:15, color:C.peachDark}}>תחזית האכלות 🍼</h3>
        <p style={{textAlign:'center', fontSize: 13, color: C.textSoft, marginBottom: 15}}>24 השעות הבאות (לפי מרווחי זמן של 3 עד 3.5 שעות)</p>
        
        <div style={{display:'flex', flexDirection:'column', gap: 10}}>
          {futureFeeds.map((feed, index) => (
            <div key={index} style={S.itemRow}>
              <span style={{fontWeight: 800, color: C.textSoft}}>ארוחה {index + 1}:</span>
              <span style={{fontWeight: 800, fontSize: 16}}>{fmtTime(feed.start)} - {fmtTime(feed.end)}</span>
            </div>
          ))}
        </div>
        
        <button onClick={onClose} style={{...S.primaryBtn, marginTop:20}}>סגור</button>
      </div>
    </div>
  );
}

function HomeView({ events, setModal, onDelete }) {
  const isToday = (ts) => new Date(ts).toDateString() === new Date().toDateString();
  const feeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  const diapers = events.filter(e => e.type === "diaper" && isToday(e.ts));

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={{display:'flex', gap:12}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fef3c7', color:'#b45309'}}>🍼 האכלה</button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fce7f3', color:'#be185d'}}>🧷 החתלה</button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        <div style={{display:'flex', gap:10}}>
          
          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🍼 אוכל</div>
            {feeds.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.creamSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input style={S.mlEditInput} value={e.ml || ""} placeholder="כמה ML?" onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} />
                </div>
                {feeds[i+1] && (
                  <div style={S.chainContainer}>
                    <div style={S.chainCurve}></div>
                    <div style={S.chainText}>{getTimeGap(e.ts, feeds[i+1].ts)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={S.column}>
            <div className="kids-font" style={S.columnHeader}>🧷 חיתול</div>
            {diapers.map((e, i) => (
              <div key={e.id}>
                <div style={{...S.eventMiniCard, background: C.blueSoft}}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                    <span style={S.eventTime}>{fmtTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <span style={S.eventDetail}>{e.pee?"💧":""}{e.poop?"💩":""}</span>
                </div>
                {diapers[i+1] && (
                  <div style={S.chainContainer}>
                    <div style={S.chainCurve}></div>
                    <div style={S.chainText}>{getTimeGap(e.ts, diapers[i+1].ts)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

function ManagementView({ shopping, vouchers }) {
  const [newShop, setNewShop] = useState({ item: "נוטרילון", qty: "1", other: "" });
  const [newVouch, setNewVouch] = useState({ name: "", balance: "" });

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
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
        <button onClick={()=>{addDoc(collection(db,"shopping"),{item: newShop.item==='אחר'?newShop.other:newShop.item, qty:newShop.qty, createdAt:Date.now()}); setNewShop({...newShop, other:""});}} style={S.primaryBtn}>הוסף לסל</button>
        {shopping.map(s => (
          <div key={s.id} style={S.itemRow}>
            <span><b>{s.item}</b> (x{s.qty})</span>
            <button onClick={()=>deleteDoc(doc(db,"shopping",s.id))} style={S.doneBtn}>נרכש ✓</button>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>🎫 מעקב תווים</div>
        <div style={{display:'flex', gap:5, marginBottom:10}}>
          <input placeholder="סוג התו" value={newVouch.name} onChange={e=>setNewVouch({...newVouch, name:e.target.value})} style={S.input} />
          <input placeholder="יתרה" type="number" value={newVouch.balance} onChange={e=>setNewVouch({...newVouch, balance:e.target.value})} style={{...S.input, width:100}} />
          <button onClick={()=>{addDoc(collection(db,"vouchers"),newVouch); setNewVouch({name:"",balance:""})}} style={{...S.primaryBtn, width:50}}>+</button>
        </div>
        {vouchers.map(v => (
          <div key={v.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #eee'}}>
            <span style={{fontWeight:800}}>{v.name}</span>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <input type="number" value={v.balance} onChange={(e)=>updateDoc(doc(db,"vouchers",v.id), {balance: e.target.value})} style={{width:80, padding:5, border:'1px solid #ddd', borderRadius:8, textAlign:'center', fontWeight:800}} />
              <button onClick={()=>deleteDoc(doc(db,"vouchers",v.id))} style={{border:'none', background:'none'}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedModal({ onConfirm, onClose }) {
  const [ml, setMl] = useState("");
  const [timeMode, setTimeMode] = useState("now");
  const [manualTime, setManualTime] = useState("");

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', marginBottom:15, color:C.peachDark}}>האכלה 🍼</h3>
      <div style={{display:'flex', gap:10, marginBottom:15}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" onChange={e=>setManualTime(e.target.value)} style={{...S.input, marginBottom:10}} />}
      <input type="number" placeholder='כמות (מ"ל)' value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      <button onClick={()=>{onConfirm({type:'feed', ml, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={{...S.primaryBtn, marginTop:10}}>שמור נתונים</button>
    </div></div>
  );
}

function DiaperModal({ onConfirm, onClose }) {
  const [pee, setPee] = useState(true);
  const [poop, setPoop] = useState(false);
  const [timeMode, setTimeMode] = useState("now");
  const [manualTime, setManualTime] = useState("");

  return (
    <div style={S.overlay} onClick={onClose}><div style={S.modal} onClick={e=>e.stopPropagation()}>
      <h3 className="kids-font" style={{textAlign:'center', marginBottom:15, color:C.peachDark}}>החתלה 🧷</h3>
      <div style={{display:'flex', gap:10, marginBottom:15}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" onChange={e=>setManualTime(e.target.value)} style={{...S.input, marginBottom:15}} />}

      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
        <button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
      </div>
      <button onClick={()=>{onConfirm({type:'diaper', pee, poop, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={S.primaryBtn}>שמור נתונים</button>
    </div></div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "calc(15px + env(safe-area-inset-top)) 20px 25px", borderRadius: "0 0 45px 45px", textAlign: "center", zIndex: 10, boxShadow: "0 8px 20px rgba(232, 121, 249, 0.2)" },
  greeting: { fontSize: 13, color: "white", fontWeight: 600, opacity: 0.85, marginBottom: 5 },
  babyBadge: { fontSize: 34, color: "white", fontWeight: 800, marginBottom: 15 },
  vitaminBar: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 18px', borderRadius:'15px', color:'white', fontWeight:800, marginBottom:15, cursor:'pointer' },
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(12px)", borderRadius: "25px", padding: "18px 15px", border: "1px solid rgba(255, 255, 255, 0.3)", display: "inline-block", width: "100%", maxWidth: "300px" },
  nextFeedBox: { marginTop: 15, fontSize: 13, fontWeight: 800, color: "white", background: "rgba(0,0,0,0.15)", padding: "8px 15px", borderRadius: "15px" },
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 140px" }, // Increased padding-bottom to fix scroll cutoff
  actionBtn: { flex: 1, border: "none", padding: "18px", borderRadius: "20px", fontSize: 18, fontWeight: 800, fontFamily: FONT_KIDS },
  card: { background: "white", borderRadius: "25px", padding: "20px", border: `1px solid ${C.border}`, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  column: { flex: 1, display: "flex", flexDirection: "column", gap: 0 },
  columnHeader: { textAlign: "center", fontWeight: 800, fontSize: 14, padding: "8px", background: "#fff5f0", borderRadius: "10px", color: C.peachDark, marginBottom: 10 },
  eventMiniCard: { display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", borderRadius: "15px", border: "1px solid #f1f5f9", zIndex: 2, position: 'relative' },
  chainContainer: { display: 'flex', alignItems: 'center', marginTop: '-4px', marginBottom: '-4px', marginRight: '20px', height: '35px', zIndex: 1 },
  chainCurve: { width: '15px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 15px 15px 0', marginLeft: '8px' },
  chainText: { fontSize: 11, fontWeight: 800, color: C.textSoft },
  mlEditInput: { width: '100%', border:'none', background:'rgba(0,0,0,0.05)', borderRadius:8, textAlign:'center', fontWeight:800, fontSize:14, padding:6, marginTop:5 },
  delBtn: { background:'none', border:'none', color: '#ccc', fontSize: 14 },
  eventTime: { fontSize: 12, fontWeight: 800, color: C.textSoft },
  eventDetail: { fontSize: 15, fontWeight: 700, marginTop: 5 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: C.bg, borderTop: `1px solid ${C.border}`, padding: "10px calc(10px + env(safe-area-inset-bottom))", zIndex: 999, boxShadow: "0 -4px 15px rgba(0,0,0,0.05)" },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "12px", borderRadius: "15px", fontWeight: 800, color: active ? "white" : C.textSoft }),
  input: { width: "100%", padding: "12px", borderRadius: "10px", border: `2px solid ${C.border}`, fontWeight: 700, fontSize: 16 },
  primaryBtn: { width: "100%", padding: "15px", borderRadius: "20px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 17 },
  itemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dotted #eee' },
  doneBtn: { background: C.success, border: 'none', borderRadius: '8px', padding: '6px 12px', fontWeight: 800, fontSize: 12 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal: { background: "white", padding: "25px", borderRadius: "30px", width: "90%", maxWidth: 350 },
  chip: (active) => ({ flex: 1, padding: "10px", borderRadius: "10px", border: active ? `2px solid ${C.peach}` : "1px solid #ddd", background: active ? C.creamSoft : "white", fontWeight: 700 }),
};
