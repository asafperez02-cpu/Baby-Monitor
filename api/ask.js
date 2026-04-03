export default async function handler(req, res) {
  const apiKey = process.env.GEMINI_KEY; // רק בצד שרת - לא נחשף!
  
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
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "שגיאה";
  res.json({ answer: text });
}
