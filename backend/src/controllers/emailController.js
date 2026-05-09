const {
  getAIResponse
} = require("../services/openaiService");

const {
  sanitizeEmailWithReport
} = require("../utils/privacy");

const MAX_EMAIL_LENGTH = 200000;

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

    const result = await getAIResponse(emailContent);

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
