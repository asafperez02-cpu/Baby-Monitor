export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_KEY;
    
    // בדיקה: האם המפתח בכלל קיים בשרת?
    if (!apiKey) {
      console.error("Missing API KEY!");
      return res.status(400).json({ answer: "שגיאה: חסר מפתח API ב-Vercel." });
    }

    const { question, history } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${history}\n\nשאלה: ${question}\nענה בעברית קצרה.` }] }]
        })
      }
    );

    const data = await response.json();

    // בדיקה: האם גוגל החזירה לנו שגיאה? (יודפס בלוגים של Vercel)
    if (!response.ok) {
      console.error("Google API Error:", data);
      return res.status(500).json({ answer: `שגיאה מגוגל: ${data.error?.message || "בעיה בחיבור"}` });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "לא מצאתי תשובה.";
    res.status(200).json({ answer: text });
    
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ answer: "שגיאת שרת פנימית." });
  }
}
