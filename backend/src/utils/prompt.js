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

function getFocusInstruction(analysisFocus) {

  if (analysisFocus === "sales") {
    return "prioritize buying signals, objections, urgency, decision makers, requested offer details, and concrete next sales steps";
  }

  if (analysisFocus === "support") {
    return "prioritize customer problem, impact, urgency, troubleshooting steps, missing technical details, and clear support next actions";
  }

  if (analysisFocus === "management") {
    return "prioritize executive summary, business risk, deadlines, ownership, decisions needed, and strategic implications";
  }

  return "prioritize a balanced business analysis with clear next actions";
}

function getEmailAnalysisPrompt(emailContent, options = {}) {

const responseTone =
  options.responseTone || "professional";

const replyLanguage =
  options.replyLanguage || "auto";

const analysisFocus =
  options.analysisFocus || "general";

const toneInstruction =
  getToneInstruction(responseTone);

const languageInstruction =
  getLanguageInstruction(replyLanguage);

const focusInstruction =
  getFocusInstruction(analysisFocus);

return `
You are a PROFESSIONAL OUTLOOK EMAIL AI.

IMPORTANT:
This is ALWAYS a REAL EMAIL.

Analyze the email professionally.

ANALYSIS FOCUS:
${focusInstruction}

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

Return the detected type in the JSON field "emailType".

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

5. Detect DEADLINE OR TIMEFRAME

Rules:
- extract only explicit dates, deadlines, or timeframes from the email
- if no deadline is present, return "Keine Frist erkannt"
- do not invent dates
- return a concise reason for urgency in "urgencyReason"

Return the deadline in "deadline".
Return the reason in "urgencyReason".

6. Detect BUSINESS RISK AND ESCALATION

Rules:
- classify the business risk as HIGH, MEDIUM, or LOW in "riskLevel"
- consider legal, financial, privacy, security, churn, deadline, complaint, outage, executive, and contract risk
- return EXACTLY 3 concise evidence-based risk flags in "riskFlags"
- if no notable risk is visible, say that explicitly in the risk flags
- return one concise escalation recommendation in "escalationRecommendation"
- do not invent risks that are not supported by the email

7. Generate EXACTLY 3 SMART ACTIONS
- actions must reflect the analysis focus

8. Extract TODO TASKS

Examples:
- Angebot senden
- Rückruf durchführen
- Termin bestätigen
- Dokument prüfen

Return EXACTLY 3 TODO items.
- todos must reflect the analysis focus

9. Generate PROFESSIONAL SUMMARY

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
- explicit deadline or note that none is visible
- business risk and escalation note

10. Generate EXACTLY 3 PROFESSIONAL EMAIL REPLIES

Replies must:
- fit email context
- sound human
- sound business professional
- answer sender requests
- use this reply tone: ${toneInstruction}
- language rule: ${languageInstruction}

11. Generate ONE FOLLOW-UP EMAIL
- follow-up must use the same reply tone
- follow-up must follow the same language rule

12. Recommend RESPONSIBLE OWNER

Choose the best routing owner:
- Vertrieb
- Support
- Management
- Buchhaltung
- HR
- Recht
- Allgemein

Return it in the JSON field "recommendedOwner".

OUTPUT JSON ONLY:

{
  "emailType": "Sales Anfrage",
  "recommendedOwner": "Vertrieb",
  "deadline": "Keine Frist erkannt",
  "urgencyReason": "Keine besondere Dringlichkeit erkannt.",
  "riskLevel": "LOW",
  "escalationRecommendation": "Keine Eskalation empfohlen.",
  "priority": "HIGH",
  "sentiment": "POSITIV",
  "salesChance": "HIGH",
  "riskFlags": [
    "Risiko 1",
    "Risiko 2",
    "Risiko 3"
  ],
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
