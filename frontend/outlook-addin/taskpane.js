const API_BASE_URL =
  "https://localhost:3001";

const REQUEST_TIMEOUT_MS = 50000;

const SENSITIVE_CONFIRMATION_MS =
  5 * 60 * 1000;

let pendingSensitiveConfirmation = null;

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
  privacyReportBox.textContent =
    "Datenschutzbericht wird vorbereitet...";
  privacyReportCopyBtn.disabled = true;
  privacyReportCopyBtn.onclick = null;

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

    privacyReportBox.textContent =
      "Datenschutzbericht nur im Outlook-Kontext moeglich.";

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

        typeBox.textContent =
          data.emailType || "-";

        ownerBox.textContent =
          data.recommendedOwner || "-";

        deadlineBox.textContent =
          data.deadline || "-";

        urgencyBox.textContent =
          data.urgencyReason || "-";

        calendarRiskBox.textContent =
          data.calendarConflictRisk || "-";

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

        sentimentBox.textContent =
          data.sentiment || "-";

        salesBox.textContent =
          data.salesChance || "-";

        confidenceBox.textContent =
          data.confidenceLevel || "-";

        riskLevelBox.textContent =
          data.riskLevel || "-";

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

        if (!privacyChecked) {
          privacyReportBox.textContent =
            "Datenschutzbericht nicht erstellt.";

          privacyReportCopyBtn.disabled = true;
        }

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
