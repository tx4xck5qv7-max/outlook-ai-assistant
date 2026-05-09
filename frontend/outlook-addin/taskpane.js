const API_BASE_URL =
  "https://localhost:3001";

const REQUEST_TIMEOUT_MS = 50000;

const HEALTH_TIMEOUT_MS = 5000;

const SENSITIVE_CONFIRMATION_MS =
  5 * 60 * 1000;

let pendingSensitiveConfirmation = null;

let lastSystemHealth = null;

const PREFERENCES_STORAGE_KEY =
  "outlookAiAssistant.preferences";

const SELECT_PREFERENCES = [
  {
    id: "toneSelect",
    key: "responseTone",
    defaultValue: "professional",
    values: [
      "professional",
      "friendly",
      "concise"
    ]
  },
  {
    id: "languageSelect",
    key: "replyLanguage",
    defaultValue: "auto",
    values: [
      "auto",
      "de",
      "en"
    ]
  },
  {
    id: "focusSelect",
    key: "analysisFocus",
    defaultValue: "general",
    values: [
      "general",
      "sales",
      "support",
      "management"
    ]
  }
];

const VALUE_STATE_CLASSES = [
  "valueStateHigh",
  "valueStateMedium",
  "valueStateGood",
  "valueStateNeutral"
];

function addTextCard(container, className, text) {

  const div =
    document.createElement("div");

  div.className = className;
  div.textContent = text;

  container.appendChild(div);
}

function renderList(container, items, className, fallback, prefix) {

  container.innerHTML = "";

  const safeItems =
    Array.isArray(items)
      ? items.filter((item) => (
        typeof item === "string" &&
        item.trim().length > 0
      ))
      : [];

  const values =
    safeItems.length
      ? safeItems
      : [fallback];

  values.forEach((item) => {
    addTextCard(
      container,
      className,
      `${prefix || ""}${item}`
    );
  });
}

