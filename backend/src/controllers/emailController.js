const {
  getAIResponse
} = require("../services/openaiService");

exports.analyzeEmail = async (req, res) => {

  try {

    const {
      emailContent
    } = req.body;

    if (!emailContent) {
      return res.status(400).json({
        error: "Keine Email erhalten"
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