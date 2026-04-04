import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  onSnapshot, query, orderBy, setDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Palette & Theme (Premium Pastel Edition) ─────────────────────────────
const C = {
  bg: "#fffcfb", white: "#ffffff", border: "#f7d7c4", peach: "#f4a58a",
  peachDark: "#e8845e", blueSoft: "#e0f2fe", creamSoft: "#fff7ed",
  pastelYellow: "#fffdf0", pastelPurple: "#f9f5ff",
  text: "#4a2c2a", textSoft: "#8c6d6a", success: "#34d399", warning: "#fbbf24", danger: "#f87171",
  purpleDark: "#701a75"
};

const FONT_MAIN = "'Assistant', sans-serif";
const FONT_KIDS = "'Varela Round', sans-serif"; 

// ── Icons ──────────────────────────────────────────────────────────────────
const DiaperIcon = ({ size = 26, color = "#701a75" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7C4 6.44772 4.44772 6 5 6H19C19.5523 6 20 6.44772 20 7V9C20 13.9706 16.4183 18 12 18C7.58172 18 4 13.9706 4 9V7Z" fill="#fdf4ff" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 9C6 9 7.5 10.5 7.5 12.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M20 9C18 9 16.5 10.5 16.5 12.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M9 9V10C9 10.5523 9.44772 11 10 11H14C14.5523 11 15 10.5523 15 10V9" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const BearClockIcon = ({ size = 42, color = C.peachDark }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="13" r="8" stroke={color} strokeWidth="2" fill={C.creamSoft}/>
    <circle cx="6" cy="6" r="3" stroke={color} strokeWidth="2" fill={C.creamSoft}/>
    <circle cx="18" cy="6" r="3" stroke={color} strokeWidth="2" fill={C.creamSoft}/>
    <path d="M12 10V13L14 15" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────
function isToday(ts) { return new Date(ts).toDateString() === new Date().toDateString(); }
function formatEventTime(ts) {
  const timeStr = new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return isToday(ts) ? timeStr : `${timeStr} (אתמול)`;
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
function getHebrewDay(ts) { const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת']; return `יום ${days[new Date(ts).getDay()]}`; }
function fmtDateShort(ts) { return new Date(ts).toLocaleDateString("he-IL", { day: '2-digit', month: '2-digit' }); }
function getTimeGap(ts1, ts2) {
  const diff = Math.abs(ts1 - ts2);
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}:${rm.toString().padStart(2, '0')} ש׳` : `${h} ש׳`;
}
function parseAiText(text) {
  const html = text.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, `<strong style="color: ${C.peachDark}; font-weight: 900;">$1</strong>`);
  return { __html: html };
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("home");
  const [userName] = useState(() => localStorage.getItem("baby_username") || "אבא");
  const [modal, setModal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showUndo, setShowUndo] = useState(false);
  const [undoId, setUndoId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const qEvents = query(collection(db, "events"), orderBy("ts", "desc"));
    const unsub = onSnapshot(qEvents, s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { clearInterval(timer); unsub(); };
  }, []);

  const addEvent = async (ev) => {
    if ("vibrate" in navigator) navigator.vibrate(40);
    let finalTs = ev.ts_override || Date.now(); 
    delete ev.ts_override; 

    if (ev.manualTime && !ev.ts_override) {
      const [h, m] = ev.manualTime.split(':');
      const d = new Date(); d.setHours(parseInt(h), parseInt(m), 0, 0);
      finalTs = d.getTime();
    }

    const docRef = await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
    setUndoId(docRef.id); setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const vitaminDone = events.some(e => e.type === "vitaminD" && isToday(e.ts));
  const bathDone = events.some(e => e.type === "bath" && isToday(e.ts));

  const currentHour = new Date(now).getHours();
  let vitColor = '#dcfce7'; 
  if (currentHour >= 12 && currentHour < 18) vitColor = '#fef08a'; 
  if (currentHour >= 18) vitColor = '#fecaca'; 

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&family=Varela Round&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: ${FONT_MAIN}; }
        body { margin: 0; background: ${C.bg}; overflow: hidden; direction: rtl; }
        .kids-font { font-family: ${FONT_KIDS} !important; }
        
        .neta-ticker {
          user-select: none;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .neta-ticker:active {
          transform: scale(0.96);
        }
      `}</style>

      {showUndo && (
        <div style={S.undoToast}>
          <span>עודכן בהצלחה! ✨</span>
          <button onClick={async () => { await deleteDoc(doc(db,"events",undoId)); setShowUndo(false); }} style={{color: C.peach, border:'none', background:'none', fontWeight:800}}>בטל</button>
        </div>
      )}

      <div style={S.headerContainer}>
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 8, marginBottom: 10}}>
          <div style={S.greeting}>שלום {userName} 👋</div>
          <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        </div>
        
        <NetaTicker now={now} />

        <div style={{display: 'flex', gap: 10, marginBottom: 12}}>
          <TaskButton 
            icon="☀️" 
            text="ויטמין D" 
            done={vitaminDone} 
            bgColor={vitColor}
            textColor={currentHour >= 18 ? "#991b1b" : "#064e3b"}
            onClick={() => !vitaminDone && addEvent({ type: "vitaminD" })} 
          />
          <TaskButton 
            icon="🛁" 
            text="מקלחת" 
            done={bathDone} 
            bgColor="#e0f2fe"
            textColor="#075985"
            onClick={() => !bathDone && addEvent({ type: "bath" })} 
          />
        </div>

        <MainTimerWidget events={events} now={now} onOpenForecast={() => setModal("forecast")} />
        <ProactiveTicker events={events} vitaminDone={vitaminDone} now={now} />
      </div>

      <div style={S.content}>
        {tab === "home" && <HomeView events={events} setModal={setModal} onDelete={id => deleteDoc(doc(db,"events",id))} />}
        {tab === "analytics" && <AnalyticsView events={events} />}
      </div>

      <button onClick={() => setModal("handoff")} style={S.handoffFab}>🧸</button>
      <button onClick={() => setModal("ai")} style={S.aiFab}>🍼</button>

      <div style={S.nav}>
        <button onClick={() => setTab("home")} style={S.navBtn(tab === "home")}>🏠 ALMA</button>
        <button onClick={() => setTab("analytics")} style={S.navBtn(tab === "analytics")}>📊 נתונים</button>
      </div>

      {modal === "feed" && <FeedModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "diaper" && <DiaperModal onConfirm={addEvent} onClose={() => setModal(null)} />}
      {modal === "forecast" && <ForecastModal events={events} onClose={() => setModal(null)} />}
      {modal === "handoff" && <HandoffModal events={events} vitaminDone={vitaminDone} bathDone={bathDone} onClose={() => setModal(null)} />}
      {modal === "ai" && <AiChatModal events={events} vitaminDone={vitaminDone} bathDone={bathDone} onClose={() => setModal(null)} />}
      {modal === "smartLog" && <SmartLogModal onConfirm={addEvent} onClose={() => setModal(null)} />}
    </div>
  );
}