function normalizeMetricValue(value) {

  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clearValueState(element) {

  if (!element || !element.classList) {
    return;
  }

  element.classList.remove(...VALUE_STATE_CLASSES);
}

function setValueState(element, state) {

  clearValueState(element);

  if (state) {
    element.classList.add(state);
  }
}

function applyMetricState(element, value, metric) {

  const normalized =
    normalizeMetricValue(value);

  if (!normalized || normalized === "-") {
    setValueState(element, "valueStateNeutral");
    return;
  }

  if (metric === "confidence") {
    if (normalized === "HIGH") {
      setValueState(element, "valueStateGood");
      return;
    }

    if (normalized === "LOW") {
      setValueState(element, "valueStateHigh");
      return;
    }

    setValueState(element, "valueStateMedium");
    return;
  }

  if (metric === "sales") {
    if (normalized === "HIGH") {
      setValueState(element, "valueStateGood");
      return;
    }

    if (normalized === "MEDIUM") {
      setValueState(element, "valueStateMedium");
      return;
    }

    setValueState(element, "valueStateNeutral");
    return;
  }

  if (metric === "sentiment") {
    if (normalized === "POSITIV") {
      setValueState(element, "valueStateGood");
      return;
    }

    if (
      normalized === "NEGATIV" ||
      normalized === "VERARGERT" ||
      normalized === "VERAERGERT" ||
      normalized === "DRINGEND"
    ) {
      setValueState(element, "valueStateHigh");
      return;
    }

    setValueState(element, "valueStateNeutral");
    return;
  }

  if (metric === "deadline") {
    if (normalized === "KEINE FRIST ERKANNT") {
      setValueState(element, "valueStateNeutral");
      return;
    }

    setValueState(element, "valueStateMedium");
    return;
  }

  if (normalized === "HIGH") {
    setValueState(element, "valueStateHigh");
    return;
  }

  if (normalized === "MEDIUM") {
    setValueState(element, "valueStateMedium");
    return;
  }

  if (normalized === "LOW") {
    setValueState(element, "valueStateGood");
    return;
  }

  setValueState(element, "valueStateNeutral");
}

function getPreferencesStorage() {

  try {
    if (
      !window.localStorage ||
      typeof window.localStorage.getItem !==
        "function" ||
      typeof window.localStorage.setItem !==
        "function"
    ) {
      return null;
    }

    return window.localStorage;
  } catch (err) {
    return null;
  }
}

function setPreferencesStatus(message) {

  const preferencesStatus =
    document.getElementById("preferencesStatus");

  if (!preferencesStatus) {
    return;
  }

  preferencesStatus.textContent = message;
}

function readPreferences() {

  const storage =
    getPreferencesStorage();

  if (!storage) {
    return {};
  }

  try {
    const raw =
      storage.getItem(PREFERENCES_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch (err) {
    return {};
  }
}

function isAllowedPreference(preference, value) {

  return (
    preference &&
    Array.isArray(preference.values) &&
    preference.values.includes(value)
  );
}

function savePreferences() {

  const storage =
    getPreferencesStorage();

  if (!storage) {
    return;
  }

  const nextPreferences = {};

  SELECT_PREFERENCES.forEach((preference) => {
    const element =
      document.getElementById(preference.id);

    if (
      element &&
      isAllowedPreference(
        preference,
        element.value
      )
    ) {
      nextPreferences[preference.key] =
        element.value;
    }
  });

  try {
    storage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(nextPreferences)
    );
  } catch (err) {
    // Lokale Einstellungen sind Komfort, keine Voraussetzung.
  }
}

function resetPreferences() {

  const storage =
    getPreferencesStorage();

  if (storage) {
    try {
      if (
        typeof storage.removeItem ===
        "function"
      ) {
        storage.removeItem(
          PREFERENCES_STORAGE_KEY
        );
      }
    } catch (err) {
      // Reset darf die Analyse nicht blockieren.
    }
  }

  SELECT_PREFERENCES.forEach((preference) => {
    const element =
      document.getElementById(preference.id);

    if (element && preference.defaultValue) {
      element.value = preference.defaultValue;
    }
  });

  setPreferencesStatus(
    "Lokale Einstellungen zurueckgesetzt."
  );
}

function setupPreferencePersistence() {

  const storedPreferences =
    readPreferences();

  SELECT_PREFERENCES.forEach((preference) => {
    const element =
      document.getElementById(preference.id);

    if (!element) {
      return;
    }

    const storedValue =
      storedPreferences[preference.key];

    if (
      isAllowedPreference(
        preference,
        storedValue
      )
    ) {
      element.value = storedValue;
    }

    if (
      typeof element.addEventListener ===
      "function"
    ) {
      element.addEventListener(
        "change",
        () => {
          savePreferences();
          setPreferencesStatus(
            "Einstellungen lokal gespeichert. Keine Email-Inhalte."
          );
        }
      );
    }
  });

  const resetButton =
    document.getElementById("resetPreferencesBtn");

  if (
    resetButton &&
    typeof resetButton.addEventListener ===
    "function"
  ) {
    resetButton.addEventListener(
      "click",
      resetPreferences
    );
  }
}

function setSystemHealthState(message, state) {

  const systemHealthBox =
    document.getElementById("systemHealthBox");

  if (!systemHealthBox) {
    return;
  }

  systemHealthBox.textContent = message;

  if (state) {
    applyMetricState(
      systemHealthBox,
      state,
      "risk"
    );
  }
}

function getSystemHealthSummary() {

  if (
    lastSystemHealth &&
    lastSystemHealth.status === "ok"
  ) {
    return [
      "OK",
      `Transport ${lastSystemHealth.transport || "https"}`,
      `Speicherung ${lastSystemHealth.storage || "none"}`
    ].join(" / ");
  }

  return "Nicht bestaetigt";
}

async function checkSystemHealth() {

  if (typeof fetch !== "function") {
    setSystemHealthState(
      "Nicht geprueft",
      "MEDIUM"
    );
    return;
  }

  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, HEALTH_TIMEOUT_MS);

  try {
    const response =
      await fetch(
        `${API_BASE_URL}/health`,
        {
          method: "GET",
          cache: "no-store",
          signal: controller.signal
        }
      );

    const data =
      await response.json();

    if (!response.ok || data.status !== "ok") {
      throw new Error("Systemstatus nicht bereit");
    }

    lastSystemHealth = data;

    setSystemHealthState(
      "Backend OK",
      "LOW"
    );
  } catch (err) {
    lastSystemHealth = null;

    setSystemHealthState(
      "Pruefen",
      "MEDIUM"
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setupTaskpane() {
  setupPreferencePersistence();
  checkSystemHealth();
}

function getAuditValue(value, fallback) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function getAuditList(value, fallback) {
  const items =
    Array.isArray(value)
      ? value
        .filter((item) => (
          typeof item === "string" &&
          item.trim().length > 0
        ))
        .map((item) => item.trim())
      : [];

  return items.length
    ? items
    : fallback;
}

function getAuditTimestamp() {
  try {
    return new Date().toLocaleString("de-DE");
  } catch (err) {
    return new Date().toISOString();
  }
}

function buildAnalysisAuditLog(data, privacy, context) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const safeContext =
    context && typeof context === "object"
      ? context
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        level: "LOW",
        categories: [],
        requiresReview: false
      };

  const detected =
    getAuditList(
      safePrivacy.detected,
      ["keine"]
    );

  const categories =
    getAuditList(
      sensitivity.categories,
      ["keine"]
    );

  const metadata =
    safeData.metadata &&
    typeof safeData.metadata === "object"
      ? safeData.metadata
      : {};

  const aiStatus =
    getAuditValue(
      safeContext.aiStatus,
      safeData.summary
        ? "Analyse abgeschlossen"
        : "Keine KI-Analyse ausgefuehrt"
    );

  const storagePolicy =
    "Keine Email-Inhalte im Add-in oder Backend gespeichert";

  return [
    "Analyseprotokoll (ohne Email-Inhalte)",
    "",
    `Zeitpunkt: ${getAuditTimestamp()}`,
    `Systemstatus: ${getSystemHealthSummary()}`,
    "Backend: https://localhost:3001",
    `Speicherung: ${storagePolicy}`,
    `KI-Status: ${aiStatus}`,
    `Datenschutz: ${
      safePrivacy.anonymized
        ? "Anonymisierung angewendet"
        : "Keine typischen Muster maskiert"
    }`,
    `Maskierte Muster: ${detected.join(", ")}`,
    `Sensitivitaet: ${sensitivity.level || "LOW"}`,
    `Sensible Kategorien: ${categories.join(", ")}`,
    `Review erforderlich: ${
      sensitivity.requiresReview
        ? "ja"
        : "nein"
    }`,
    `Original-Laenge: ${safePrivacy.originalLength || 0}`,
    `Anonymisierte Laenge: ${safePrivacy.sanitizedLength || 0}`,
    "",
    "Analyseparameter:",
    `Antwortstil: ${
      safeContext.responseTone ||
      metadata.responseTone ||
      "-"
    }`,
    `Antwortsprache: ${
      safeContext.replyLanguage ||
      metadata.replyLanguage ||
      "-"
    }`,
    `Analysefokus: ${
      safeContext.analysisFocus ||
      metadata.analysisFocus ||
      "-"
    }`,
    "",
    "Ergebnis-Metadaten:",
    `Typ: ${safeData.emailType || "Nicht analysiert"}`,
    `Zustaendig: ${
      safeData.recommendedOwner ||
      "Nicht analysiert"
    }`,
    `Prioritaet: ${safeData.priority || "Nicht analysiert"}`,
    `Risiko: ${safeData.riskLevel || "Nicht analysiert"}`,
    `KI-Sicherheit: ${
      safeData.confidenceLevel ||
      "Nicht analysiert"
    }`,
    `Kalender-Risiko: ${
      safeData.calendarConflictRisk ||
      "Nicht analysiert"
    }`,
    "",
    "Kontrollhinweis:",
    "Dieses Protokoll enthaelt keine Originalmail, keine Empfaenger und keine Antwortinhalte."
  ].join("\n");
}

function formatBriefList(title, items) {

  const safeItems =
    Array.isArray(items)
      ? items.filter((item) => (
        typeof item === "string" &&
        item.trim().length > 0
      ))
      : [];

  if (!safeItems.length) {
    return `${title}:\n- Keine Angaben`;
  }

  return `${title}:\n` +
    safeItems
      .map((item) => `- ${item}`)
      .join("\n");
}

function buildHandoffBrief(data) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  return [
    "Interne Uebergabe",
    "",
    `Typ: ${safeData.emailType || "-"}`,
    `Zustaendig: ${safeData.recommendedOwner || "-"}`,
    `Prioritaet: ${safeData.priority || "-"}`,
    `Risiko: ${safeData.riskLevel || "-"}`,
    `Sicherheit: ${safeData.confidenceLevel || "-"}`,
    `Frist: ${safeData.deadline || "Keine Frist erkannt"}`,
    `Dringlichkeit: ${safeData.urgencyReason || "-"}`,
    `Kalender: ${safeData.calendarConflictRisk || "-"}`,
    `Zeitfenster: ${
      safeData.calendarWindow ||
      "Kein Terminbezug erkannt"
    }`,
    `Kalenderempfehlung: ${
      safeData.calendarRecommendation ||
      "Kein Kalenderabgleich erforderlich."
    }`,
    `Eskalation: ${
      safeData.escalationRecommendation ||
      "Keine Eskalation empfohlen."
    }`,
    `Begruendung: ${
      safeData.decisionRationale ||
      "Keine belastbare Begruendung erhalten."
    }`,
    "",
    "Zusammenfassung:",
    safeData.summary || "-",
    "",
    formatBriefList("Naechste Schritte", safeData.actions),
    "",
    formatBriefList("Todos", safeData.todos),
    "",
    formatBriefList("Risiko-Hinweise", safeData.riskFlags),
    "",
    formatBriefList("Evidenz", safeData.evidenceSnippets),
    "",
    formatBriefList("Kalendersignale", safeData.calendarSignals)
  ].join("\n");
}

function buildWorkflowTicket(data, privacy) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        level: "LOW",
        categories: []
      };

  const categories =
    Array.isArray(sensitivity.categories)
      ? sensitivity.categories
      : [];

  const titleParts = [
    safeData.emailType || "Email",
    safeData.priority || "MEDIUM",
    safeData.deadline &&
    safeData.deadline !== "Keine Frist erkannt"
      ? safeData.deadline
      : ""
  ].filter(Boolean);

  return [
    "CRM/Ticket-Export",
    "",
    `Titel: ${titleParts.join(" | ")}`,
    `Kategorie: ${safeData.emailType || "Unklar"}`,
    `Zustaendig: ${safeData.recommendedOwner || "Allgemein"}`,
    `Prioritaet: ${safeData.priority || "MEDIUM"}`,
    `Risiko: ${safeData.riskLevel || "LOW"}`,
    `Sales-Chance: ${safeData.salesChance || "LOW"}`,
    `Frist: ${safeData.deadline || "Keine Frist erkannt"}`,
    `Kalender-Risiko: ${safeData.calendarConflictRisk || "UNKNOWN"}`,
    `Sicherheit: ${safeData.confidenceLevel || "MEDIUM"}`,
    "",
    "Beschreibung:",
    safeData.summary || "-",
    "",
    formatBriefList("Naechste Schritte", safeData.actions),
    "",
    formatBriefList("Todos", safeData.todos),
    "",
    `Datenschutz: ${
      safePrivacy.anonymized
        ? "anonymisiert"
        : "keine typischen Muster erkannt"
    }`,
    `Sensitivitaet: ${sensitivity.level || "LOW"}`,
    `Sensible Kategorien: ${
      categories.length
        ? categories.join(", ")
        : "keine"
    }`
  ].join("\n");
}

