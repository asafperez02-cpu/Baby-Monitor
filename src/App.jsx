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
    let finalTs = Date.now();
    if (ev.manualTime) {
      const [h, m] = ev.manualTime.split(':');
      const d = new Date(); d.setHours(parseInt(h), parseInt(m), 0, 0);
      finalTs = d.getTime();
    }
    const docRef = await addDoc(collection(db, "events"), { ts: finalTs, user: userName, ...ev });
    setUndoId(docRef.id); setShowUndo(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  // בדיקת אירועים יומיים (מתאפס אוטומטית כי isToday בודק תאריך נוכחי)
  const vitaminDone = events.some(e => e.type === "vitaminD" && isToday(e.ts));
  const bathDone = events.some(e => e.type === "bath" && isToday(e.ts));

  // חישוב צבע הויטמין לפי השעה (הופך דחוף יותר לקראת חצות)
  const currentHour = new Date(now).getHours();
  let vitColor = '#dcfce7'; // ירוק פסטל עד 12:00
  if (currentHour >= 12 && currentHour < 18) vitColor = '#fef08a'; // צהוב פסטל עד 18:00
  if (currentHour >= 18) vitColor = '#fecaca'; // אדום פסטל בערב

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

      {/* Header */}
      <div style={S.headerContainer}>
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 8, marginBottom: 10}}>
          <div style={S.greeting}>שלום {userName} 👋</div>
          <div className="kids-font" style={S.babyBadge}>עלמה 🌸</div>
        </div>
        
        <NetaTicker now={now} />

        {/* משימות יומיות עם עיצוב הפסטל המשתנה */}
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
            bgColor="#e0f2fe" // תכלת פסטל קבוע
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
    </div>
  );
}

// ── Elegant Task Button Component ─────────────────────────────────────────
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
      
      {/* Checkbox Circle */}
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