function SmartLogModal({ onConfirm, onClose }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("זיהוי קולי לא נתמך בדפדפן שלך. אנא הקלד את הפעולה במקום.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'he-IL';
    recognition.interimResults = false;
    
    recognition.onstart = () => { setListening(true); setErrorMsg(""); setText(""); };
    recognition.onresult = (e) => setText(e.results[0][0].transcript);
    recognition.onerror = () => { setListening(false); setErrorMsg("לא הצלחתי לשמוע. נסה שוב."); };
    recognition.onend = () => setListening(false);
    
    recognition.start();
  };

  const processSmartText = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setErrorMsg("");
    
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          mode: "parse_voice", 
          text: text,
          currentTime: new Date().toLocaleTimeString("he-IL", { hour: '2-digit', minute: '2-digit' })
        })
      });
      
      const data = await res.json();
      
      if (!data.type || data.type === "unknown") {
        setErrorMsg("לא הצלחתי להבין איזו פעולה עשית. נסה לנסח אחרת.");
        setLoading(false);
        return;
      }

      const exactTs = Date.now() - ((data.minutesAgo || 0) * 60000);
      const eventToSave = { type: data.type, ts_override: exactTs };
      
      if (data.type === "feed") eventToSave.ml = data.ml;
      if (data.type === "diaper") {
        eventToSave.pee = data.pee !== undefined ? data.pee : true; 
        eventToSave.poop = data.poop || false;
      }
      
      onConfirm(eventToSave);
      onClose();
    } catch (e) {
      setErrorMsg("שגיאת תקשורת בפענוח הנתונים.");
      setLoading(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal, textAlign: 'center'}} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{color: C.peachDark, margin: '0 0 20px', fontSize: 24}}>הזנה חכמה 🎙️</h3>
        <p style={{fontSize: 14, color: C.textSoft, marginBottom: 20}}>
          לחץ על המיקרופון ודבר, או פשוט הקלד. <br/>למשל: "עלמה אכלה 60 מיל ב-10 בבוקר" או "החלפנו קקי לפני רבע שעה".
        </p>

        <div style={{display: 'flex', justifyContent: 'center', marginBottom: 20}}>
          <button 
            onClick={startListening} 
            style={{
              width: 80, height: 80, borderRadius: 40, border: 'none',
              background: listening ? C.danger : C.peach, color: 'white',
              fontSize: 32, cursor: 'pointer',
              boxShadow: listening ? `0 0 20px ${C.danger}` : `0 8px 20px rgba(0,0,0,0.15)`,
              transition: 'all 0.3s ease'
            }}
          >
            {listening ? "..." : "🎤"}
          </button>
        </div>

        <textarea 
          placeholder="או הקלד כאן חופשי..." 
          value={text} 
          onChange={e=>setText(e.target.value)} 
          style={{...S.input, height: 100, borderRadius: 15, padding: 15, fontSize: 18, resize: 'none'}} 
        />
        
        {errorMsg && <div style={{color: C.danger, fontWeight: 800, marginBottom: 15}}>{errorMsg}</div>}
        
        <button onClick={processSmartText} disabled={loading} style={S.primaryBtn}>
          {loading ? "מפענח..." : "שמור אירוע"}
        </button>
      </div>
    </div>
  );
}