function buildApprovalCheck(data, privacy) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        level: "LOW",
        categories: [],
        requiresReview: false
      };

  const categories =
    Array.isArray(sensitivity.categories)
      ? sensitivity.categories
      : [];

  const riskLevel =
    String(safeData.riskLevel || "LOW")
      .toUpperCase();

  const priority =
    String(safeData.priority || "MEDIUM")
      .toUpperCase();

  const confidenceLevel =
    String(safeData.confidenceLevel || "MEDIUM")
      .toUpperCase();

  const calendarRisk =
    String(safeData.calendarConflictRisk || "UNKNOWN")
      .toUpperCase();

  const reasons = [];

  if (sensitivity.requiresReview) {
    reasons.push(
      "Sensible Inhalte erkannt; bewusste fachliche Pruefung empfohlen."
    );
  }

  if (riskLevel === "HIGH") {
    reasons.push(
      "Hohes Business-Risiko erkannt; Antwort sollte intern freigegeben werden."
    );
  }

  if (calendarRisk === "HIGH") {
    reasons.push(
      "Moeglicher Termin- oder Kalenderkonflikt; Verfuegbarkeit vor Zusage pruefen."
    );
  }

  if (confidenceLevel === "LOW") {
    reasons.push(
      "Niedrige KI-Sicherheit; Analyse gegen Originalmail pruefen."
    );
  }

  if (
    priority === "HIGH" &&
    riskLevel !== "LOW"
  ) {
    reasons.push(
      "Hohe Prioritaet mit erkennbarem Risiko; keine automatische Antwort ohne Review."
    );
  }

  const approvalRequired =
    reasons.length > 0;

  return [
    "Antwort-Freigabe",
    "",
    `Status: ${
      approvalRequired
        ? "Freigabe erforderlich"
        : "Standardfreigabe ausreichend"
    }`,
    `Empfehlung: ${
      approvalRequired
        ? "Antwort vor Versand fachlich pruefen lassen."
        : "Antwort kann nach normaler fachlicher Sichtung verwendet werden."
    }`,
    `Risiko: ${riskLevel}`,
    `Prioritaet: ${priority}`,
    `KI-Sicherheit: ${confidenceLevel}`,
    `Kalender-Risiko: ${calendarRisk}`,
    `Sensitivitaet: ${sensitivity.level || "LOW"}`,
    `Sensible Kategorien: ${
      categories.length
        ? categories.join(", ")
        : "keine"
    }`,
    "",
    formatBriefList(
      "Pruefgruende",
      approvalRequired
        ? reasons
        : [
          "Keine besonderen Freigabegruende erkannt.",
          "Keine sensiblen Kategorien erkannt.",
          "Standardprozess ausreichend."
        ]
    ),
    "",
    "Kontrollhinweis:",
    "Keine Email-Inhalte speichern; Antwort vor Versand gegen Originalmail pruefen."
  ].join("\n");
}

function buildQuickOverview(data, privacy) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        requiresReview: false
      };

  const actions =
    Array.isArray(safeData.actions)
      ? safeData.actions.filter((item) => (
        typeof item === "string" &&
        item.trim().length > 0
      ))
      : [];

  const riskLevel =
    String(safeData.riskLevel || "LOW")
      .toUpperCase();

  const priority =
    String(safeData.priority || "MEDIUM")
      .toUpperCase();

  const confidenceLevel =
    String(safeData.confidenceLevel || "MEDIUM")
      .toUpperCase();

  const calendarRisk =
    String(safeData.calendarConflictRisk || "UNKNOWN")
      .toUpperCase();

  const calendarRelevance =
    String(safeData.calendarRelevance || "NO")
      .toUpperCase();

  const approvalRequired =
    sensitivity.requiresReview ||
    riskLevel === "HIGH" ||
    calendarRisk === "HIGH" ||
    confidenceLevel === "LOW" ||
    (
      priority === "HIGH" &&
      riskLevel !== "LOW"
    );

  const calendarStep =
    calendarRelevance === "YES" ||
    calendarRelevance === "POSSIBLE" ||
    calendarRisk === "HIGH" ||
    calendarRisk === "MEDIUM"
      ? "Terminbezug vor Zusage pruefen."
      : "Kein Kalenderabgleich erforderlich.";

  return [
    `1. ${actions[0] || "Email pruefen und Kontext klaeren."}`,
    `2. ${
      approvalRequired
        ? "Antwort vor Versand intern freigeben lassen."
        : "Antwort fachlich pruefen und verwenden."
    }`,
    `3. ${calendarStep}`,
    "",
    `Fokus: ${safeData.emailType || "Unklar"} / ${safeData.recommendedOwner || "Allgemein"}`,
    `Prioritaet: ${priority}`,
    `Risiko: ${riskLevel}`,
    `Freigabe: ${
      approvalRequired
        ? "erforderlich"
        : "Standardprozess"
    }`
  ].join("\n");
}

