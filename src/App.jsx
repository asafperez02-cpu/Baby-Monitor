import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, setDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebase";

// ── Pastel Palette ─────────────────────────────────────────────────────────
const C = {
  bg: "#fdf6f0",
  surface: "#ffffff",
  card: "#fff9f5",
  border: "#f0d9cc",
  accent: "#f4a58a",        // אפרסקה
  accentDark: "#e8845e",
  pink: "#f9b8c4",          // ורוד
  pinkDark: "#e8899a",
  lavender: "#c9b8e8",      // סגול פסטלי
  mint: "#a8d8c8",          // ירוק מנטה
  yellow: "#f9e4a0",        // צהוב חמאה
  muted: "#b0998a",
  text: "#5c3d2e",
  textSoft: "#9c7b6a",
  white: "#ffffff",
  shadow: "rgba(244,165,138,0.15)",
};

const USERS = ["אמא", "אבא", "סבתא", "אחר"];

// ── Utilities ──────────────────────────────────────────────────────────────
function fmt(ts) {
  return new Date(ts).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" });
}
function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} דק'`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}ש' ${rm}ד'` : `${h}ש'`;
}
function sinceStr(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק'`;
  const h = Math.floor(m / 60);
  return `לפני ${h}ש'${m % 60 ? " " + (m % 60) + "ד'" : ""}`;
}
function groupByDay(events) {
  const days = {};
  events.forEach(e => {
    const d = new Date(e.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!days[key]) days[key] = { label: fmtDate(e.ts), events: [] };
    days[key].events.push(e);
  });
  return Object.values(days);
}

// ── Main App ───────────────────────────────────────────────────────────────
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);

  // Load global state once
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
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
