import React, { useState, useEffect } from "react";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

// עיצוב פסטלי עדין
const C = {
  bg: "#fdf6f0",
  accent: "#f4a58a", // אפרסק
  sleep: "#c9b8e8",  // סגול
  diaper: "#f9b8c4", // ורוד
  text: "#5c3d2e",
  white: "#ffffff"
};

export default function BabyApp() {
  const [events, setEvents] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("ts", "desc"));
    return onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const addEvent = async (type) => {
    await addDoc(collection(db, "events"), {
      type,
      ts: Date.now(),
      note: text
    });
    setText("");
  };

  return (
    <div style={{ padding: "20px", fontFamily: "'Heebo', sans-serif", direction: "rtl", maxWidth: "480px", margin: "0 auto", background: C.bg, minHeight: "100vh" }}>
      <h2 style={{ textAlign: "center", color: C.text }}>יומן התינוקת 🍼</h2>
      
      {/* כפתורי פעולה */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        <button onClick={() => addEvent("feed")} style={btnStyle(C.accent)}>🍼 האכלה</button>
        <button onClick={() => addEvent("sleep")} style={btnStyle(C.sleep)}>😴 שינה</button>
        <button onClick={() => addEvent("diaper")} style={btnStyle(C.diaper)}>🧷 חיתול</button>
        <button onClick={() => addEvent("note")} style={btnStyle("#eee")}>📝 הערה</button>
      </div>

      <input 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder="הערה או כמות (מ'ל)..." 
        style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "12px", border: "1px solid #ddd", fontSize: "16px" }}
      />

      <h3 style={{ color: C.text, fontSize: "18px", borderBottom: `2px solid ${C.accent}`, display: "inline-block" }}>היסטוריה אחרונה</h3>
      
      <div style={{ marginTop: "15px" }}>
        {events.map((e, index) => {
          // --- לוגיקת חישוב ההפרש ---
          let gapInfo = null;
          if (e.type === "feed") {
            const previousFeed = events.slice(index + 1).find(prev => prev.type === "feed");
            if (previousFeed) {
              const diffMs = e.ts - previousFeed.ts;
              const hours = Math.floor(diffMs / 3600000);
              const mins = Math.floor((diffMs % 3600000) / 60000);
              gapInfo = `עברו ${hours}ש' ו-${mins}ד' מהארוחה הקודמת`;
            }
          }

          return (
            <div key={e.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "20px" }}>
                  {e.type === "feed" ? "🍼" : e.type === "sleep" ? "😴" : e.type === "diaper" ? "🧷" : "📝"}
                </span>
                <span style={{ fontWeight: "bold", color: C.text }}>
                  {new Date(e.ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              
              {gapInfo && <div style={{ fontSize: "12px", color: "#e8845e", marginTop: "4px", fontWeight: "600" }}>⏱ {gapInfo}</div>}
              {e.note && <div style={{ fontSize: "14px", color: "#666", marginTop: "6px", fontStyle: "italic" }}>"{e.note}"</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// עיצובים קטנים
const btnStyle = (bg) => ({
  background: bg,
  color: bg === "#eee" ? "#333" : "white",
  border: "none",
  padding: "18px 10px",
  borderRadius: "16px",
  fontWeight: "800",
  fontSize: "15px",
  cursor: "pointer",
  boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
});

const cardStyle =