function buildSendReadinessCheck(data, privacy) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        level: "LOW",
        categories: [],
        requiresReview: false
      };

  const riskLevel =
    String(safeData.riskLevel || "LOW")
      .toUpperCase();

  const confidenceLevel =
    String(safeData.confidenceLevel || "MEDIUM")
      .toUpperCase();

  const calendarRisk =
    String(safeData.calendarConflictRisk || "UNKNOWN")
      .toUpperCase();

  const calendarRelevance =
    String(safeData.calendarRelevance || "NO")
      .toUpperCase();

  const checks = [];

  if (sensitivity.requiresReview) {
    checks.push(
      "Sensible Inhalte erkannt: Antwort fachlich freigeben lassen."
    );
  }

  if (riskLevel === "HIGH") {
    checks.push(
      "Hohes Risiko: Antwort nicht ohne interne Rueckversicherung senden."
    );
  }

  if (
    calendarRelevance === "YES" ||
    calendarRelevance === "POSSIBLE" ||
    calendarRisk === "HIGH" ||
    calendarRisk === "MEDIUM"
  ) {
    checks.push(
      "Terminbezug: Verfuegbarkeit vor Zusage im Kalender pruefen."
    );
  }

  if (confidenceLevel === "LOW") {
    checks.push(
      "Niedrige KI-Sicherheit: Antwort gegen Originalmail pruefen."
    );
  }

  checks.push(
    "Vor Versand Ton, Fakten und Empfaengerkreis kontrollieren."
  );

  const needsReview =
    sensitivity.requiresReview ||
    riskLevel === "HIGH" ||
    confidenceLevel === "LOW" ||
    calendarRisk === "HIGH";

  return [
    `Status: ${
      needsReview
        ? "Pruefung vor Versand empfohlen"
        : "Standardpruefung ausreichend"
    }`,
    `Automatisch senden: nein`,
    "",
    formatBriefList("Checkliste", checks)
  ].join("\n");
}

function buildClarificationNeeds(data, privacy) {

  const safeData =
    data && typeof data === "object"
      ? data
      : {};

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        categories: [],
        requiresReview: false
      };

  const confidenceLevel =
    String(safeData.confidenceLevel || "MEDIUM")
      .toUpperCase();

  const riskLevel =
    String(safeData.riskLevel || "LOW")
      .toUpperCase();

  const calendarRelevance =
    String(safeData.calendarRelevance || "NO")
      .toUpperCase();

  const calendarRisk =
    String(safeData.calendarConflictRisk || "UNKNOWN")
      .toUpperCase();

  const deadline =
    String(safeData.deadline || "")
      .trim();

  const owner =
    String(safeData.recommendedOwner || "")
      .trim();

  const calendarWindow =
    String(safeData.calendarWindow || "")
      .trim();

  const categories =
    Array.isArray(sensitivity.categories)
      ? sensitivity.categories
      : [];

  const needs = [];

  if (
    !owner ||
    owner === "Allgemein" ||
    owner === "Unklar"
  ) {
    needs.push(
      "Zustaendigkeit klaeren, bevor Aufgaben intern verteilt werden."
    );
  }

  if (
    !deadline ||
    deadline === "Keine Frist erkannt"
  ) {
    needs.push(
      "Frist unklar: falls zeitkritisch, konkrete Deadline bestaetigen."
    );
  }

  if (
    (
      calendarRelevance === "YES" ||
      calendarRelevance === "POSSIBLE"
    ) &&
    (
      !calendarWindow ||
      calendarWindow === "Kein Terminbezug erkannt"
    )
  ) {
    needs.push(
      "Terminbezug erkannt, aber Zeitfenster unklar: Datum oder Uhrzeit bestaetigen."
    );
  }

  if (
    calendarRisk === "HIGH" ||
    calendarRisk === "MEDIUM"
  ) {
    needs.push(
      "Moeglichen Kalenderkonflikt vor Zusage pruefen."
    );
  }

  if (confidenceLevel === "LOW") {
    needs.push(
      "KI-Sicherheit niedrig: Originalmail vor Antwort genau gegenpruefen."
    );
  }

  if (riskLevel === "HIGH") {
    needs.push(
      "Hohes Risiko: Fachbereich oder Verantwortliche einbeziehen."
    );
  }

  if (sensitivity.requiresReview) {
    needs.push(
      "Sensible Inhalte: Zweck, Freigabe und Empfaengerkreis pruefen."
    );
  }

  return [
    `Status: ${
      needs.length
        ? `${needs.length} Punkt(e) klaeren`
        : "Kein kritischer Klaerungsbedarf erkannt"
    }`,
    `Sensible Kategorien: ${
      categories.length
        ? categories.join(", ")
        : "keine"
    }`,
    "",
    formatBriefList(
      "Offene Punkte",
      needs.length
        ? needs
        : [
          "Keine besonderen Luecken erkannt.",
          "Antwort trotzdem kurz gegen Originalmail pruefen.",
          "Bei Unsicherheit fachlich rueckfragen."
        ]
    )
  ].join("\n");
}

function setAnalysisProgress(isActive, message) {

  const progress =
    document.getElementById("analysisProgress");

  if (!progress) {
    return;
  }

  if (message) {
    const dot =
      progress.querySelector &&
      progress.querySelector(".thinkingDot");

    progress.textContent = "";

    if (dot) {
      progress.appendChild(dot);
    }

    progress.appendChild(
      document.createTextNode(message)
    );
  }

  if (isActive) {
    progress.classList.remove("isHidden");
    return;
  }

  progress.classList.add("isHidden");
}

