const OpenAI = require("openai");

const openAiKey = process.env.OPENAI_API_KEY;
if (!openAiKey) {
  throw new Error("OPENAI_API_KEY fehlt. Bitte .env-Datei erstellen und den Schlüssel eintragen.");
}

const client = new OpenAI({ apiKey: openAiKey });

function extractText(output) {
  if (!output) return "";
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    return output
      .map((item) => extractText(item))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (output.content) {
    return extractText(output.content);
  }
  if (output.text) {
    return String(output.text);
  }
  return "";
}

async function analyzeEmail(emailContent) {
  const prompt = `Du bist ein einfacher E-Mail-Assistent.\n\nE-Mail-Inhalt:\n${emailContent}\n\nAufgabe:\n1) Erstelle eine kurze, klare Zusammenfassung der E-Mail.\n2) Erstelle drei verschiedene Antwortvorschläge.\n\nAntworte nur im JSON-Format mit den Feldern: summary, suggestions.\nBeispiel:\n{\n  "summary": "...",\n  "suggestions": ["Antwort 1", "Antwort 2", "Antwort 3"]\n}`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    temperature: 0.6,
    max_output_tokens: 500,
  });

  const text = extractText(response.output);
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const fallback = text
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      summary: fallback,
      suggestions: [
        "Antwortvorschlag 1: Bitte fügen Sie mehr Kontext hinzu.",
        "Antwortvorschlag 2: Bitte fügen Sie mehr Kontext hinzu.",
        "Antwortvorschlag 3: Bitte fügen Sie mehr Kontext hinzu.",
      ],
      raw: text,
    };
  }

  return {
    summary: parsed.summary || "",
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    raw: text,
  };
}

module.exports = { analyzeEmail };
