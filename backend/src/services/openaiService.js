require("dotenv").config();

const OpenAI = require("openai");

const {
  sanitizeEmailWithReport
} = require("../utils/privacy");

const {
  getEmailAnalysisPrompt
} = require("../utils/prompt");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const openAIModel =
  process.env.OPENAI_MODEL || "gpt-4.1-mini";

const configuredTemperature =
  Number.parseFloat(
    process.env.OPENAI_TEMPERATURE || "0.3"
  );

const openAITemperature =
  Number.isFinite(configuredTemperature)
    ? configuredTemperature
    : 0.3;

const configuredTimeoutMs =
  Number.parseInt(
    process.env.OPENAI_TIMEOUT_MS || "45000",
    10
  );

const openAITimeoutMs =
  Number.isFinite(configuredTimeoutMs)
    ? configuredTimeoutMs
    : 45000;

function getString(value, fallback) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function getList(value, fallback) {
  const items =
    Array.isArray(value)
      ? value
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
      : [];

  return items
    .concat(fallback)
    .slice(0, 3);
}

function normalizeAIResponse(data, metadata) {
  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  return {
    emailType: getString(safeData.emailType, "Unklar"),
    recommendedOwner: getString(
      safeData.recommendedOwner,
      "Allgemein"
    ),
    deadline: getString(
      safeData.deadline,
      "Keine Frist erkannt"
    ),
    urgencyReason: getString(
      safeData.urgencyReason,
      "Keine besondere Dringlichkeit erkannt."
    ),
    riskLevel: getString(safeData.riskLevel, "LOW"),
    escalationRecommendation: getString(
      safeData.escalationRecommendation,
      "Keine Eskalation empfohlen."
    ),
    confidenceLevel: getString(
      safeData.confidenceLevel,
      "MEDIUM"
    ),
    decisionRationale: getString(
      safeData.decisionRationale,
      "Keine belastbare Begruendung erhalten."
    ),
    priority: getString(safeData.priority, "MEDIUM"),
    sentiment: getString(safeData.sentiment, "NEUTRAL"),
    salesChance: getString(safeData.salesChance, "LOW"),
    riskFlags: getList(safeData.riskFlags, [
      "Keine besonderen Risiken erkannt.",
      "Keine Eskalation erforderlich.",
      "Normale Bearbeitung ausreichend."
    ]),
    evidenceSnippets: getList(safeData.evidenceSnippets, [
      "Keine eindeutigen Evidenzstellen erkannt.",
      "Analyse basiert auf dem anonymisierten Email-Kontext.",
      "Keine zusaetzlichen Belege vorhanden."
    ]),
    actions: getList(safeData.actions, [
      "Email pruefen",
      "Naechsten Schritt festlegen",
      "Antwort vorbereiten"
    ]),
    todos: getList(safeData.todos, [
      "Email inhaltlich pruefen",
      "Offene Punkte klaeren",
      "Rueckmeldung vorbereiten"
    ]),
    summary: getString(
      safeData.summary,
      "Keine belastbare Zusammenfassung erhalten."
    ),
    followUp: getString(
      safeData.followUp,
      "Freundlich nach dem aktuellen Stand fragen."
    ),
    suggestions: getList(safeData.suggestions, [
      "Vielen Dank fuer Ihre Nachricht. Ich pruefe den Vorgang und melde mich zeitnah zurueck.",
      "Danke fuer die Informationen. Ich nehme die Punkte auf und gebe Ihnen schnellstmoeglich Rueckmeldung.",
      "Vielen Dank. Ich klaere die offenen Punkte intern und komme anschliessend mit einer konkreten Antwort auf Sie zu."
    ]),
    metadata
  };
}

async function getAIResponse(emailContent, options = {}) {

  // Datenschutz:
  // Nur anonymisierte Daten an KI
  const privacyResult =
    sanitizeEmailWithReport(emailContent);

  const cleanedEmail =
    privacyResult.clean;

  const responseTone =
    options.responseTone || "professional";

  const replyLanguage =
    options.replyLanguage || "auto";

  const analysisFocus =
    options.analysisFocus || "general";

  const prompt =
    getEmailAnalysisPrompt(
      cleanedEmail,
      {
        responseTone,
        replyLanguage,
        analysisFocus
      }
    );

  const completion = await client.chat.completions.create(
    {
      model: openAIModel,

      store: false,

      temperature: openAITemperature,

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
    },
    {
      timeout: openAITimeoutMs
    }
  );

  const raw =
    completion.choices[0].message.content;

  try {
    return {
      ...normalizeAIResponse(
        JSON.parse(raw),
        {
          responseTone,
          replyLanguage,
          analysisFocus
        }
      ),
      privacy: privacyResult.report
    };
  } catch (err) {
    return {
      ...normalizeAIResponse(
        {},
        {
          responseTone,
          replyLanguage,
          analysisFocus
        }
      ),
      privacy: privacyResult.report
    };
  }
}

module.exports = {
  getAIResponse
};