function getCalendarAccessMessage(calendarRelevance) {

  if (
    calendarRelevance === "YES" ||
    calendarRelevance === "POSSIBLE"
  ) {
    return "Kalenderzugriff: noch nicht verbunden. Es wurden keine echten Termine gelesen.";
  }

  return "Kalenderzugriff: Vorpruefung ohne Kalenderdaten.";
}

function buildPrivacyAuditReport(privacy) {

  const safePrivacy =
    privacy && typeof privacy === "object"
      ? privacy
      : {};

  const sensitivity =
    safePrivacy.sensitivity &&
    typeof safePrivacy.sensitivity === "object"
      ? safePrivacy.sensitivity
      : {
        level: "LOW",
        categories: [],
        requiresReview: false
      };

  const detected =
    Array.isArray(safePrivacy.detected)
      ? safePrivacy.detected
      : [];

  const categories =
    Array.isArray(sensitivity.categories)
      ? sensitivity.categories
      : [];

  return [
    "Datenschutzbericht",
    "",
    "Verarbeitung: Lokales HTTPS-Backend auf localhost:3001",
    "Speicherung: Keine Email-Inhalte im Backend",
    "KI-Weitergabe: Nur anonymisierte Email-Inhalte nach lokaler Vorpruefung",
    "Kalender: Keine echten Kalenderdaten gelesen",
    `Anonymisierung aktiv: ${
      safePrivacy.anonymized ? "ja" : "nein"
    }`,
    `Maskierte Muster: ${
      detected.length
        ? detected.join(", ")
        : "keine typischen Muster erkannt"
    }`,
    `Sensitivitaet: ${sensitivity.level || "LOW"}`,
    `Sensible Kategorien: ${
      categories.length
        ? categories.join(", ")
        : "keine"
    }`,
    `Bestaetigung erforderlich: ${
      sensitivity.requiresReview ? "ja" : "nein"
    }`,
    `Original-Laenge: ${
      Number.isFinite(safePrivacy.originalLength)
        ? safePrivacy.originalLength
        : 0
    } Zeichen`,
    `Anonymisierte Laenge: ${
      Number.isFinite(safePrivacy.sanitizedLength)
        ? safePrivacy.sanitizedLength
        : 0
    } Zeichen`
  ].join("\n");
}

function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReplyHtml(replyText) {

  const safeText =
    String(replyText || "")
      .trim()
      .slice(0, 30000);

  return escapeHtml(safeText)
    .replace(/\r?\n/g, "<br>");
}

async function copyText(text, status, successMessage) {

  try {
    await navigator.clipboard.writeText(text);
    status.textContent = successMessage;
  } catch (err) {
    status.textContent =
      "Kopieren nicht moeglich";
  }
}

async function openReplyDraft(replyText, status) {

  const item =
    window.Office &&
    Office.context &&
    Office.context.mailbox
      ? Office.context.mailbox.item
      : null;

  if (!item) {
    await copyText(
      replyText,
      status,
      "Outlook-Kontext nicht verfuegbar. Antwort kopiert."
    );
    return;
  }

  const htmlBody =
    buildReplyHtml(replyText);

  if (typeof item.displayReplyFormAsync === "function") {
    item.displayReplyFormAsync(
      {
        htmlBody
      },
      function(result) {

        if (
          result &&
          result.status === Office.AsyncResultStatus.Failed
        ) {
          copyText(
            replyText,
            status,
            "Antwortformular nicht verfuegbar. Antwort kopiert."
          );
          return;
        }

        status.textContent =
          "Outlook-Antwortentwurf geoeffnet";
      }
    );
    return;
  }

  if (typeof item.displayReplyForm === "function") {
    try {
      item.displayReplyForm({
        htmlBody
      });

      status.textContent =
        "Outlook-Antwortentwurf geoeffnet";
      return;
    } catch (err) {
      await copyText(
        replyText,
        status,
        "Antwortformular nicht verfuegbar. Antwort kopiert."
      );
      return;
    }
  }

  await copyText(
    replyText,
    status,
    "Antwortformular nicht verfuegbar. Antwort kopiert."
  );
}

async function postJson(path, payload) {

  const controller =
    new AbortController();

  const timeoutId =
    window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "Analyse dauert zu lange. Bitte erneut versuchen."
      );
    }

    throw err;
  } finally {
    window.clearTimeout(timeoutId);
  }

  let data = {};

  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error || "Anfrage fehlgeschlagen"
    );
  }

  return data;
}

function renderPrivacyReport(privacyStatus, privacy) {
  privacyStatus.classList.remove(
    "privacyStatusWarning"
  );

  if (
    !privacy ||
    !Array.isArray(privacy.detected)
  ) {
    privacyStatus.textContent =
      "Datenschutzprüfung abgeschlossen.";
    return;
  }

  const sensitivity =
    privacy.sensitivity || {
      level: "LOW",
      categories: [],
      requiresReview: false
    };

  if (sensitivity.requiresReview) {
    privacyStatus.classList.add(
      "privacyStatusWarning"
    );
  }

  const sensitivityText =
    sensitivity.requiresReview &&
    Array.isArray(sensitivity.categories) &&
    sensitivity.categories.length
      ? " Sensible Inhalte: " +
        sensitivity.categories.join(", ") +
        "."
      : "";

  if (!privacy.detected.length) {
    privacyStatus.textContent =
      "Datenschutzprüfung: Keine typischen personenbezogenen Muster erkannt." +
      sensitivityText;
    return;
  }

  privacyStatus.textContent =
    "Datenschutzprüfung: Maskiert wurden " +
    privacy.detected.join(", ") +
    "." +
    sensitivityText;
}

function getSensitivitySignature(privacy) {

  const sensitivity =
    privacy && privacy.sensitivity
      ? privacy.sensitivity
      : {
        level: "LOW",
        categories: []
      };

  const categories =
    Array.isArray(sensitivity.categories)
      ? sensitivity.categories.join("|")
      : "";

  return [
    sensitivity.level || "LOW",
    categories,
    privacy ? privacy.originalLength : 0,
    privacy ? privacy.sanitizedLength : 0
  ].join(":");
}

function hasSensitiveConfirmation(signature) {

  return (
    pendingSensitiveConfirmation &&
    pendingSensitiveConfirmation.signature === signature &&
    pendingSensitiveConfirmation.expiresAt > Date.now()
  );
}

function requireSensitiveConfirmation(signature) {

  pendingSensitiveConfirmation = {
    signature,
    expiresAt:
      Date.now() + SENSITIVE_CONFIRMATION_MS
  };
}

function clearSensitiveConfirmation() {
  pendingSensitiveConfirmation = null;
}

