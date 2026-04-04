module.exports = async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_KEY;
    if (!apiKey) return res.status(400).json({ answer: "שגיאה: חסר מפתח API ב-Vercel." });

    const { mode, text, currentTime, messages, babyData } = req.body;

    // ─── מצב חדש: מפענח פקודות חכם (הזנת נתונים קולית/טקסטואלית) ───
    if (mode === "parse_voice") {
      const systemInstruction = {
        parts: [{ 
          text: `אתה מפענח נתונים של אפליקציית מעקב תינוקות. המשתמש ייתן לך משפט בעברית.
השעה עכשיו היא: ${currentTime}.
עליך לנתח את המשפט ולהחזיר *אך ורק* אובייקט JSON תקין, ללא כל טקסט אחר (ללא סימוני markdown), במבנה הבא:
{
  "type": "feed" | "diaper" | "vitaminD" | "bath" | "unknown",
  "minutesAgo": מספר,
  "ml": מספר (רק אם feed),
  "pee": boolean (רק אם diaper),
  "poop": boolean (רק אם diaper)
}

חוקים נוקשים:
1. minutesAgo: חישוב מדויק של הדקות שעברו. אם נאמר "לפני רבע שעה" -> 15. אם נאמר "ב-10:00" והשעה עכשיו "10:30" -> 30. אם נאמר "עכשיו" -> 0.
2. feed (האכלה): חפש מספר שמייצג מ"ל (למשל "אכלה 60"). 
3. diaper (החתלה): אם נאמר "קקי", poop=true. אם נאמר פיפי, pee=true. אם נאמר רק "החלפנו חיתול", הנח שזה רק פיפי (pee=true, poop=false).
4. אל תחזיר שום טקסט, רק את מבנה ה-JSON.`
        }]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: systemInstruction,
            contents: [{ role: "user", parts: [{ text: text }] }]
          })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error("Google API Error");

      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim(); // ניקוי טקסט עודף מגוגל
      
      return res.status(200).json(JSON.parse(rawText));
    }

    // ─── המצב הרגיל: האנליסטית של עלמה (צ'אט AI) ───
    const systemInstruction = {
      parts: [{ 
        text: `אתה "העוזרת של עלמה" - מומחה דאטה לניתוח נתוני תינוקות, ויועץ הורות מקצועי.
תעדוף משימות:
1. ניתוח נתונים מקיף: התבסס על ה-JSON המצורף של השבועיים האחרונים. בצע חישובים מדויקים וענה על מרווחים (יעד 4 שעות).
2. ייעוץ בעולם התינוקות והילדים.

חוקי ברזל: ענה בעברית, בגובה העיניים, והשתמש בכוכביות ** כדי להדגיש מילים חשובות.`
      }]
    };

    const formattedContents = messages.map((m, index) => {
      let textContent = m.text;
      if (index === messages.length - 1 && m.role === "user") {
        textContent = `מטען נתונים עדכני בפורמט JSON:\n${JSON.stringify(babyData)}\n\nשאלה: ${m.text}`;
      }
      return {
        role: m.role === "ai" ? "model" : "user",
        parts: [{ text: textContent }]
      };
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents: formattedContents
        })
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "שגיאה מגוגל");

    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "לא הצלחתי לנסח תשובה כרגע.";
    res.status(200).json({ answer: textResponse });
    
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ answer: "תקלה בשרת." });
  }
};