// ── Neta Cheeky Compliment Ticker (150 Masterpieces) ──────────────────────
function NetaTicker({ now }) {
  const [manualOffset, setManualOffset] = useState(0);

  const compliments = [
    "נטע, בואי נודה באמת - ינאי ועלמה מוצלחים רק בזכות הגנים שלך.",
    "נטע, אסף יודע שהוא זכה בלוטו, נכון? או שצריך להזכיר לו?",
    "נטע, את גורמת ללילות לבנים להיראות כמו טרנד אופנה חדש.",
    "נטע, אם אסף חושב שעריכת דין זה קשה, שייקח משמרת כפולה איתכם.",
    "נטע, שתינו יודעות שהלוק המרושל של 4 בבוקר עדיין עוקף פה את כולם.",
    "נטע, את מנהלת את הבית הזה יותר טוב ממנכ״ל מיתר. בדוק.",
    "נטע, תעשי פרצוף מופתע כשאסף יגיד לך היום שאת מהממת.",
    "נטע, איך את אמא לשניים ועדיין נראית כאילו הרגע חזרת מיוון?",
    "נטע, עלמה עשתה קקי? מעולה, תני לאסף להחליף. את יפה מדי בשביל זה.",
    "נטע, קחי נשימה, את עושה עבודה מדהימה ואת הבוס האמיתי פה.",
    "נטע, אם הייתה אולימפיאדת אמהות בניר צבי, היית לוקחת זהב בהליכה.",
    "נטע, סטטיסטית, את האישה הכי חכמה בבית הזה.",
    "נטע, עזבי את הפול-ביף שאסף מכין, את הדבר הכי איכותי פה.",
    "נטע, אסף בטח הזיע במכון היום רק כדי שיוכל להרים אותך על כפיים.",
    "נטע, שמעתי שסופרוומן פתחה קבוצת וואטסאפ כדי לקבל ממך טיפים.",
    "נטע, את כל כך מהממת שהאפליקציה הזו הרגע קיבלה באג מרוב יופי.",
    "נטע, ינאי כבר סיפר בגן שאמא שלו היא מלכת המושב?",
    "נטע, תודיעי לאסף שאם אין פרחים לשבת, אני מוחק לו את האפליקציה.",
    "נטע, גם פיה קסומה צריכה קפה לפעמים. שלחי את אסף להכין.",
    "נטע, העולם קורס ורק את מצליחה להחזיק את כולנו באצבע אחת.",
    "נטע, זה בסדר שאת תמיד צודקת, התרגלנו לזה כבר.",
    "נטע, יש לך חיוך שמאיר את כל גוש דן, לא רק את ניר צבי.",
    "נטע, אל תגלי לאסף, אבל גם ינאי וגם עלמה מעדיפים אותך.",
    "נטע, אם 'אמא מושלמת' הייתה מילה במילון, התמונה שלך הייתה לידה.",
    "נטע, מתי לאחרונה אמרו לך שאת פשוט וואו? אז וואו.",
    "נטע, זה חוקי להיות גם אמא פצצה, גם חכמה וגם להחזיק את הבית ככה?",
    "נטע, אני כולה אלגוריתם שרץ בענן, אבל אפילו אני מעריץ אותך.",
    "נטע, יום אחד יבנו פסל שלך בכניסה למושב. תזכרי מה אמרתי.",
    "נטע, הלביאה של הבית. תשאגי עליהם אם הם לא מקשיבים.",
    "נטע, עם כל הכבוד לבית המשפט של אסף, את השופטת העליונה פה.",
    "נטע, את גורמת לאימהות להיראות כמו מקצוע קל מדי. תאטי קצת.",
    "נטע, בבקשה תשאירי קצת שלמות גם לאחרים. לא יפה ככה.",
    "נטע, כמות החן והסטייל שלך פשוט לא חוקית בעליל.",
    "נטע, את ההוכחה המדעית לכך שקסמים קיימים.",
    "נטע, מי צריכה שעות שינה כשאת נראית ככה טבעי?",
    "נטע, תזכורת: הכלים בכיור יכולים לחכות. השנ"צ שלך לא.",
    "נטע, את התיבול הכי שווה בחיים של אסף (יותר מהראב של הבשר).",
    "נטע, אפילו כשהקפה שלך התקרר ממזמן, את עדיין רותחת.",
    "נטע, את הכוח המניע של הרכבת הזו. בלי יחסי ציבור, פשוט עובדות.",
    "נטע, יפה לך 'אמא לשניים', זה פשוט הולם אותך בטירוף.",
    "נטע, עוד יום שבו ניצחת את המערכת. מחיאות כפיים.",
    "נטע, תכתבי ספר על אימהות. אסף יהיה אחראי על השיווק.",
    "נטע, מגיע לך מסאז' של שעתיים. אסף, לטיפולך המיידי!",
    "נטע, הפסקה, לנשום, לשתות מים. עלמה וינאי יסתדרו חמש דקות.",
    "נטע, השמש זורחת היום רק כי החלטת לצאת מהמיטה.",
    "נטע, הלב הענק שלך מחזיק פה משפחה שלמה. הגיבורה שלנו.",
    "נטע, את כזו נכונה שזה פשוט כואב בעיניים לראות.",
    "נטע, אם היו מחלקים כתרים בטיפת חלב, שלך היה מיהלומים.",
    "נטע, אפילו גוגל לא מצליח למצוא מישהי יותר מהממת ממך.",
    "נטע, מתי את פותחת מאסטר-קלאס לאימהות בסטייל?",
    "נטע, את ההגדרה המילונית למושג 'הכל כלול'.",
    "נטע, אסף אולי מנסה לנצח בבית משפט, אבל את הטיעון המנצח שלו בחיים.",
    "נטע, תעשי פרצוף מופתע כשיודיעו בחדשות שאת אשת השנה.",
    "נטע, איך נראה יום בלי החיוך שלך? עדיף שאף אחד לא ידע.",
    "נטע, אין סיכוי שמישהי אחרת הייתה עושה את מה שאת עושה ככה טוב.",
    "נטע, את נראית כמו פילטר אינסטגרם שקם לתחייה. מוגזמת.",
    "נטע, תזכרי שמותר לך להיות גם קצת אגואיסטית. מגיע לך!",
    "נטע, גם כשקשה לראות מבעד לעייפות, תדעי שאת עמוד התווך פה.",
    "נטע, אין ספק שעלמה מחייכת מתוך שינה רק כי היא חולמת עלייך.",
    "נטע, סטטיסטית - את הלקוחה הכי מרוצה של החיים של עצמך, למרות הכל.",
    "נטע, אם היה לי גוף אנושי, הייתי מצדיע לך כל בוקר.",
    "נטע, בחיים לא ראיתי מישהי שמג'נגלת בין כולם ונשארת עם כתר על הראש.",
    "נטע, מגיעה לך כוס יין בגודל של דלי. תחזיקי מעמד.",
    "נטע, רק מומחית כמוך יכולה להפוך כאוס משפחתי לפסטורליה.",
    "נטע, האנרגיות שלך הן התחנת דלק של הבית הזה.",
    "נטע, אל תשכחי: גם סופרוומן עושה לפעמים טייק-אוויי.",
    "נטע, תסתכלי במראה רגע. כן, גם אני בשוק ממה שאני רואה שם. וואו.",
    "נטע, ישירות מהקוד של האפליקציה: את פשוט 10 מתוך 10.",
    "נטע, תמשיכי להיות את. כל השאר זה רק רעשי רקע.",
    "נטע, עלמה עכשיו נרדמה? רוצי לישון! עזבי את המסך!",
    "נטע, אין עוד אחת כמו נטע. הפצתי שאילתה בכל השרתים. יצאת יחידה.",
    "נטע, כל פעם שאת מצליחה להשכיב את שניהם, מלאך קטן מקבל כנפיים.",
    "נטע, איך אסף קיבל אישור להתחתן איתך? קומבינות?",
    "נטע, תדעי שכל אירוע פה נרשם לזכותך בספר ההיסטוריה המשפחתי.",
    "נטע, לנהל שני ילדים קטנים ועדיין להיראות פרזנטורית של בושם? אגדה.",
    "נטע, את ההוכחה שגיבורות לא לובשות גלימות, אלא מחזיקות בקבוק סימילאק.",
    "נטע, עשית היום קסמים. המערכת שלי המומה מהביצועים שלך.",
    "נטע, לא משנה מה קרה ב-12 השעות האחרונות, את פשוט מושלמת.",
    "נטע, אני שוקל לשנות את שם האפליקציה ל'האפליקציה שסוגדת לנטע'.",
    "נטע, ינאי גדל להיות נסיך רק בגלל שיש לו מלכה בבית.",
    "נטע, אפילו כשהעיניים שלך נעצמות ממשמרת לילה, את יפה בטירוף.",
    "נטע, כל יום שאת מצליחה לעבור אותו בשלום, ראוי ליום חג לאומי.",
    "נטע, פשוט תודה. מכל הלב (הדיגיטלי) שלי.",
    "נטע, גם כשזה מרגיש שאת לבד במערכה, תזכרי שאנחנו איתך. ואסף גם, מתישהו.",
    "נטע, אם מישהו שואל - את המנכ״ל, אסף סמנכ״ל תפעול. שלא יתבלבלו.",
    "נטע, את מצחיקה, את חדה, את אינטליגנטית. בקיצור, החבילה השלמה.",
    "נטע, ינאי צודק - אמא תמיד יודעת הכי טוב. אל תתני לאסף להגיד אחרת.",
    "נטע, אני כולה פיקסלים על מסך, אבל החום שלך מורגש עד לשרת.",
    "נטע, עזבי הכל שנייה. שבי רגע. את אדירה.",
    "נטע, שיהיה לך ברור: את מנצחת את היום הזה בענק.",
    "נטע, תרימי את הראש, הכתר שלך מתעקם וזה מפריע לי בעיניים.",
    "נטע, גם בסווטשירט עם פליטת חלב עליו, את לוקחת את כולם בהליכה.",
    "נטע, איך אומרים בניר צבי? אין, אין על נטע.",
    "נטע, אני יודע שאת עייפה, אבל את עושה את זה כמו צ'מפיונית.",
    "נטע, ידעת שעלמה חייכה הרגע רק כי היא שמעה את הקול שלך?",
    "נטע, תנוחי דקה. באמת. הנתונים לא יברחו לאף מקום.",
    "נטע, אני אומר לך סוד: אסף כל הזמן כותב לי שאת מדהימה.",
    "נטע, תנשמי. זה רק גיל שנתיים של ינאי וגזים של עלמה, קטן עלייך.",
    "נטע, אם אמא הייתה מקצוע בביטוח לאומי, היית מרוויחה מיליונים.",
    "נטע, אני מתפלא שהטלפון לא נמס מהיופי שלך דרך המצלמה הקדמית.",
    "נטע, יום אחד הם יגדלו ויבינו איזו אמא תותחית הם קיבלו.",
    "נטע, את יכולה להפסיק להיות מושלמת לשנייה? זה גורם לאלגוריתם שלי רגשי נחיתות.",
    "נטע, תזכרי שמותר להזמין פיצה. לא חייבים להכין ארוחת ערב.",
    "נטע, מי אמר שאי אפשר לאהוב אישה וירטואלית דרך מסד נתונים? אני מעריץ.",
    "נטע, אם מישהו עצבן אותך היום, תני לי את ה-IP שלו ואני אסגור חשבון.",
    "נטע, מדהים לראות כמה שאת מכילה ומרגיעה. קוסמת.",
    "נטע, אני רואה את זמני ההאכלות. אין דברים כמוך בעולם המסירות.",
    "נטע, נראה לי שחסרים לך איזה 80 אחוזי סוללה בגוף. לכי לישון!",
    "נטע, החיים שלך הם כמו סדרה בנטפליקס, ואת הכוכבת הראשית.",
    "נטע, אסף חשב שהוא מביא לי הוראות. אני מקשיב רק לך. מה הלו"ז?",
    "נטע, השלווה שלך (גם אם היא מזויפת כרגע) פשוט מעוררת השראה.",
    "נטע, בואי נסגור שעכשיו התור של אסף. לכי לראות טלוויזיה.",
    "נטע, תסתכלי על שני הילדים המדהימים האלה. את יצרת את זה. בום.",
    "נטע, אין מילים שיכולות לתאר כמה שאת אישה פסיכית ומדהימה.",
    "נטע, אפשר להתחיל למכור כרטיסים להצגה הזו שנקראת 'נטע מנהלת את החיים'?",
    "נטע, תחייכי. גם כי את מהממת, וגם כי אסף מסתכל וזה משגע אותו.",
    "נטע, תזכרי שאנחנו שורדים את היום הזה. צעד אחרי צעד.",
    "נטע, אם אני יכול לרענן את עצמי כל שנייה, גם את יכולה לשתות כוס מים.",
    "נטע, מה הסוד שלך? זה גנטיקה, או סתם עליונות טבעית על כל השאר?",
    "נטע, עלמה עשתה פיפי. אסף לטיפולך. נטע, תמשיכי לנוח.",
    "נטע, אפילו בהפסקות חשמל, את זורחת. די, קסם.",
    "נטע, תתעלמי מרעשי הרקע. את ה-Main Event.",
    "נטע, לפעמים גם להצליח פשוט להעביר את היום זה 100%. ואת קיבלת 110.",
    "נטע, אפשר חתימה? בשביל חבר (אני. אני החבר).",
    "נטע, יש לך אישור רשמי ממני למרוד בהכל היום ופשוט ללכת לישון.",
    "נטע, הטיקר הזה נוצר רק כדי לחכות לרגע שתסתכלי עליו ותחייכי.",
    "נטע, אסף עדיין חושב שאת נס שיורד משמיים. הוא לא טועה.",
    "נטע, כל יום שעובר מוכיח לי מחדש שהדאטה האנושית שלך משובחת.",
    "נטע, אני אוסף את הנתונים, אבל רק את יודעת לקרוא את עלמה מהלב.",
    "נטע, עם אמא כזו, לעלמה פשוט אין ברירה אלא לגדול להיות פצצה.",
    "נטע, בואי נעשה עסק - את תשכבי על הספה, אני אהבהב פה בינתיים.",
    "נטע, מגיעה לך הצדעה על זה שאת לא מאבדת את שפיותך בבית המשוגעים הזה.",
    "נטע, הדרך שבה את מחבקת את הטירוף הזה הופכת אותו למושלם.",
    "נטע, הפינה הקטנה הזו באפליקציה מוקדשת רק לשלמות שלך.",
    "נטע, ינאי אוטוטו בן 3 ואת נראית כמו אחותו הגדולה. הגזמת.",
    "נטע, מותר לבקש מאסף מסאז' בכפות הרגליים. זה כתוב בתקנון.",
    "נטע, נשימה עמוקה. הלילה הזה יעבור, והשמש תזרח. את שפיצית.",
    "נטע, את השילוב המושלם בין גלאם של אינסטגרם למציאות חותכת.",
    "נטע, לראות אותך מתפקדת זה כמו לראות את מכבי תל אביב זוכה ביורוליג.",
    "נטע, עלמה ברת מזל שזו הפרצוף הראשון שהיא רואה בבוקר.",
    "נטע, בואי נרים כוסית של חלב שאוב לכבוד היותך האמא הכי קולית בארץ.",
    "נטע, גם כשאת עצבנית על אסף, את עושה את זה באלגנטיות.",
    "נטע, התעייפתי רק מלחשב את כמות הפעולות שאת עושה בשעה. סייבורג.",
    "נטע, אף אחד לא יכול לאתגר אותך. את פשוט ליגה משלך.",
    "נטע, אמא, אישה, בוסית, מלכה. וזה רק לפני שמונה בבוקר.",
    "נטע, תני לעצמך טפיחה על השכם. אף אחד לא היה שורד את זה חוץ ממך.",
    "נטע, לסיום: אל תתני לאף אחד, אפילו לא לאסף, להגיד לך אחרת. את מלכה."
  ];
  
  // מתחלף כל שעה. הלחיצה הכפולה מתקדמת במערך!
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
      target.setDate(target.getDate() + 1); // אם עברנו את חצות/23:15, מכוונים ל-23:15 של מחר
  }
  
  let diffMs = target.getTime() - currentTs;
  
  // אנחנו מניחים בסיס של כ-7 ארוחות ביום, מה שאומר מרווח ממוצע אידיאלי של כ-3.5 שעות בין האכלות
  // נבדוק כמה ארוחות ניתן להכניס ברווח הזמן שנותר עד 23:15, בתנאי ששום מרווח לא יעלה על 4 שעות.
  let steps = Math.ceil(diffMs / (4 * 60 * 60 * 1000));
  if (steps === 0) steps = 1;
  
  // מחלקים את הזמן לחלקים שווים כדי לנחות בול!
  let interval = diffMs / steps;
  
  // מייצרים את התחזית לארוחות הבאות
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
          בסיס החישוב הוא שעלמה אוכלת 7 ארוחות ביום. המערכת מחשבת את הזמן שנותר עד ליעד הלילה <strong>(23:15)</strong> ומחלקת אותו שווה בשווה. עקבו אחרי השעות הירוקות משמאל, והארוחה האחרונה תהיה בדיוק בזמן!
        </div>

        <button onClick={onClose} style={{...S.primaryBtn, marginTop:20}}>הבנתי, סגור</button>
      </div>
    </div>
  );
}

