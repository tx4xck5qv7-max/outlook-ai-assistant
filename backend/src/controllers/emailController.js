const {
  getAIResponse
} = require("../services/openaiService");

const MAX_EMAIL_LENGTH = 200000;

exports.analyzeEmail = async (req, res) => {

  try {

    const {
      emailContent
    } = req.body;

    if (
      typeof emailContent !== "string" ||
      emailContent.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Keine Email erhalten"
      });
    }

    if (emailContent.length > MAX_EMAIL_LENGTH) {
      return res.status(413).json({
        error: "Email ist zu lang fuer die lokale Analyse"
      });
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
