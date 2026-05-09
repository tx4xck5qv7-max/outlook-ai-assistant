const {
  getAIResponse
} = require("../services/openaiService");

const {
  sanitizeEmailWithReport
} = require("../utils/privacy");

const MAX_EMAIL_LENGTH = 200000;
const RESPONSE_TONES = new Set([
  "professional",
  "friendly",
  "concise"
]);

const REPLY_LANGUAGES = new Set([
  "auto",
  "de",
  "en"
]);

const ANALYSIS_FOCUS = new Set([
  "general",
  "sales",
  "support",
  "management"
]);

function getResponseTone(req) {

  const {
    responseTone
  } = req.body;

  if (
    typeof responseTone === "string" &&
    RESPONSE_TONES.has(responseTone)
  ) {
    return responseTone;
  }

  return "professional";
}

function getReplyLanguage(req) {

  const {
    replyLanguage
  } = req.body;

  if (
    typeof replyLanguage === "string" &&
    REPLY_LANGUAGES.has(replyLanguage)
  ) {
    return replyLanguage;
  }

  return "auto";
}

function getAnalysisFocus(req) {

  const {
    analysisFocus
  } = req.body;

  if (
    typeof analysisFocus === "string" &&
    ANALYSIS_FOCUS.has(analysisFocus)
  ) {
    return analysisFocus;
  }

  return "general";
}

function validateEmailContent(req, res) {

  const {
    emailContent
  } = req.body;

  if (
    typeof emailContent !== "string" ||
    emailContent.trim().length === 0
  ) {
    res.status(400).json({
      error: "Keine Email erhalten"
    });
    return null;
  }

  if (emailContent.length > MAX_EMAIL_LENGTH) {
    res.status(413).json({
      error: "Email ist zu lang fuer die lokale Analyse"
    });
    return null;
  }

  return emailContent;
}

exports.previewPrivacy = async (req, res) => {

  try {

    const emailContent =
      validateEmailContent(req, res);

    if (!emailContent) {
      return;
    }

    const privacyResult =
      sanitizeEmailWithReport(emailContent);

    res.json({
      readyForAI: true,
      privacy: privacyResult.report
    });

  } catch (err) {

    console.error("Privacy Fehler:", err.message);

    res.status(500).json({
      error: "Privacy Fehler"
    });
  }
};

exports.analyzeEmail = async (req, res) => {

  try {

    const emailContent =
      validateEmailContent(req, res);

    if (!emailContent) {
      return;
    }

    const privacyResult =
      sanitizeEmailWithReport(emailContent);

    const sensitivity =
      privacyResult.report.sensitivity;

    if (
      sensitivity.requiresReview &&
      req.body.confirmSensitiveAnalysis !== true
    ) {
      return res.status(409).json({
        error: "Sensible Email erkannt. Bitte Analyse bestaetigen.",
        requiresConfirmation: true,
        privacy: privacyResult.report
      });
    }

    const result = await getAIResponse(
      emailContent,
      {
        responseTone: getResponseTone(req),
        replyLanguage: getReplyLanguage(req),
        analysisFocus: getAnalysisFocus(req)
      }
    );

    // Datenschutz:
    // Keine Speicherung
    // Keine Logs

    res.json(result);

  } catch (err) {

    console.error("AI Fehler:", err.message);

    res.status(500).json({
      error: "AI Fehler"
    });
  }
};
