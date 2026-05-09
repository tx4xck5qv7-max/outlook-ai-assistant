function sanitizeEmail(text) {

  if (!text) return "";

  let clean = text;

  // EMAILS
  clean = clean.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "[EMAIL]"
  );

  // TELEFONNUMMERN
  clean = clean.replace(
    /(\+?\d[\d\s\-]{7,}\d)/g,
    "[PHONE]"
  );

  // URLs
  clean = clean.replace(
    /(https?:\/\/[^\s]+)/g,
    "[LINK]"
    );

  // IBAN
  clean = clean.replace(
    /[A-Z]{2}\d{2}[ ]?([A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}/g,
    "[IBAN]"
  );

  // PERSONENNAMEN
  clean = clean.replace(
    /\b([A-ZÄÖÜ][a-zäöüß]+\s[A-ZÄÖÜ][a-zäöüß]+)\b/g,
    "[NAME]"
  );

  // HTML
  clean = clean.replace(/<[^>]*>/g, " ");

  // SIGNATUREN ENTFERNEN
  clean = clean.replace(
    /(mit freundlichen grüßen|freundliche grüße|best regards|regards)[\s\S]*/i,
    ""
  );

  clean = clean.replace(/\s{2,}/g, " ");
  return clean.trim();
}

module.exports = { sanitizeEmail };