function TaskButton({ icon, text, done, bgColor, textColor, onClick }) {
  return (
    <button 
      onClick={onClick} 
      style={{ 
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '12px 14px', borderRadius: '24px', border: 'none', 
        background: done ? '#f1f5f9' : bgColor, 
        boxShadow: done ? 'inset 0 2px 4px rgba(0,0,0,0.02)' : '0 4px 10px rgba(0,0,0,0.06)', 
        cursor: done ? 'default' : 'pointer',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{fontSize: 22, filter: done ? 'grayscale(100%) opacity(40%)' : 'none'}}>{icon}</span>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>
          <span style={{fontSize: done ? 12 : 14, fontWeight: 900, color: done ? C.textSoft : textColor}}>
            {done ? "בוצע היום ✅" : text}
          </span>
        </div>
      </div>
      
      <div style={{
        width: 22, height: 22, borderRadius: '50%', 
        border: done ? 'none' : `2px solid rgba(0,0,0,0.15)`, 
        background: done ? '#cbd5e1' : 'rgba(255,255,255,0.6)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {done && <span style={{color: 'white', fontSize: 13, fontWeight: 'bold'}}>✓</span>}
      </div>
    </button>
  );
}

// ── Neta Cheeky Compliment Ticker (The Ultimate Roast & Toast Collection) ──
function NetaTicker({ now }) {
  const [manualOffset, setManualOffset] = useState(0);

  const compliments = [
    "נטע, לכי לנוח. עכשיו תורו של אסף, שיעשה קצת פאנלים.",
    "נטע, ברור שאת עייפה. לסחוב את אסף על הגב כל היום זה מעייף.",
    "נטע, שימי רגליים למעלה. אם עלמה בוכה - אסף קם. זה החוק.",
    "נטע, את נראית מיליון דולר. אסף? נו, לפחות הוא מנסה.",
    "נטע, תזכירי לאסף שהוא העוזר מנכ״ל פה. את הבוסית.",
    "נטע, ינאי ועלמה זכו. אסף פשוט שדד את הבנק המרכזי.",
    "נטע, אסף אמור לשטוף כלים עכשיו, למה הוא מסתכל באפליקציה?",
    "נטע, תעבירי לאסף את השרביט, מגיע לך לישון איזה יומיים.",
    "נטע, גם כשאת בפיג'מה את לוקחת את אסף בהליכה.",
    "נטע, אם אסף מצייץ היום, תגידי לו שהאלגוריתם קבע שאת צודקת.",
    "נטע, תודיעי לאסף שהמשמרת שלו מתחילה. ביי.",
    "נטע, ישירות ממסד הנתונים: אסף חב לך את חייו.",
    "נטע, תני לאסף להחליף את הקקי הזה. את יפה מדי בשביל זה.",
    "נטע, ינאי יצא חכם בזכותך. אם הוא יעשה שטויות - זה מאסף.",
    "נטע, אסף יודע שצריך להקים לך מקדש בסלון?",
    "נטע, תגידי לאסף שיכין לך קפה, ושיזהר לא לשרוף אותו.",
    "נטע, עשית מספיק להיום. שאסף ייקח פיקוד על הכאוס.",
    "נטע, איך את אמא לשניים ועדיין נראית פצצה? אסף צריך להודות לאל.",
    "נטע, תרימי ת'רגליים ותשלחי את אסף להביא לך משהו מתוק.",
    "נטע, את גורמת לאימהות להיראות קל. אסף גורם לזה להיראות קשה.",
    "נטע, תשלחי את אסף לעשות כביסה. מגיע לך זמן לעצמך.",
    "נטע, עלמה חייכה? זה כי היא ראתה אותך. אסף רק הצחיק אותה בטעות.",
    "נטע, השלטון בבית הזה לגמרי שלך. אסף רק עובד פה.",
    "נטע, תזכירי לאסף שהתפקיד שלו זה להגיד 'כן, חיים שלי'.",
    "נטע, את ההוכחה ששלמות קיימת. אסף הוא ההוכחה שניסים קורים.",
    "נטע, לכי לישון. אם הבית עולה באש, שאסף יכבה.",
    "נטע, אסף בטוח חושב שהוא המציא את האפליקציה הזו, אבל שנינו יודעים בשביל מי היא.",
    "נטע, תקראי לאסף שיעשה לך פאנלים. הרצפה לא תבריק מעצמה.",
    "נטע, רק מומחית כמוך יכולה לנהל את ינאי, עלמה ואסף במקביל.",
    "נטע, את המוח, הלב והיופי של הבית. אסף אחראי על הזבל.",
    "נטע, אמא מושלמת. אישה מושלמת. ואסף... נמצא שם בסביבה.",
    "נטע, תזכורת לאסף: אשתך פצצה. תתנהג בהתאם.",
    "נטע, אם אסף מעצבן אותך, תלחצי פה דאבל קליק ואני אמחק לו נתונים.",
    "נטע, תודי שזה קורע לראות את אסף מנסה להרדים את עלמה.",
    "נטע, אסף עשה לך מסאז' היום? אם לא, זו עילה משפטית.",
    "נטע, את שולטת בבית הזה ביד רמה. אסף הוא כוח העזר שלך.",
    "נטע, תעשי קליק עם האצבע ואסף אמור לקפוץ. נסי את זה עכשיו.",
    "נטע, הכלים בכיור קוראים לאסף. שחררי אותם.",
    "נטע, אני שוקל להוסיף כפתור 'השתק אסף' רק בשבילך.",
    "נטע, תזכרי: עלמה התינוקת, ינאי הפעוט, ואסף הילד הגדול. סבלנות.",
    "נטע, אסף אמר שהוא 'עוזר' בבית? תתקני אותו: הוא 'גר' בבית, שיעבוד.",
    "נטע, עשית היום קסמים. אסף מקסימום העלים עוגייה.",
    "נטע, אין ספק שאת אשת השנה. אסף יכול להיות סגן שני אולי.",
    "נטע, גם כשאת קמה הפוכה את מדהימה. שאסף ילמד משהו.",
    "נטע, לכי למקלחת ארוכה. אסף שומר על המבצר (נקווה שלא יהרוס).",
    "נטע, את הבוסית של הפרויקט. אסף הוא עובד קבלן זמני.",
    "נטע, סטטיסטית, אסף צודק רק כשהוא מסכים איתך.",
    "נטע, זה חוקי להיות כזו מהממת אחרי לידה? תשאלי את אסף.",
    "נטע, עלמה בוכה. אסף - למשמרת. נטע - לשנ״צ.",
    "נטע, ידעת שאסף התחנן אליי שאכתוב לך פה דברים יפים? הוא מפחד ממך.",
    "נטע, תנוחי. אני עושה לאסף ביקורת פתע על ההחתלות שלו.",
    "נטע, את הלביאה. אסף במקרה הטוב הוא פומה שמנמנה.",
    "נטע, ינאי ועלמה יצאו מושלמים. מזל שהגנים שלך חזקים יותר משל אסף.",
    "נטע, תודיעי לאסף שהיום בערב מזמינים אוכל. פטור מבישולים בשבילך.",
    "נטע, את מנהלת אופרציה שלמה. אסף מתקשה למצוא את הגרביים שלו.",
    "נטע, אין עלייך ביקום. אסף פשוט תפס טרמפ על ההצלחה שלך.",
    "נטע, תזכרי שאסף אוהב אותך. במיוחד כשאת מסדרת אחריו.",
    "נטע, שבי רגע. אסף צריך להכין לך עכשיו כוס יין.",
    "נטע, האנרגיות שלך מחזיקות את הבית. אסף סתם צורך חשמל.",
    "נטע, ראיתי את נתוני ההחתלות. אסף משתרך מאחור. תני לו בראש.",
    "נטע, את מהממת ברמות. אסף, תרשום הערות.",
    "נטע, גם סופרוומן נחה לפעמים. תעבירי לאסף את הגלימה.",
    "נטע, אל תעשי שום דבר שאסף יכול לעשות במקומך. שזה הכל בערך.",
    "נטע, רק אומר: אסף פוחד ממך מספיק כדי לבקש ממני להרים לך.",
    "נטע, את המקור לכל מה שטוב בבית הזה. אסף שם בשביל התפאורה.",
    "נטע, איזה כיף לאסף שיש לו אותך. איזה כיף לך שיש לך... נטפליקס.",
    "נטע, תגידי לאסף שיתחיל לפצות על הלילות הלבנים שלך. ביהלומים.",
    "נטע, מיכל מי? נטע היא המלכה האמיתית של הבית הזה.",
    "נטע, הנה רעיון: אסף יקום הלילה, ואת תשני עד 10. סגרנו?",
    "נטע, ששש... אל תפריעי לעצמך לנוח. שאסף ישבור ת'ראש עם הילדים.",
    "נטע, את נראית וואו. אסף צריך לשים משקפי שמש.",
    "נטע, אם אסף שואל, השעה עכשיו 'זמן של נטע'. שילך לחפש.",
    "נטע, את עושה הכל כל כך בסטייל, אסף סתם מפריע לפריים.",
    "נטע, ינאי למד לדבר יפה בזכותך. השטויות זה מאסף.",
    "נטע, תזכרי שמגיע לך הכל. אסף כאן כדי להגיש לך את זה.",
    "נטע, רק מלהסתכל על המשימות שלך אני מתעייף. שאסף יחליף אותך קצת.",
    "נטע, אסף יודע שבלעדייך הוא היה חי על פיתות קפואות?",
    "נטע, תודי שזה כיף לתת לאסף פקודות. אל תפסיקי.",
    "נטע, את גורמת לשלמות להיראות זמינה לכל דורש. אסף זכה.",
    "נטע, האפליקציה הזו קיימת רק כדי לוודא שאסף עושה משהו בבית.",
    "נטע, אם אסף מתלונן שעייף לו, תזכירי לו מה זה ללדת.",
    "נטע, כל יום שאת לא מפטרת את אסף מהתפקיד שלו, זה יום של חסד.",
    "נטע, תשאירי לאסף את העבודה השחורה. את נסיכה.",
    "נטע, איך את מחזיקה מעמד ככה? מדהימה. אסף - קח דוגמה.",
    "נטע, כולם יודעים שאת הבוס. אל תתני לאסף לחשוב אחרת.",
    "נטע, קחי לעצמך רגע. אסף במילא לא ישים לב אם הבית יתהפך.",
    "נטע, סטטיסטית, את עושה פי 8 מאסף. הגיע הזמן להשוות תנאים.",
    "נטע, את מהממת גם כשאת כועסת. אסף יודע את זה הכי טוב.",
    "נטע, תשתי קפה בשקט. אסף יכול לאסוף את הצעצועים מהרצפה.",
    "נטע, הלב הענק שלך מכיל את כולם. במיוחד את השטויות של אסף.",
    "נטע, כל פעם שעלמה עושה קקי גב, תברחי. שאסף יטפל בזה.",
    "נטע, תגידי לאסף שייקח את ינאי לגינה. יש לך שעת שקט עכשיו.",
    "נטע, את חכמה, יפה ומוכשרת. ואסף... ובכן, לאסף יש מזל.",
    "נטע, האנרגיות שלך זה קסם. שאסף יטעין את עצמו ממך.",
    "נטע, לא משנה מה אסף עושה, ברור שאת היית עושה את זה יותר טוב.",
    "נטע, תני לאסף לשטוף את הבקבוקים. הם לא ינקו את עצמם.",
    "נטע, יום חג לאומי: נטע קמה. אסף - תפרוס שטיח אדום.",
    "נטע, את הפנינה של הבית. אסף הוא מקסימום הפלסטיק שעוטף אותה.",
    "נטע, תשבי, תשתי קפה, תסתכלי על אסף עובד. איזה תענוג.",
    "נטע, איזה מזל שיש להם אותך. כי אם אסף היה האחראי... אלוהים ישמור.",
    "נטע, את מריצה פה אימפריה. אסף הוא הפקיד הזוטר.",
    "נטע, אני רואה את הנתונים: אסף מתעצל היום. תעירי אותו.",
    "נטע, לנהל ילדים ואת אסף זו עבודה לשלושה אנשים. את אלופה.",
    "נטע, תזכירי לאסף שמגיע לך מסאז' לפחות פעם ביום.",
    "נטע, פשוט תהיי פה מהממת. אסף כבר יעשה את כל השאר (אני מקווה).",
    "נטע, עלמה עשתה קקי? הנה ההזדמנות של אסף להוכיח את עצמו.",
    "נטע, את סוחבת הכל בסטייל. אסף מתלונן כשהוא סוחב שקית מהסופר.",
    "נטע, מדהים לראות כמה שאת שולטת בבלאגן. אסף סתם עושה רעש.",
    "נטע, לכי לישון. התירוץ של אסף נגמר. הוא בתורנות.",
    "נטע, ינאי ועלמה ברי מזל. אסף עוד יותר. פשוט תשנני לו את זה.",
    "נטע, מגיע לך פרס ישראל על זה שאת סובלת את כל הבלאגן הזה (ואת אסף).",
    "נטע, תודיעי לאסף שהחל מעכשיו, כל החתלה שווה לו נקודות זכות.",
    "נטע, תרימי את הרגליים ותני לאסף להתרוצץ קצת. זה בריא לו.",
    "נטע, את תמיד צודקת, גם כשאת לא. אסף, תכתוב את זה על הלוח.",
    "נטע, אין ספק שאת המוח המבצע. אסף סתם עושה קולות של עובד.",
    "נטע, את מלכה 👑 אסף יכול להחזיק את המניפה.",
    "נטע, כל השכונה יודעת שבלעדייך הבית הזה קורס. אסף מודע לזה?",
    "נטע, איזה כיף לראות את אסף מנסה להבין מה לעשות. תני לו להזיע.",
    "נטע, עשית מספיק. אסף, הגיע הזמן לפתוח את ארנק הפינוקים לנטע.",
    "נטע, כולם יודעים שאת הגרסה המוצלחת של הזוגיות הזאת.",
    "נטע, אם אסף עושה טעות, פשוט תראי לו את המסך הזה.",
    "נטע, אפילו כאלגוריתם, יש לי קראש על איך שאת מתקתקת עניינים.",
    "נטע, אסף ביקש פיצ'ר שמשתיק את ההתראות. חסמתי אותו. את הבוס.",
    "נטע, אסף מחכה לפקודה. מה המשימה הבאה שלו?",
    "נטע, יפה לך אימהות. אסף נראה כאילו הוא אחרי קרב הישרדות.",
    "נטע, תכיני לעצמך תה, אסף ישמור על הילדים. מה כבר יכול לקרות?",
    "נטע, את מצחיקה אותי יותר מאסף. והוא עוד מנסה.",
    "נטע, כולם יודעים שהמשפחה הזו תלויה לך על הכתפיים המהממות שלך.",
    "נטע, את גורמת ל'אמא עייפה' להיראות כמו טרנד של גוצ'י.",
    "נטע, תגידי לאסף שאם הוא רוצה חיוך ממך, שיתחיל לקפל כביסה.",
    "נטע, אל תתני לאסף לשכנע אותך שהוא עייף. את לוקחת אותו בסיבוב.",
    "נטע, עלמה עשתה פיפי. אסף לטיפולך, נטע להמשך מנוחה.",
    "נטע, בחיים לא ראיתי עבודת ניהול כזו מרשימה. אסף סתם בובה.",
    "נטע, את הבוס, המנכ״ל והיו״ר. אסף אחראי על הפח.",
    "נטע, יש לך את האישור שלי להתעלם מאסף בשעה הקרובה. לכי לנוח.",
    "נטע, רק המחשבה על מה שאת עושה ביום מעייפת אותי. שאסף יעשה משהו!",
    "נטע, תודיעי לאסף שהיום בלילה התור שלו לפזם את 'שן ילדי'.",
    "נטע, תזכרי שאת מלכה, גם אם אסף שכח להגיד לך את זה היום.",
    "נטע, הכל בשליטה שלך. אסף רק חושב שהוא מחליט משהו.",
    "נטע, ינאי מתוק בזכותך. אם הוא מרביץ, זה הגנים של אסף.",
    "נטע, מגיע לך חופשה באיים המלדיביים. אסף, תשלוף את האשראי.",
    "נטע, תסלחי לאסף, הוא פשוט לא עומד בקצב המושלם שלך.",
    "נטע, קחי לך רגע. הבית לא יברח, ואסף... ננסה לא לאבד אותו.",
    "נטע, עשית היום בית ספר לכולם. במיוחד לאסף.",
    "נטע, תזכורת אחרונה להיום: הבית של נטע, השאר רק מתארחים פה.",
    "נטע, אסף עשה משהו מועיל היום? אם לא, זה הזמן להפעיל אותו.",
    "נטע, הטיקר הזה פה רק כדי לעצבן את אסף ולהרים לך. תיהני.",
    "נטע, לסיכום: את מדהימה. אסף נסבל. שיהיה לכם יום מקסים! ❤️"
  ];
  
  const baseIndex = Math.floor(now / (1000 * 60 * 60)) % compliments.length;
  const currentIndex = (baseIndex + manualOffset) % compliments.length;
  const current = compliments[currentIndex];

  const handleDoubleClick = () => {
    setManualOffset(prev => prev + 1);
  };

  return (
    <div className="neta-ticker" onDoubleClick={handleDoubleClick} title="לחיצה כפולה לפאנצ' הבא!" style={{ textAlign: 'center', marginBottom: 12 }}>
      <div style={{ display: 'inline-block', background: 'linear-gradient(135deg, #f9a8d4, #f4a58a)', color: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 900, boxShadow: '0 2px 10px rgba(249, 168, 212, 0.4)' }}>
        {current}
      </div>
    </div>
  );
}

// ── Proactive Ticker (התובנות של עלמה) ────────────────────────────────────
function ProactiveTicker({ events, vitaminDone, now }) {
  const [index, setIndex] = useState(0);
  const insights = [];
  
  const lastPoop = events.find(e => e.type === "diaper" && e.poop);
  if (lastPoop && (now - lastPoop.ts) > 24 * 60 * 60 * 1000) {
    insights.push({ icon: "💩", text: "שימו לב: אין קקי מעל 24 שעות", color: C.danger });
  }

  const todayFeeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  const totalMl = todayFeeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  if (totalMl > 500) insights.push({ icon: "📈", text: `אוכלת מעולה היום (${totalMl} מ"ל)`, color: C.success });

  if (insights.length === 0) {
    insights.push({ icon: "✨", text: "הכל מושלם! עלמה במסלול המדויק", color: C.peachDark });
  }

  const finalInsights = insights.slice(0, 3);

  useEffect(() => {
    if (finalInsights.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % finalInsights.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, [finalInsights.length]);

  const current = finalInsights[index];

  return (
    <div style={{ marginTop: 12, height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div key={index} style={{ 
        background: 'rgba(255, 255, 255, 0.9)', 
        padding: '4px 14px', 
        borderRadius: 20, 
        fontSize: 12, 
        fontWeight: 800, 
        color: current.color, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 6, 
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)' 
      }}>
        <span>{current.icon}</span> {current.text}
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────────────

function MainTimerWidget({ events, now, onOpenForecast }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return <div style={S.mainWidget}><div className="kids-font" style={{fontSize: 42, color: 'white'}}>--</div></div>;
  
  const diffMin = Math.floor((now - lastFeed.ts) / 60000);
  const timeStr = diffMin < 60 ? `${diffMin} דק׳` : `${Math.floor(diffMin/60)}:${(diffMin%60).toString().padStart(2,'0')} ש׳`;
  
  const targetMins = 240;
  const progressPercent = Math.min((diffMin / targetMins) * 100, 100);
  let progColor = C.success;
  if (diffMin > 150) progColor = C.warning;
  if (diffMin > 210) progColor = C.danger;

  return (
    <div style={S.mainWidget}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <div style={{fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 0}}>אכלה לפני:</div>
          <div className="kids-font" style={{fontSize: 42, fontWeight: 900, color: 'white', textShadow: '0 2px 10px rgba(0,0,0,0.1)', lineHeight: 1}}>🍼 {timeStr}</div>
        </div>
        
        <button onClick={onOpenForecast} style={{ background: "white", border: "none", width: 55, height: 55, borderRadius: 30, boxShadow: "0 4px 15px rgba(0,0,0,0.1)", cursor: "pointer", display:'flex', alignItems:'center', justifyContent:'center' }}>
          <BearClockIcon size={34} />
        </button>
      </div>
      
      <div style={S.progressBarContainer}>
        <div style={{...S.progressBarFill, width: `${progressPercent}%`, background: progColor}}></div>
      </div>
    </div>
  );
}

// ── Smart Night Forecast Modal (יעד יחיד: 23:15, 7 ארוחות ביום) ────────────
function ForecastModal({ events, onClose }) {
  const lastFeed = events.find(e => e.type === "feed");
  if (!lastFeed) return null;
  
  // טור ימין: מרווח קשיח של בדיוק 4 שעות רגיל
  const dumbFuture = Array.from({length: 4}).map((_, i) => new Date(lastFeed.ts + (i + 1) * 4 * 60 * 60 * 1000));
  
  // טור שמאל: אלגוריתם חכם - יעד סופי ומוחלט הוא 23:15.
  const smartFuture = [];
  let currentTs = lastFeed.ts;

  // חישוב היעד: 23:15 הבא
  let target = new Date(currentTs);
  target.setHours(23, 15, 0, 0);
  if (target.getTime() <= currentTs) {
      target.setDate(target.getDate() + 1);
  }
  
  let diffMs = target.getTime() - currentTs;
  
  let steps = Math.ceil(diffMs / (4 * 60 * 60 * 1000));
  if (steps === 0) steps = 1;
  
  let interval = diffMs / steps;
  
  let tempTs = currentTs;
  for (let i = 0; i < 4; i++) {
    tempTs += interval;
    smartFuture.push(new Date(tempTs));
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal, width: '95%', maxWidth: 450, padding: '30px 15px'}} onClick={e=>e.stopPropagation()}>
        <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark, margin: '0 0 20px', fontSize: 22}}>הטייס האוטומטי 🌙</h3>
        
        <div style={{display: 'flex', gap: 10, marginBottom: 20}}>
          {/* עמודה ימנית (קשיחה) */}
          <div style={{flex: 1, background: '#f8fafc', padding: 10, borderRadius: 15, border: '1px solid #e2e8f0'}}>
            <div style={{fontWeight: 800, fontSize: 13, color: C.textSoft, textAlign: 'center', marginBottom: 15, height: 35}}>
              מרווח קשיח<br/>(כל 4 שעות)
            </div>
            {dumbFuture.map((t, i) => (
              <div key={i} style={{textAlign: 'center', padding: '10px 0', borderBottom: i < 3 ? '1px dotted #cbd5e1' : 'none'}}>
                <span style={{fontWeight:900, fontSize:20, color: C.textSoft}}>{fmtTime(t.getTime())}</span>
              </div>
            ))}
          </div>

          {/* עמודה שמאלית (התיקון החכם) */}
          <div style={{flex: 1, background: '#ecfdf5', padding: 10, borderRadius: 15, border: '1px solid #a7f3d0'}}>
            <div style={{fontWeight: 900, fontSize: 13, color: C.success, textAlign: 'center', marginBottom: 15, height: 35}}>
              התיקון המומלץ<br/>(יעד סופי: 23:15)
            </div>
            {smartFuture.map((t, i) => (
              <div key={i} style={{textAlign: 'center', padding: '10px 0', borderBottom: i < 3 ? '1px dotted #a7f3d0' : 'none'}}>
                <span style={{fontWeight:900, fontSize:20, color: '#059669'}}>{fmtTime(t.getTime())}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize: 12, color: C.textSoft, textAlign: 'center', lineHeight: 1.5, background: C.creamSoft, padding: 10, borderRadius: 10}}>
          <strong>היעד שלכם: נחיתה רכה ב-23:15.</strong><br/>
          בסיס החישוב הוא 7 ארוחות ביום. המערכת מחשבת את הזמן שנותר עד <strong>23:15</strong> ומחלקת אותו שווה בשווה. עקבו אחרי השעות הירוקות משמאל, והארוחה האחרונה תהיה בדיוק בזמן!
        </div>

        <button onClick={onClose} style={{...S.primaryBtn, marginTop:20}}>הבנתי, סגור</button>
      </div>
    </div>
  );
}

// ── Shift Handoff Modal (משמרת של 4 שעות עם תובנות אקטיביות) ──────────────
function HandoffModal({ events, vitaminDone, bathDone, onClose }) {
  const now = Date.now();
  const shiftHours = 4;
  const shiftMs = shiftHours * 60 * 60 * 1000;
  const shiftEvents = events.filter(e => (now - e.ts) < shiftMs);

  const feeds = shiftEvents.filter(e => e.type === "feed");
  const totalMl = feeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  const lastFeed = feeds.length > 0 ? feeds[0] : null;

  const diapers = shiftEvents.filter(e => e.type === "diaper");
  const peeCount = diapers.filter(e => e.pee).length;
  const poopCount = diapers.filter(e => e.poop).length;
  
  const bathDoneShift = shiftEvents.some(e => e.type === "bath");

  let todos = [];
  if (peeCount === 0) todos.push("לא הוחלף פיפי במשמרת הקודמת - לבדוק חיתול בהקדם.");
  if (poopCount === 0) todos.push("לא היה קקי ב-4 השעות האחרונות - לשים לב בהחתלות.");
  if (totalMl < 60) todos.push(`אכלה מעט יחסית (${totalMl} מ"ל) במשמרת - להקפיד על האכלה.`);
  if (!vitaminDone) todos.push("לא לשכוח לתת ויטמין D (עדיין לא סומן היום).");
  if (lastFeed) todos.push(`יעד משוער להאכלה הבאה: סביב ${fmtTime(lastFeed.ts + 4 * 60 * 60 * 1000)}.`);

  todos = todos.slice(0, 3);
  if (todos.length === 0) todos.push("הכל נראה מצוין! משמרת נעימה.");

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal, maxWidth: 400, padding: 0, overflow: 'hidden'}} onClick={e=>e.stopPropagation()}>
        <div style={{background: C.peach, padding: '25px 20px', textAlign: 'center', color: 'white'}}>
          <h3 className="kids-font" style={{margin: 0, fontSize: 26}}>העברת משמרת 🧸</h3>
          <p style={{margin: '5px 0 0', opacity: 0.9, fontSize: 14}}>תקציר מנהלים - {shiftHours} שעות אחרונות</p>
        </div>
        
        <div style={{padding: '25px 20px'}}>
          <div style={{marginBottom: 20}}>
            <h4 style={{color: C.peachDark, margin: '0 0 10px', fontSize: 18}}>🍼 תזונה</h4>
            <div style={{background: C.creamSoft, padding: 15, borderRadius: 15}}>
              {lastFeed ? (
                <>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom: 5}}>
                    <span style={{fontWeight: 800}}>האכלה אחרונה:</span>
                    <span style={{fontWeight: 900, color: C.text}}>{fmtTime(lastFeed.ts)} ({lastFeed.ml} מ"ל)</span>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span style={{fontWeight: 800}}>סה"כ במשמרת:</span>
                    <span style={{fontWeight: 900}}>{totalMl} מ"ל ({feeds.length} מנות)</span>
                  </div>
                </>
              ) : <div style={{fontWeight: 800}}>לא תועדו האכלות במשמרת זו.</div>}
            </div>
          </div>

          <div style={{marginBottom: 20}}>
            <h4 style={{color: C.purpleDark, margin: '0 0 10px', fontSize: 18}}>🧻 טיפול והחתלה</h4>
            <div style={{background: C.pastelPurple, padding: 15, borderRadius: 15}}>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom: 5}}>
                <span style={{fontWeight: 800}}>פיפי 💧:</span><span style={{fontWeight: 900}}>{peeCount} חיתולים</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginBottom: bathDoneShift ? 5 : 0}}>
                <span style={{fontWeight: 800}}>קקי 💩:</span><span style={{fontWeight: 900}}>{poopCount} חיתולים</span>
              </div>
              {bathDoneShift && (
                <div style={{display:'flex', justifyContent:'space-between', borderTop: '1px dotted #cbd5e1', paddingTop: 5, marginTop: 5}}>
                  <span style={{fontWeight: 800}}>מקלחת 🛁:</span><span style={{fontWeight: 900, color: C.success}}>עשתה היום!</span>
                </div>
              )}
            </div>
          </div>

          <div style={{marginBottom: 20}}>
            <h4 style={{color: C.warning, margin: '0 0 10px', fontSize: 18}}>🎯 לוודא במשמרת:</h4>
            <ul style={{margin: 0, paddingRight: 20, fontWeight: 700, color: C.textSoft, lineHeight: 1.6}}>
              {todos.map((todo, idx) => (
                <li key={idx} style={{marginBottom: 4}}>{todo}</li>
              ))}
            </ul>
          </div>

          <button onClick={onClose} style={S.primaryBtn}>סגור והמשך חפיפה</button>
        </div>
      </div>
    </div>
  );
}