function getSelectedTone() {

  const toneSelect =
    document.getElementById("toneSelect");

  return toneSelect && toneSelect.value
    ? toneSelect.value
    : "professional";
}

function getSelectedLanguage() {

  const languageSelect =
    document.getElementById("languageSelect");

  return languageSelect && languageSelect.value
    ? languageSelect.value
    : "auto";
}

function getSelectedFocus() {

  const focusSelect =
    document.getElementById("focusSelect");

  return focusSelect && focusSelect.value
    ? focusSelect.value
    : "general";
}

async function generateAI() {

  const summary =
    document.getElementById("summary");

  const quickOverviewBox =
    document.getElementById("quickOverviewBox");

  const clarificationBox =
    document.getElementById("clarificationBox");

  const suggestions =
    document.getElementById("suggestions");

  const actions =
    document.getElementById("actions");

  const todos =
    document.getElementById("todos");

  const calendarSignals =
    document.getElementById("calendarSignals");

  const riskFlags =
    document.getElementById("riskFlags");

  const evidenceSnippets =
    document.getElementById("evidenceSnippets");

  const riskLevelBox =
    document.getElementById("riskLevelBox");

  const confidenceBox =
    document.getElementById("confidenceBox");

  const escalationBox =
    document.getElementById("escalationBox");

  const decisionRationale =
    document.getElementById("decisionRationale");

  const handoffBrief =
    document.getElementById("handoffBrief");

  const handoffCopyBtn =
    document.getElementById("handoffCopyBtn");

  const ticketExportBox =
    document.getElementById("ticketExportBox");

  const ticketExportCopyBtn =
    document.getElementById("ticketExportCopyBtn");

  const approvalCheckBox =
    document.getElementById("approvalCheckBox");

  const approvalCheckCopyBtn =
    document.getElementById("approvalCheckCopyBtn");

  const sendReadinessBox =
    document.getElementById("sendReadinessBox");

  const followUp =
    document.getElementById("followUp");

  const status =
    document.getElementById("status");

  const privacyStatus =
    document.getElementById("privacyStatus");

  const privacyReportBox =
    document.getElementById("privacyReportBox");

  const privacyReportCopyBtn =
    document.getElementById("privacyReportCopyBtn");

  const analysisAuditBox =
    document.getElementById("analysisAuditBox");

  const analysisAuditCopyBtn =
    document.getElementById("analysisAuditCopyBtn");

  const priorityBox =
    document.getElementById("priorityBox");

  const typeBox =
    document.getElementById("typeBox");

  const ownerBox =
    document.getElementById("ownerBox");

  const deadlineBox =
    document.getElementById("deadlineBox");

  const urgencyBox =
    document.getElementById("urgencyBox");

  const calendarRiskBox =
    document.getElementById("calendarRiskBox");

  const calendarAccessBox =
    document.getElementById("calendarAccessBox");

  const calendarWindowBox =
    document.getElementById("calendarWindowBox");

  const calendarRecommendationBox =
    document.getElementById("calendarRecommendationBox");

  const sentimentBox =
    document.getElementById("sentimentBox");

  const salesBox =
    document.getElementById("salesBox");

  const button =
    document.getElementById("generateBtn");

  const responseTone =
    getSelectedTone();

  const replyLanguage =
    getSelectedLanguage();

  const analysisFocus =
    getSelectedFocus();

  button.disabled = true;
  button.textContent =
    "Denke nach...";

  setAnalysisProgress(
    true,
    "Denke nach... Email wird lokal geprueft und anonymisiert."
  );

  summary.textContent =
    "Denke nach... Email wird analysiert.";

  quickOverviewBox.textContent =
    "Empfehlung wird vorbereitet...";

  clarificationBox.textContent =
    "Klaerungsbedarf wird geprueft...";

  suggestions.innerHTML = "";
  actions.innerHTML = "";
  todos.innerHTML = "";
  calendarSignals.innerHTML = "";
  riskFlags.innerHTML = "";
  evidenceSnippets.innerHTML = "";
  followUp.innerHTML = "";
  handoffBrief.textContent =
    "Uebergabe wird vorbereitet...";
  handoffCopyBtn.disabled = true;
  handoffCopyBtn.onclick = null;
  ticketExportBox.textContent =
    "Ticket wird vorbereitet...";
  ticketExportCopyBtn.disabled = true;
  ticketExportCopyBtn.onclick = null;
  approvalCheckBox.textContent =
    "Freigabe-Check wird vorbereitet...";
  approvalCheckCopyBtn.disabled = true;
  approvalCheckCopyBtn.onclick = null;
  sendReadinessBox.textContent =
    "Versand-Check wird vorbereitet...";
  privacyReportBox.textContent =
    "Datenschutzbericht wird vorbereitet...";
  privacyReportCopyBtn.disabled = true;
  privacyReportCopyBtn.onclick = null;
  analysisAuditBox.textContent =
    "Analyseprotokoll wird vorbereitet...";
  analysisAuditCopyBtn.disabled = true;
  analysisAuditCopyBtn.onclick = null;

  [
    typeBox,
    ownerBox,
    deadlineBox,
    urgencyBox,
    priorityBox,
    sentimentBox,
    salesBox,
    confidenceBox,
    calendarRiskBox,
    riskLevelBox
  ].forEach(clearValueState);

  status.textContent =
    "Denke nach...";

  calendarRiskBox.textContent =
    "-";

  calendarAccessBox.textContent =
    "Kalenderzugriff: Vorpruefung ohne Kalenderdaten.";

  calendarWindowBox.textContent =
    "Kalendercheck laeuft...";

  calendarRecommendationBox.textContent =
    "Kalendercheck laeuft...";

  privacyStatus.textContent =
    "Datenschutzprüfung läuft lokal...";

  if (
    !window.Office ||
    !Office.context ||
    !Office.context.mailbox ||
    !Office.context.mailbox.item
  ) {
    summary.textContent =
      "Outlook-Kontext nicht verfuegbar.";

    quickOverviewBox.textContent =
      "Outlook-Kontext nicht verfuegbar.";

    clarificationBox.textContent =
      "Klaerungsbedarf nur im Outlook-Kontext moeglich.";

    status.textContent =
      "Bitte im Outlook Add-in starten.";

    privacyStatus.textContent =
      "Datenschutzprüfung nur im Outlook-Kontext möglich.";

    handoffBrief.textContent =
      "Outlook-Kontext nicht verfuegbar.";

    ticketExportBox.textContent =
      "Ticket-Export nur im Outlook-Kontext moeglich.";

    approvalCheckBox.textContent =
      "Freigabe-Check nur im Outlook-Kontext moeglich.";

    sendReadinessBox.textContent =
      "Versand-Check nur im Outlook-Kontext moeglich.";

    privacyReportBox.textContent =
      "Datenschutzbericht nur im Outlook-Kontext moeglich.";

    analysisAuditBox.textContent =
      "Analyseprotokoll nur im Outlook-Kontext moeglich.";

    analysisAuditCopyBtn.disabled = true;

    decisionRationale.textContent =
      "Outlook-Kontext nicht verfuegbar.";

    calendarWindowBox.textContent =
      "Outlook-Kontext nicht verfuegbar.";

    calendarRecommendationBox.textContent =
      "Kalendercheck nur im Outlook-Kontext moeglich.";

    setAnalysisProgress(false);

    button.disabled = false;
    button.textContent =
      "Analysieren";
    return;
  }

  let privacyChecked = false;
  let privacyForAudit = null;

  Office.context.mailbox.item.body.getAsync(
    "text",
    async function(result) {

      try {

        if (
          result.status !==
          Office.AsyncResultStatus.Succeeded
        ) {
          throw new Error(
            "Email konnte nicht gelesen werden"
          );
        }

        const emailText =
          result.value || "";

        setAnalysisProgress(
          true,
          "Denke nach... Datenschutz und Kalenderhinweise werden geprueft."
        );

        const privacyPreview =
          await postJson(
            "/api/email/privacy-preview",
            {
              emailContent: emailText
            }
          );

        privacyForAudit =
          privacyPreview.privacy;

        renderPrivacyReport(
          privacyStatus,
          privacyPreview.privacy
        );

        const privacyReportText =
          buildPrivacyAuditReport(
            privacyPreview.privacy
          );

        privacyReportBox.textContent =
          privacyReportText;

        privacyReportCopyBtn.disabled = false;
        privacyReportCopyBtn.onclick = () => {
          copyText(
            privacyReportText,
            status,
            "Datenschutzbericht kopiert"
          );
        };

        privacyChecked = true;

        const sensitivity =
          privacyPreview.privacy &&
          privacyPreview.privacy.sensitivity
            ? privacyPreview.privacy.sensitivity
            : {
              requiresReview: false
            };

        const sensitivitySignature =
          getSensitivitySignature(
            privacyPreview.privacy
          );

        const confirmedSensitiveAnalysis =
          sensitivity.requiresReview &&
          hasSensitiveConfirmation(
            sensitivitySignature
          );

        if (
          sensitivity.requiresReview &&
          !confirmedSensitiveAnalysis
        ) {
          requireSensitiveConfirmation(
            sensitivitySignature
          );

          summary.textContent =
            "Sensible Email erkannt. Bitte pruefen und Analyse bewusst bestaetigen.";

          quickOverviewBox.textContent =
            "Empfehlung erst nach bestaetigter Analyse verfuegbar.";

          clarificationBox.textContent =
            "Klaerungsbedarf erst nach bestaetigter Analyse verfuegbar.";

          status.textContent =
            "Analyse pausiert bis zur Bestaetigung.";

          button.textContent =
            "Trotzdem analysieren";

          calendarRecommendationBox.textContent =
            "Kalendercheck pausiert bis zur bewussten Bestaetigung.";

          ticketExportBox.textContent =
            "Ticket erst nach bestaetigter Analyse verfuegbar.";

          ticketExportCopyBtn.disabled = true;

          approvalCheckBox.textContent =
            "Freigabe-Check erst nach bestaetigter Analyse verfuegbar.";

          approvalCheckCopyBtn.disabled = true;

          sendReadinessBox.textContent =
            "Versand-Check erst nach bestaetigter Analyse verfuegbar.";

          const pausedAuditText =
            buildAnalysisAuditLog(
              null,
              privacyPreview.privacy,
              {
                aiStatus:
                  "Pausiert: sensible Email nicht an KI gesendet",
                responseTone,
                replyLanguage,
                analysisFocus
              }
            );

          analysisAuditBox.textContent =
            pausedAuditText;

          analysisAuditCopyBtn.disabled = false;
          analysisAuditCopyBtn.onclick = () => {
            copyText(
              pausedAuditText,
              status,
              "Analyseprotokoll kopiert"
            );
          };

          setAnalysisProgress(false);

          button.disabled = false;
          return;
        }

        clearSensitiveConfirmation();

        status.textContent =
          "KI analysiert anonymisierte Email...";

        setAnalysisProgress(
          true,
          "Denke nach... KI analysiert Email und Kalenderhinweise."
        );

        const data =
          await postJson(
            "/api/email/analyze",
            {
              emailContent: emailText,
              responseTone,
              replyLanguage,
              analysisFocus,
              confirmSensitiveAnalysis:
                confirmedSensitiveAnalysis
            }
          );

        summary.textContent =
          data.summary ||
          "Keine belastbare Zusammenfassung erhalten.";

        quickOverviewBox.textContent =
          buildQuickOverview(
            data,
            privacyPreview.privacy
          );

        clarificationBox.textContent =
          buildClarificationNeeds(
            data,
            privacyPreview.privacy
          );

        typeBox.textContent =
          data.emailType || "-";

        ownerBox.textContent =
          data.recommendedOwner || "-";

        deadlineBox.textContent =
          data.deadline || "-";
        applyMetricState(
          deadlineBox,
          data.deadline,
          "deadline"
        );

        urgencyBox.textContent =
          data.urgencyReason || "-";

        calendarRiskBox.textContent =
          data.calendarConflictRisk || "-";
        applyMetricState(
          calendarRiskBox,
          data.calendarConflictRisk,
          "risk"
        );

        calendarAccessBox.textContent =
          getCalendarAccessMessage(
            data.calendarRelevance
          );

        calendarWindowBox.textContent =
          data.calendarWindow ||
          "Kein Terminbezug erkannt";

        calendarRecommendationBox.textContent =
          data.calendarRecommendation ||
          "Kein Kalenderabgleich erforderlich.";

        renderList(
          calendarSignals,
          data.calendarSignals,
          "calendarSignalCard",
          "Kein konkreter Terminbezug erkannt.",
          ""
        );

        priorityBox.textContent =
          data.priority || "-";
        applyMetricState(
          priorityBox,
          data.priority,
          "priority"
        );

        sentimentBox.textContent =
          data.sentiment || "-";
        applyMetricState(
          sentimentBox,
          data.sentiment,
          "sentiment"
        );

        salesBox.textContent =
          data.salesChance || "-";
        applyMetricState(
          salesBox,
          data.salesChance,
          "sales"
        );

        confidenceBox.textContent =
          data.confidenceLevel || "-";
        applyMetricState(
          confidenceBox,
          data.confidenceLevel,
          "confidence"
        );

        riskLevelBox.textContent =
          data.riskLevel || "-";
        applyMetricState(
          riskLevelBox,
          data.riskLevel,
          "risk"
        );

        escalationBox.textContent =
          data.escalationRecommendation ||
          "Keine Eskalation empfohlen.";

        renderList(
          riskFlags,
          data.riskFlags,
          "riskCard",
          "Keine besonderen Risiken erkannt.",
          ""
        );

        decisionRationale.textContent =
          data.decisionRationale ||
          "Keine belastbare Begruendung erhalten.";

        renderList(
          evidenceSnippets,
          data.evidenceSnippets,
          "evidenceCard",
          "Keine eindeutigen Evidenzstellen erkannt.",
          ""
        );

        const handoffText =
          buildHandoffBrief(data);

        handoffBrief.textContent =
          handoffText;

        handoffCopyBtn.disabled = false;
        handoffCopyBtn.onclick = () => {
          copyText(
            handoffText,
            status,
            "Uebergabe kopiert"
          );
        };

        const ticketExportText =
          buildWorkflowTicket(
            data,
            privacyPreview.privacy
          );

        ticketExportBox.textContent =
          ticketExportText;

        ticketExportCopyBtn.disabled = false;
        ticketExportCopyBtn.onclick = () => {
          copyText(
            ticketExportText,
            status,
            "Ticket kopiert"
          );
        };

        const approvalCheckText =
          buildApprovalCheck(
            data,
            privacyPreview.privacy
          );

        approvalCheckBox.textContent =
          approvalCheckText;

        approvalCheckCopyBtn.disabled = false;
        approvalCheckCopyBtn.onclick = () => {
          copyText(
            approvalCheckText,
            status,
            "Freigabe-Check kopiert"
          );
        };

        sendReadinessBox.textContent =
          buildSendReadinessCheck(
            data,
            privacyPreview.privacy
          );

        const analysisAuditText =
          buildAnalysisAuditLog(
            data,
            privacyPreview.privacy,
            {
              aiStatus:
                "Analyse abgeschlossen",
              responseTone,
              replyLanguage,
              analysisFocus
            }
          );

        analysisAuditBox.textContent =
          analysisAuditText;

        analysisAuditCopyBtn.disabled = false;
        analysisAuditCopyBtn.onclick = () => {
          copyText(
            analysisAuditText,
            status,
            "Analyseprotokoll kopiert"
          );
        };

        // ACTIONS
        renderList(
          actions,
          data.actions,
          "listCard",
          "Keine Aktion erkannt.",
          ""
        );

        // TODOS
        renderList(
          todos,
          data.todos,
          "todoCard",
          "Kein Todo erkannt.",
          "- "
        );

        // FOLLOWUP
        const followBtn =
          document.createElement("button");

        const followUpText =
          data.followUp ||
          "Freundlich nach dem aktuellen Stand fragen.";

        followBtn.textContent =
          followUpText;

        followBtn.onclick = () => {

          copyText(
            followUpText,
            status,
            "Follow-Up kopiert"
          );
        };

        followUp.appendChild(followBtn);

        // REPLIES
        suggestions.innerHTML = "";

        const safeSuggestions =
          Array.isArray(data.suggestions)
            ? data.suggestions.filter((reply) => (
              typeof reply === "string" &&
              reply.trim().length > 0
            ))
            : [];

        const replySuggestions =
          safeSuggestions.length
            ? safeSuggestions
            : [
              "Vielen Dank fuer Ihre Nachricht. Ich pruefe den Vorgang und melde mich zeitnah zurueck."
            ];

        replySuggestions.forEach((reply) => {

          const replyGroup =
            document.createElement("div");

          replyGroup.className =
            "replyGroup";

          const btn =
            document.createElement("button");

          btn.className = "replyButton";

          btn.textContent = reply;

          btn.onclick = () => {

            copyText(
              reply,
              status,
              "Antwort kopiert"
            );
          };

          const draftBtn =
            document.createElement("button");

          draftBtn.className =
            "replyDraftButton";

          draftBtn.type =
            "button";

          draftBtn.textContent =
            "Als Outlook-Antwort oeffnen";

          draftBtn.onclick = () => {
            openReplyDraft(
              reply,
              status
            );
          };

          replyGroup.appendChild(btn);
          replyGroup.appendChild(draftBtn);

          suggestions.appendChild(replyGroup);
        });

        status.textContent =
          "Analyse abgeschlossen";

        setAnalysisProgress(false);

      } catch (err) {

        console.error(err);

        summary.textContent =
          "Analyse fehlgeschlagen";

        quickOverviewBox.textContent =
          "Empfehlung nicht erstellt.";

        clarificationBox.textContent =
          "Klaerungsbedarf nicht erstellt.";

        if (!privacyChecked) {
          privacyStatus.textContent =
            "Datenschutzprüfung nicht abgeschlossen.";
        }

        status.textContent =
          err.message;

        handoffBrief.textContent =
          "Uebergabe nicht erstellt.";

        ticketExportBox.textContent =
          "Ticket nicht erstellt.";

        ticketExportCopyBtn.disabled = true;

        approvalCheckBox.textContent =
          "Freigabe-Check nicht erstellt.";

        approvalCheckCopyBtn.disabled = true;

        sendReadinessBox.textContent =
          "Versand-Check nicht erstellt.";

        if (!privacyChecked) {
          privacyReportBox.textContent =
            "Datenschutzbericht nicht erstellt.";

          privacyReportCopyBtn.disabled = true;
        }

        const failedAuditText =
          buildAnalysisAuditLog(
            null,
            privacyForAudit,
            {
              aiStatus:
                "Fehler: Analyse nicht abgeschlossen",
              responseTone,
              replyLanguage,
              analysisFocus
            }
          );

        analysisAuditBox.textContent =
          failedAuditText;

        analysisAuditCopyBtn.disabled =
          !privacyForAudit;

        analysisAuditCopyBtn.onclick =
          privacyForAudit
            ? () => {
              copyText(
                failedAuditText,
                status,
                "Analyseprotokoll kopiert"
              );
            }
            : null;

        decisionRationale.textContent =
          "Begruendung nicht erstellt.";

        calendarRecommendationBox.textContent =
          "Kalendercheck nicht abgeschlossen.";

        setAnalysisProgress(false);

        handoffCopyBtn.disabled = true;
      }

      button.disabled = false;
      if (!pendingSensitiveConfirmation) {
        button.textContent =
          "Analysieren";
      }
    }
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    setupTaskpane
  );
} else {
  setupTaskpane();
}
