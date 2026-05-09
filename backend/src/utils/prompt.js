function getToneInstruction(responseTone) {

  if (responseTone === "friendly") {
    return "friendly, approachable, warm, but still business appropriate";
  }

  if (responseTone === "concise") {
    return "short, direct, clear, and suitable for busy business users";
  }

  return "professional, precise, respectful, and business formal";
}

function getLanguageInstruction(replyLanguage) {

  if (replyLanguage === "de") {
    return "write all replies and the follow-up in German";
  }

  if (replyLanguage === "en") {
    return "write all replies and the follow-up in English";
  }

  return "write replies and the follow-up in the same language as the email whenever possible";
}

function getEmailAnalysisPrompt(emailContent, options = {}) {

const responseTone =
  options.responseTone || "professional";

const replyLanguage =
  options.replyLanguage || "auto";

const toneInstruction =
  getToneInstruction(responseTone);

const languageInstruction =
  getLanguageInstruction(replyLanguage);

return `
You are a PROFESSIONAL OUTLOOK EMAIL AI.

IMPORTANT:
This is ALWAYS a REAL EMAIL.

Analyze the email professionally.

----------------------------------
EMAIL:
${emailContent}
----------------------------------

TASKS:

1. Detect EMAIL TYPE

Examples:
- Rechnung
- Support
- Termin
- Sales Anfrage
- Bewerbung
- Vertrag
- Beschwerde
- Angebot
- Lieferung

2. Detect PRIORITY
- HIGH
- MEDIUM
- LOW

3. Detect SENTIMENT
- POSITIV
- NEUTRAL
- NEGATIV
- VERÄRGERT
- DRINGEND

4. Detect SALES OPPORTUNITY
- HIGH
- MEDIUM
- LOW

5. Generate EXACTLY 3 SMART ACTIONS

6. Extract TODO TASKS

Examples:
- Angebot senden
- Rückruf durchführen
- Termin bestätigen
- Dokument prüfen

Return EXACTLY 3 TODO items.

7. Generate PROFESSIONAL SUMMARY

RULES:
- concise
- bullet points only
- email-focused
- extract actual information
- no hallucinations
- if information is missing or ambiguous, say that it is unclear
- do not infer real identities from anonymized placeholders

Summary must include:
- email purpose
- requested information
- important information
- open questions

8. Generate EXACTLY 3 PROFESSIONAL EMAIL REPLIES

Replies must:
- fit email context
- sound human
- sound business professional
- answer sender requests
- use this reply tone: ${toneInstruction}
- language rule: ${languageInstruction}

9. Generate ONE FOLLOW-UP EMAIL
- follow-up must use the same reply tone
- follow-up must follow the same language rule

OUTPUT JSON ONLY:

{
  "priority": "HIGH",
  "sentiment": "POSITIV",
  "salesChance": "HIGH",
  "actions": [
    "Aktion 1",
    "Aktion 2",
    "Aktion 3"
  ],
  "todos": [
    "Todo 1",
    "Todo 2",
    "Todo 3"
  ],
  "summary": "Zusammenfassung",
  "followUp": "Follow-Up",
  "suggestions": [
    "Antwort 1",
    "Antwort 2",
    "Antwort 3"
  ]
}
`;
}

module.exports = { getEmailAnalysisPrompt };
