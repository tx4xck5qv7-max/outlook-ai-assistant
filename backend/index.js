require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY fehlt. Bitte trage den Schlüssel in deine .env-Datei ein.");
  process.exit(1);
}

const client = new OpenAI({ apiKey });

function getText(output) {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.map(getText).join("");
  if (output.text) return output.text;
  if (output.content) return getText(output.content);
  return "";
}

app.use(express.json());

app.post("/analyze-email", async (req, res) => {
  const { emailContent } = req.body;
  if (!emailContent || typeof emailContent !== "string") {
    return res.status(400).json({ error: "emailContent wird benötigt und muss ein String sein." });
  }

  try {
    const prompt = `Du bist ein E-Mail-Assistent.\n\nE-Mail-Inhalt:\n${emailContent}\n\nAufgabe:\n1) Erstelle eine kurze Zusammenfassung.\n2) Gib drei unterschiedliche Antwortvorschläge.\n\nAntworte nur im JSON-Format mit den Feldern: summary, suggestions.\nBeispiel:\n{\n  "summary": "...",\n  "suggestions": ["Antwort 1", "Antwort 2", "Antwort 3"]\n}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      temperature: 0.6,
      max_output_tokens: 500,
    });

    const text = getText(response.output).trim();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return res.json({ gptResponse: text });
    }

    return res.json({
      summary: parsed.summary || "",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
      raw: text,
    });
  } catch (error) {
    console.error("Analysefehler:", error);
    return res.status(500).json({ error: "Fehler bei der Analyse. Bitte später erneut versuchen." });
  }
});

app.get("/", (_req, res) => {
  res.send("Outlook AI Assistant Backend ist aktiv. Verwende POST /analyze-email.");
});

app.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}`);
});
