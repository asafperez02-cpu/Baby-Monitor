import React, { useState, useEffect } from "react";
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

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
    <div style={{ padding: 20, fontFamily: "sans-serif", direction: "rtl", maxWidth: 400, margin: "0 auto" }}>
      <h2>ניטור תינוקת 🍼</h2>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <button onClick={() => addEvent("feed")} style={btnStyle("#f4a58a")}>🍼 האכלה</button>
        <button onClick={() => addEvent("sleep")} style={btnStyle("#c9b8e8")}>😴 שינה</button>
        <button onClick={() => addEvent("diaper")} style={btnStyle("#f9b8c4")}>🧷 חיתול</button>
        <button onClick={() => addEvent("other")} style={btnStyle("#a8d8c8")}>📝 אחר</button>
      </div>

      <input 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder="הערה (אופציונלי)..." 
        style={{ width: "100%", padding: 10, marginBottom: 20, borderRadius: 8, border: "1px solid #ccc" }}
      />

      <h3>אירועים אחרונים:</h3>
      <div>
        {events.map(e => (
          <div key={e.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
            <strong>{e.type === "feed" ? "🍼" : e.type === "sleep" ? "😴" : "✨"}</strong> {new Date(e.ts).toLocaleTimeString()}
            {e.note && <div style={{ fontSize: 12, color: "#666" }}>{e.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle = (bg) => ({
  background: bg,
  border: "none",
  padding: "15px",
  borderRadius: "12px",
  fontWeight: "bold",
  cursor: "pointer"
});
