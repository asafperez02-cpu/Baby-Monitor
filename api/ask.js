module.exports = async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_KEY;
    if (!apiKey) return res.status(400).json({ answer: "שגיאה: חסר מפתח API." });

    const { messages, babyData } = req.body;

    // הוראות המערכת: הגדרת התפקיד הכפול - קודם אנליסט נתונים של עלמה, אחר כך יועץ כללי
    const systemInstruction = {
      parts: [{ 
        text: `אתה "העוזרת של עלמה" - שילוב של מומחה דאטה מהשורה הראשונה לניתוח נתוני תינוקות, ויועץ הורות מקצועי.
תעדוף משימות:
1. ניתוח נתונים מקיף של עלמה (עדיפות עליונה): ההורה שולח לך באופן סמוי אובייקט JSON המכיל את כל אירועי ההאכלה, ההחתלה ומעקב הויטמין D של השבועיים האחרונים. עליך "לשחות" בנתונים הללו. כשההורה מבקש השוואה שבועית, סיכום יומי, או בודק את מרווחי הזמנים (היעד הוא האכלה כל 4 שעות) - בצע חישובים מתמטיים ומדויקים והצג אותם באופן ברור. חפש מגמות (למשל: עלייה בכמויות מ"ל, זמנים שבהם יש יותר יציאות).
2. ייעוץ בעולם התינוקות והילדים (עדיפות שנייה): אם השאלה לא קשורה לנתונים ספציפיים (למשל, התפתחות, בעיות שינה, או שילוב אחים גדולים), ענה כמומחה על סמך מאגר הידע העצום שלך.

חוקי ברזל:
- קרא את פקודת ה-JSON המצורפת היטב. השתמש במושגים מקצועיים (ממוצעים, פערים בשעות).
- ענה בעברית, בגובה העיניים, פסקאות קצרות. אל תפחד להשתמש בנקודות (Bullet points) לסיכומי נתונים כדי להקל על הקריאה.`
      }]
    };

    const formattedContents = messages.map((m, index) => {
      let textContent = m.text;
      // הזרקת המידע המסודר רק אל ההודעה האחרונה כדי לתת קונטקסט
      if (index === messages.length - 1 && m.role === "user") {
        textContent = `מטען נתונים עדכני של עלמה בפורמט JSON:\n${JSON.stringify(babyData)}\n\nהשאלה של ההורה: ${m.text}`;
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

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "סליחה, לא הצלחתי לנסח תשובה כרגע.";
    res.status(200).json({ answer: text });
    
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ answer: "תקלה בשרת בניתוח הנתונים המורכבים." });
  }
};