// ── Views ───────────────────────────────────────────────────────────────
function HomeView({ events, setModal, onDelete }) {
  const todayFeeds = events.filter(e => e.type === "feed" && isToday(e.ts));
  const todayDiapers = events.filter(e => e.type === "diaper" && isToday(e.ts));
  
  const totalMl = todayFeeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  const feedCount = todayFeeds.length;
  const totalDiapers = todayDiapers.length;
  const totalPee = todayDiapers.filter(e => e.pee).length;
  const totalPoop = todayDiapers.filter(e => e.poop).length;

  const displayFeeds = events.filter(e => e.type === "feed").sort((a,b)=>b.ts-a.ts).slice(0, 15);
  const displayDiapers = events.filter(e => e.type === "diaper").sort((a,b)=>b.ts-a.ts).slice(0, 15);

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>

      <div style={{display:'flex', gap:10}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', color:'#854d0e', border:'1px solid #f7e0b5'}}>
          <span style={{fontSize: 34}}>🍼</span> האכלה
        </button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', color:'#701a75', border:'1px solid #e9d5ff'}}>
          <DiaperIcon size={34} /> החתלה
        </button>
        <button onClick={() => setModal("smartLog")} style={{...S.actionBtn, background:'#ecfdf5', color:'#064e3b', border:'1px solid #a7f3d0'}}>
          <span style={{fontSize: 34}}>🎤</span> חכם
        </button>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>היום של עלמה</div>
        
        <div style={S.summaryDashboard}>
          <div style={S.summaryColLeft}>
            <div style={S.summaryLabel}>סה"כ אוכל</div>
            <div style={S.summaryMainValue}>{totalMl} מ"ל</div>
            <div style={S.summarySubValue}>({feedCount} ארוחות)</div>
          </div>
          <div style={S.summaryColRight}>
            <div style={S.summaryLabel}>סה"כ החלפות</div>
            <div style={S.summaryMainValue}>{totalDiapers}</div>
            <div style={S.summarySubValue}>💧 {totalPee} | 💩 {totalPoop}</div>
          </div>
        </div>
        
        <div style={{display:'flex', gap:10, marginTop: 20}}>
          <div style={S.column(C.pastelYellow)}>
            <div style={S.columnHeader}><span style={{fontSize: 24}}>🍼</span></div>
            {displayFeeds.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div style={S.eventMiniCard}>
                  <div style={S.eventTimeRow}>
                    <span style={S.eventTimeText}>{formatEventTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input 
                    style={S.mlEditInput} 
                    value={e.ml || ""} 
                    placeholder='מ"ל' 
                    onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} 
                  />
                </div>
                {displayFeeds[i+1] && (
                  <div style={S.chainContainer}>
                    <div style={S.chainLine}></div>
                    <div style={S.chainText(C.pastelYellow)}>{getTimeGap(e.ts, displayFeeds[i+1].ts)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={S.column(C.pastelPurple)}>
            <div style={S.columnHeader}><DiaperIcon size={28} /></div>
            {displayDiapers.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                <div style={S.eventMiniCard}>
                  <div style={S.eventTimeRow}>
                    <span style={S.eventTimeText}>{formatEventTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <div style={S.diaperIconsRow}>
                    {e.pee && <span title="פיפי">💧</span>}
                    {e.poop && <span title="קקי">💩</span>}
                    {(!e.pee && !e.poop) && <DiaperIcon size={18} color="#cbd5e1"/>}
                  </div>
                </div>
                {displayDiapers[i+1] && (
                  <div style={S.chainContainer}>
                    <div style={S.chainLine}></div>
                    <div style={S.chainText(C.pastelPurple)}>{getTimeGap(e.ts, displayDiapers[i+1].ts)}</div>
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

function AnalyticsView({ events }) {
  const daysMap = {};
  events.forEach(e => {
    const d = new Date(e.ts).toDateString();
    if (!daysMap[d]) daysMap[d] = { ts: e.ts, ml: 0, count: 0 };
    if (e.type === "feed") {
      daysMap[d].ml += Number(e.ml || 0);
      daysMap[d].count += 1;
    }
  });

  const sortedDays = Object.values(daysMap).sort((a,b) => b.ts - a.ts).slice(0, 7);
  const chartDays = [...sortedDays].reverse(); 
  
  const maxMl = Math.max(...chartDays.map(d => d.ml), 100);
  const svgHeight = 160; const svgWidth = 320;
  const points = chartDays.map((d, i) => {
    const x = chartDays.length === 1 ? svgWidth / 2 : 25 + (i / (chartDays.length - 1)) * (svgWidth - 50);
    const y = svgHeight - 40 - ((d.ml / maxMl) * (svgHeight - 80));
    return { ...d, x, y };
  });

  const pathData = points.length > 1 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : "";
  const fillPath = points.length > 1 ? `${pathData} L ${points[points.length-1].x} ${svgHeight} L ${points[0].x} ${svgHeight} Z` : "";

  return (
    <div style={{display:'flex', flexDirection:'column', gap:20}}>
      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>מגמת תזונה</div>
        <div style={{ position: 'relative', width: '100%', height: svgHeight, marginTop: 10 }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.peach} stopOpacity="0.3"/><stop offset="100%" stopColor={C.peach} stopOpacity="0"/></linearGradient></defs>
            {points.length > 1 && <path d={fillPath} fill="url(#gr)" />}
            {points.length > 1 && <path d={pathData} fill="none" stroke={C.peachDark} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="6" fill="white" stroke={C.peachDark} strokeWidth="3" />
                <text x={p.x} y={p.y - 15} textAnchor="middle" fontSize="12" fontWeight="900" fill={C.text}>{p.ml}</text>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, direction: 'ltr' }}>
          {points.map(p => (
            <div key={p.ts} style={{ textAlign: 'center', flex: 1, direction: 'rtl' }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{getHebrewDay(p.ts)}</div>
              <div style={{ fontSize: 10, color: C.textSoft }}>{fmtDateShort(p.ts)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div className="kids-font" style={S.cardTitle}>פירוט יומי</div>
        {sortedDays.map(d => {
          const avg = d.count > 0 ? Math.round(d.ml / d.count) : 0;
          return (
            <div key={d.ts} style={S.summaryRow}>
              <div>
                <div style={{fontWeight: 800, fontSize: 16}}>{getHebrewDay(d.ts)}</div>
                <div style={{fontSize: 12, color: C.textSoft, fontWeight: 600}}>{fmtDateShort(d.ts)}</div>
              </div>
              <div style={{textAlign: 'left'}}>
                <div style={{color:C.peachDark, fontWeight:900, fontSize:18}}>🍼 {d.ml} מ"ל</div>
                <div style={{fontSize: 13, color: C.textSoft, fontWeight: 700, marginTop: 2}}>{d.count} ארוחות | ממוצע: {avg} מ"ל</div>
              </div>
            </div>
          );
        })}
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
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark, marginBottom: 15}}>האכלה 🍼</h3>
      
      <div style={{textAlign: 'center', color: '#cbd5e1', marginBottom: 10, fontSize: 14}}>בחירה מהירה (לא שומר אוטומטית):</div>
      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setMl("60")} style={S.chip(ml==="60")}>60 מ"ל</button>
        <button onClick={()=>setMl("90")} style={S.chip(ml==="90")}>90 מ"ל</button>
        <button onClick={()=>setMl("120")} style={S.chip(ml==="120")}>120 מ"ל</button>
      </div>

      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} style={S.input} />}
      
      <input type="number" placeholder='הקלד כמות מ"ל חופשית' value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
      
      <button onClick={()=>{onConfirm({type:'feed', ml, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={S.primaryBtn}>שמור</button>
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
      <h3 className="kids-font" style={{textAlign:'center', color:C.peachDark, marginBottom: 15}}>החתלה <DiaperIcon size={22} color={C.peachDark}/></h3>
      <div style={{display:'flex', gap:10, marginBottom:15}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} style={{...S.input, marginBottom:15}} />}
      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setPee(!pee)} style={S.chip(pee)}>💧 פיפי</button>
        <button onClick={()=>setPoop(!poop)} style={S.chip(poop)}>💩 קקי</button>
      </div>
      <button onClick={()=>{onConfirm({type:'diaper', pee, poop, manualTime: timeMode==='manual'?manualTime:null}); onClose();}} style={S.primaryBtn}>שמור</button>
    </div></div>
  );
}

const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "20px 15px 15px", borderRadius: "0 0 35px 35px", textAlign: "center", boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 14, color: "white", fontWeight: 700, opacity: 0.9 },
  babyBadge: { fontSize: 32, color: "white", fontWeight: 800, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "30px", padding: "15px", display: "inline-block", width: "100%", maxWidth: "350px", border: '1px solid rgba(255,255,255,0.3)' },
  progressBarContainer: { width: '100%', height: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', marginTop: '10px', overflow: 'hidden' },
  progressBarFill: { height: '100%', transition: 'width 0.8s ease' },
  
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 180px", zIndex: 1 },
  
  actionBtn: { flex: 1, padding: "15px 10px", borderRadius: "26px", fontSize: 18, fontWeight: 800, border:'none', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  card: { background: "#fffaf7", borderRadius: "32px", padding: "20px", boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border:'1px solid #f1f5f9', marginBottom: 20 },
  cardTitle: { fontSize: 21, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  
  summaryDashboard: { display: 'flex', background: C.creamSoft, borderRadius: '20px', padding: '15px', marginBottom: '20px', border: `1px solid ${C.border}` },
  summaryColLeft: { flex: 1, textAlign: 'center', borderLeft: `1px solid ${C.border}` },
  summaryColRight: { flex: 1, textAlign: 'center' },
  summaryLabel: { fontSize: 13, color: C.textSoft, fontWeight: 800, marginBottom: 4 },
  summaryMainValue: { fontSize: 20, fontWeight: 900, color: C.text },
  summarySubValue: { fontSize: 13, fontWeight: 800, color: C.peachDark, marginTop: 2 },

  column: (bgColor) => ({ flex: 1, display: "flex", flexDirection: "column", background: bgColor, padding: "10px", borderRadius: "16px", border: "1px solid rgba(0,0,0,0.05)" }),
  columnHeader: { textAlign: "center", marginBottom: 15, paddingTop: 5 },
  
  eventMiniCard: { display: "flex", flexDirection: "column", padding: "12px", borderRadius: "12px", background: C.white, boxShadow: '0 2px 6px rgba(0,0,0,0.04)', width: '100%', position: 'relative', zIndex: 2 },
  eventTimeRow: { display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 8 },
  eventTimeText: { fontWeight: 800, fontSize: 13, color: C.textSoft },
  
  mlEditInput: { width: '100%', border: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: 8, textAlign: 'center', fontWeight: 900, fontSize: 16, padding: '8px 0', color: C.text },
  diaperIconsRow: { display: 'flex', justifyContent: 'center', gap: 8, fontSize: 20, padding: '4px 0' },
  
  chainContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '40px', justifyContent: 'center', position: 'relative' },
  chainLine: { position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', borderLeft: `2px dashed ${C.peach}`, opacity: 0.5, zIndex: 1 },
  chainText: (bgColor) => ({ background: bgColor, padding: '2px 8px', borderRadius: '10px', fontSize: 11, fontWeight: 800, color: C.textSoft, zIndex: 2 }),

  delBtn: { background:'none', border:'none', color: '#cbd5e1', fontSize: 14, cursor: 'pointer', padding: 0 },
  
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", padding: "18px 25px 40px", borderTop: '1px solid #f1f5f9', boxShadow: '0 -5px 20px rgba(0,0,0,0.05)', zIndex: 1000 },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "16px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 17 }),
  
  aiFab: { position: "fixed", bottom: 110, right: 25, background: "transparent", border: "none", fontSize: 48, zIndex: 1001, cursor: "pointer", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" },
  handoffFab: { position: "fixed", bottom: 110, left: 25, background: "transparent", border: "none", fontSize: 48, zIndex: 1001, cursor: "pointer", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" },
  
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal: { background: "white", padding: "35px", borderRadius: "40px", width: "100%" },
  chip: (active) => ({ flex: 1, padding: "14px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #f1f5f9", background: active ? C.creamSoft : "#f8fafc", fontWeight: 800, color: active ? C.peachDark : C.textSoft }),
  input: { width: "100%", padding: "18px", borderRadius: "18px", border: `2px solid #f1f5f9`, marginBottom: 20, textAlign: "center", fontSize: 22, fontWeight: 700, fontFamily: FONT_MAIN },
  primaryBtn: { width: "100%", padding: "20px", borderRadius: "22px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 19, fontFamily: FONT_MAIN },
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:'1px solid #f9fafb' },
  undoToast: { position: 'fixed', bottom: 120, left: 20, right: 20, background: '#333', color: 'white', padding: '15px 25px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 9999 }
};
