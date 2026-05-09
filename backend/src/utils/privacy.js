function sanitizeEmailWithReport(text) {

  if (!text) {
    return {
      clean: "",
      report: {
        anonymized: false,
        detected: [],
        originalLength: 0,
        sanitizedLength: 0
      }
    };
  }

  let clean = text;
  const detected = new Set();

  function mask(pattern, replacement, label) {
    clean = clean.replace(pattern, (...args) => {
      detected.add(label);

      if (typeof replacement === "function") {
        return replacement(...args);
      }

      return replacement;
    });
  }

  // EMAILS
  mask(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[EMAIL]",
    "Email-Adressen"
  );

  // FIRMENNAMEN MIT RECHTSFORM
  mask(
    /\b\p{Lu}[\p{L}&.-]+(?:\s+\p{Lu}[\p{L}&.-]+){0,3}\s+(GmbH|AG|UG|KG|OHG|Ltd|LLC|Inc)\b/gu,
    "[COMPANY]",
    "Firmennamen"
  );

  // TELEFONNUMMERN
  mask(
    /(\+?\d[\d\s\-]{7,}\d)/g,
    "[PHONE]",
    "Telefonnummern"
  );

  // URLs
  mask(
    /(https?:\/\/[^\s]+)/g,
    "[LINK]",
    "Links"
  );

  // IBAN
  mask(
    /[A-Z]{2}\d{2}[ ]?([A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}/g,
    "[IBAN]",
    "IBAN"
  );

  // KUNDEN-, VERTRAGS- UND TICKETNUMMERN
  mask(
    /\b(kunden(?:nummer|nr\.?)|kundennr\.?|vertragsnummer|auftragsnummer|bestellnummer|ticket|case)[\s:#-]*[A-Z0-9\-\/]{3,}\b/gi,
    (match, label) => `${label} [ID]`,
    "Referenznummern"
  );

  // PERSONENNAMEN
  const commonCapitalizedPhrases = new Set([
    "Vielen Dank",
    "Guten Tag",
    "Guten Morgen",
    "Guten Abend",
    "Beste Gruesse",
    "Freundliche Gruesse"
  ]);

  clean = clean.replace(
    /\b(\p{Lu}\p{Ll}+\s\p{Lu}\p{Ll}+)\b/gu,
    (match) => {
      if (commonCapitalizedPhrases.has(match)) {
        return match;
      }

      detected.add("Personennamen");
      return "[NAME]";
    }
  );

  // HTML
  clean = clean.replace(/<[^>]*>/g, " ");

  // SIGNATUREN ENTFERNEN
  clean = clean.replace(
    /(mit freundlichen grüßen|freundliche grüße|best regards|regards)[\s\S]*/i,
    ""
  );

  clean = clean.replace(/\s{2,}/g, " ");
  clean = clean.trim();

  const detectedItems = Array.from(detected);

  return {
    clean,
    report: {
      anonymized: detectedItems.length > 0,
      detected: detectedItems,
      originalLength: text.length,
      sanitizedLength: clean.length
    }
  };
}

function sanitizeEmail(text) {
  return sanitizeEmailWithReport(text).clean;
}

module.exports = {
  sanitizeEmail,
  sanitizeEmailWithReport
};
