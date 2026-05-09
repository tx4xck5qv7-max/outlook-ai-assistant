const OpenAI = require("openai");

const { sanitizeEmail } = require("../utils/privacy");
const { getEmailAnalysisPrompt } = require("../utils/prompt");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getAIResponse(emailContent) {

  const cleanEmail = sanitizeEmail(emailContent);

  const prompt = getEmailAnalysisPrompt(cleanEmail);

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a professional Outlook email AI assistant."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4
  });

  let text = completion.choices[0].message.content;

  text = text.replace(/```json/g, "");
  text = text.replace(/```/g, "");
  text = text.trim();

  try {

    return JSON.parse(text);

  } catch (err) {

    console.error("JSON ERROR:");
    console.error(text);

    return {
      summary:
        "Fehler bei der Email-Analyse.",
      suggestions: [
        "Antwort konnte nicht generiert werden.",
        "Antwort konnte nicht generiert werden.",
        "Antwort konnte nicht generiert werden."
      ]
    };
  }
}

module.exports = { getAIResponse };