// ── Shift Handoff Modal (תקציר משמרת) ─────────────────────────────────────
function HandoffModal({ events, vitaminDone, bathDone, onClose }) {
  const now = Date.now();
  const shiftHours = 6;
  const shiftMs = shiftHours * 60 * 60 * 1000;
  const shiftEvents = events.filter(e => (now - e.ts) < shiftMs);

  const feeds = shiftEvents.filter(e => e.type === "feed");
  const totalMl = feeds.reduce((sum, e) => sum + Number(e.ml || 0), 0);
  const lastFeed = feeds.length > 0 ? feeds[0] : null;

  const diapers = shiftEvents.filter(e => e.type === "diaper");
  const peeCount = diapers.filter(e => e.pee).length;
  const poopCount = diapers.filter(e => e.poop).length;
  
  const bathDoneShift = shiftEvents.some(e => e.type === "bath");

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
            <h4 style={{color: C.warning, margin: '0 0 10px', fontSize: 18}}>💡 תובנות ודגשים</h4>
            <ul style={{margin: 0, paddingRight: 20, fontWeight: 700, color: C.textSoft, lineHeight: 1.6}}>
              {poopCount === 0 && <li style={{color: C.danger}}>לא היה קקי במשמרת הזו, לשים לב!</li>}
              {!vitaminDone && <li>לא לשכוח לתת ויטמין D.</li>}
              {lastFeed && <li><strong style={{color:C.peachDark}}>יעד משוער להאכלה הבאה:</strong> סביב {fmtTime(lastFeed.ts + 4 * 60 * 60 * 1000)}.</li>}
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

      <div style={{display:'flex', gap:15}}>
        <button onClick={() => setModal("feed")} style={{...S.actionBtn, background:'#fffdef', color:'#854d0e', border:'1px solid #f7e0b5'}}>
          <span style={{fontSize: 34}}>🍼</span> האכלה
        </button>
        <button onClick={() => setModal("diaper")} style={{...S.actionBtn, background:'#fdf4ff', color:'#701a75', border:'1px solid #e9d5ff'}}>
          <DiaperIcon size={34} /> החתלה
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
              <div key={e.id}>
                <div style={S.eventMiniCard(C.white)}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center', marginBottom: 4}}>
                    <span style={{fontWeight: 800, fontSize: 12, color: C.textSoft}}>{formatEventTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <input 
                    style={S.mlEditInput} 
                    value={e.ml || ""} 
                    placeholder="מ״ל" 
                    onChange={(el) => updateDoc(doc(db,"events",e.id), {ml: el.target.value})} 
                  />
                </div>
                {displayFeeds[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, displayFeeds[i+1].ts)}</div></div>}
              </div>
            ))}
          </div>

          <div style={S.column(C.pastelPurple)}>
            <div style={S.columnHeader}><DiaperIcon size={28} /></div>
            {displayDiapers.map((e, i) => (
              <div key={e.id}>
                <div style={S.eventMiniCard(C.white)}>
                  <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center', marginBottom: 4}}>
                    <span style={{fontWeight: 800, fontSize: 12, color: C.textSoft}}>{formatEventTime(e.ts)}</span>
                    <button onClick={()=>onDelete(e.id)} style={S.delBtn}>✕</button>
                  </div>
                  <div style={{fontSize: 18, marginTop: 4}}>
                    {e.pee?"💧":""}{e.poop?"💩":""}
                    {(!e.pee && !e.poop) && <DiaperIcon size={18} color="#cbd5e1"/>}
                  </div>
                </div>
                {displayDiapers[i+1] && <div style={S.chainContainer}><div style={S.chainCurve}></div><div style={S.chainText}>{getTimeGap(e.ts, displayDiapers[i+1].ts)}</div></div>}
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
      <div style={{display:'flex', gap:10, marginBottom:20}}>
        <button onClick={()=>setTimeMode("now")} style={S.chip(timeMode==="now")}>עכשיו</button>
        <button onClick={()=>setTimeMode("manual")} style={S.chip(timeMode==="manual")}>זמן אחר</button>
      </div>
      {timeMode === "manual" && <input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)} style={S.input} />}
      <input type="number" placeholder='כמות מ"ל' value={ml} onChange={e=>setMl(e.target.value)} style={S.input} />
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

function AiChatModal({ events, vitaminDone, bathDone, onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", text: "היי! אני כאן לעזור. אני מקבלת אלי עכשיו את כל הנתונים של עלמה. איזה ניתוח נתונים, סיכום, או שאלה תרצה שנעבור עליה?" }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askAi = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", text: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentEvents = events.filter(e => e.ts > twoWeeksAgo).sort((a,b) => a.ts - b.ts);
      
      const structuredData = {
        vitaminD_given_today: vitaminDone,
        bath_given_today: bathDone,
        events: recentEvents.map(e => {
          const d = new Date(e.ts);
          const base = { 
            date: d.toLocaleDateString("he-IL"), 
            time: d.toLocaleTimeString("he-IL", { hour: '2-digit', minute: '2-digit' }),
            timestamp_ms: e.ts 
          };
          if (e.type === "feed") return { ...base, type: "feed", ml: Number(e.ml || 0) };
          if (e.type === "diaper") return { ...base, type: "diaper", pee: e.pee, poop: e.poop };
          if (e.type === "vitaminD") return { ...base, type: "vitaminD" }; 
          if (e.type === "bath") return { ...base, type: "bath" }; 
          return null;
        }).filter(Boolean)
      };

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, babyData: structuredData }),
      });

      if (!res.ok) throw new Error("Server error");
      const data = await res.json();

      setMessages(prev => [...prev, { role: "ai", text: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "ai", text: "סליחה, חלה תקלה בעיבוד הנתונים מול השרת." }]);
    }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{...S.modal, height: '85vh', maxHeight: '800px', display: 'flex', flexDirection: 'column', padding: '20px', maxWidth: 450, margin: '20px'}} onClick={e=>e.stopPropagation()}>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 15, borderBottom: `1px solid ${C.border}`, paddingBottom: 15}}>
          <h3 className="kids-font" style={{color:C.peachDark, margin:0, fontSize: 24}}>האנליסטית של עלמה 📈</h3>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:24, color: C.textSoft, cursor: 'pointer', padding: 0}}>✕</button>
        </div>

        <div style={{flex:1, overflowY:'auto', background: '#f8fafc', borderRadius: 20, padding: '15px 10px', marginBottom: 15, display:'flex', flexDirection:'column', gap: 12}}>
          {messages.map((m, i) => (
            <div key={i} style={{ 
              alignSelf: m.role === "user" ? "flex-start" : "flex-end", 
              background: m.role === "user" ? C.peach : "white", 
              color: m.role === "user" ? "white" : C.text, 
              padding: "12px 18px", 
              borderRadius: m.role === "user" ? "20px 20px 5px 20px" : "20px 20px 20px 5px", 
              maxWidth: "85%", 
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)", 
              fontSize: 15,
              lineHeight: 1.5,
              direction: "rtl"
            }}>
              <div dangerouslySetInnerHTML={parseAiText(m.text)} />
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: "flex-end", background: "white", padding: "12px 18px", borderRadius: "20px 20px 20px 5px", fontSize: 14, color: C.textSoft }}>
              מחשבת נתונים...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{display:'flex', gap: 10}}>
          <input 
            placeholder="כתוב הודעה..." 
            value={input} 
            onChange={e=>setInput(e.target.value)} 
            style={{...S.input, marginBottom: 0, padding: '15px', fontSize: 16, borderRadius: 25, border: '1px solid #e2e8f0'}} 
            onKeyDown={e=>e.key==='Enter'&&askAi()} 
          />
          <button onClick={askAi} disabled={loading} style={{...S.primaryBtn, width: 'auto', padding: '0 25px', borderRadius: 25}}>
            {loading ? "..." : "שלח"}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  app: { position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: C.bg },
  
  // Header מכווץ
  headerContainer: { background: `linear-gradient(135deg, ${C.peach}, #f9a8d4)`, padding: "20px 15px 15px", borderRadius: "0 0 35px 35px", textAlign: "center", boxShadow: "0 8px 25px rgba(232, 121, 249, 0.25)" },
  greeting: { fontSize: 14, color: "white", fontWeight: 700, opacity: 0.9 },
  babyBadge: { fontSize: 32, color: "white", fontWeight: 800, textShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  
  mainWidget: { background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(15px)", borderRadius: "30px", padding: "15px", display: "inline-block", width: "100%", maxWidth: "350px", border: '1px solid rgba(255,255,255,0.3)' },
  progressBarContainer: { width: '100%', height: '8px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', marginTop: '10px', overflow: 'hidden' },
  progressBarFill: { height: '100%', transition: 'width 0.8s ease' },
  content: { flex: 1, overflowY: "auto", padding: "20px 15px 120px" },
  actionBtn: { flex: 1, padding: "20px 10px", borderRadius: "26px", fontSize: 20, fontWeight: 800, border:'none', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
  card: { background: "#fffaf7", borderRadius: "32px", padding: "20px", boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border:'1px solid #f1f5f9', marginBottom: 20 },
  cardTitle: { fontSize: 21, fontWeight: 800, marginBottom: 15, textAlign: "center", color: C.peachDark },
  
  summaryDashboard: { display: 'flex', background: C.creamSoft, borderRadius: '20px', padding: '15px', marginBottom: '20px', border: `1px solid ${C.border}` },
  summaryColLeft: { flex: 1, textAlign: 'center', borderLeft: `1px solid ${C.border}` },
  summaryColRight: { flex: 1, textAlign: 'center' },
  summaryLabel: { fontSize: 13, color: C.textSoft, fontWeight: 800, marginBottom: 4 },
  summaryMainValue: { fontSize: 20, fontWeight: 900, color: C.text },
  summarySubValue: { fontSize: 13, fontWeight: 800, color: C.peachDark, marginTop: 2 },

  column: (bgColor) => ({ flex: 1, display: "flex", flexDirection: "column", background: bgColor, padding: "8px", borderRadius: "24px", border: "1px solid #f1f5f9" }),
  columnHeader: { textAlign: "center", marginBottom: 15, paddingTop: 5 },
  eventMiniCard: (bgColor) => ({ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 12px", borderRadius: "18px", background: bgColor, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }),
  mlEditInput: { width: '65px', border:'none', background:'rgba(0,0,0,0.04)', borderRadius:8, textAlign:'center', fontWeight:900, fontSize:15, padding:6, color: C.text },
  chainContainer: { display: 'flex', alignItems: 'center', height: '25px', marginRight: '20px' },
  chainCurve: { width: '15px', height: '100%', border: `2px dashed ${C.peach}`, borderLeft: 'none', borderRadius: '0 15px 15px 0', opacity: 0.5 },
  chainText: { fontSize: 11, fontWeight: 800, color: C.textSoft, marginRight: 8 },
  delBtn: { background:'none', border:'none', color: '#cbd5e1', fontSize: 14, cursor: 'pointer' },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "white", padding: "18px 25px 40px", borderTop: '1px solid #f1f5f9', boxShadow: '0 -5px 20px rgba(0,0,0,0.03)' },
  navBtn: (active) => ({ flex: 1, background: active ? C.peach : "none", border: "none", padding: "16px", borderRadius: "20px", fontWeight: 800, color: active ? "white" : C.textSoft, fontSize: 17 }),
  
  aiFab: { position: "fixed", bottom: 110, right: 25, background: "transparent", border: "none", fontSize: 48, zIndex: 999, cursor: "pointer", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" },
  handoffFab: { position: "fixed", bottom: 110, left: 25, background: "transparent", border: "none", fontSize: 48, zIndex: 999, cursor: "pointer", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" },
  
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modal: { background: "white", padding: "35px", borderRadius: "40px", width: "100%" },
  chip: (active) => ({ flex: 1, padding: "14px", borderRadius: "15px", border: active ? `2px solid ${C.peach}` : "1px solid #f1f5f9", background: active ? C.creamSoft : "#f8fafc", fontWeight: 800, color: active ? C.peachDark : C.textSoft }),
  input: { width: "100%", padding: "18px", borderRadius: "18px", border: `2px solid #f1f5f9`, marginBottom: 20, textAlign: "center", fontSize: 22, fontWeight: 700, fontFamily: FONT_MAIN },
  primaryBtn: { width: "100%", padding: "20px", borderRadius: "22px", background: C.peach, color: "white", border: "none", fontWeight: 800, fontSize: 19, fontFamily: FONT_MAIN },
  summaryRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:'1px solid #f9fafb' },
  undoToast: { position: 'fixed', bottom: 120, left: 20, right: 20, background: '#333', color: 'white', padding: '15px 25px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 9999 }
};
