require("dotenv").config();

const OpenAI = require("openai");

const {
  sanitizeEmail
} = require("../utils/privacy");

const {
  getEmailAnalysisPrompt
} = require("../utils/prompt");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getAIResponse(emailContent) {

  // Datenschutz:
  // Nur anonymisierte Daten an KI
  const cleanedEmail = sanitizeEmail(emailContent);

  const prompt =
    getEmailAnalysisPrompt(cleanedEmail);

  const completion = await client.chat.completions.create({

    model: "gpt-4.1-mini",

    temperature: 0.3,

    response_format: {
      type: "json_object"
    },

    messages: [
      {
        role: "system",
        content:
          "You are a strict JSON API for Outlook email analysis."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const raw =
    completion.choices[0].message.content;

  return JSON.parse(raw);
}

module.exports = {
  getAIResponse
};