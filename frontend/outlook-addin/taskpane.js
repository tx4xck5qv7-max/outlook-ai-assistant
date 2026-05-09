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
    `Frist: ${safeData.deadline || "Keine Frist erkannt"}`,
    `Dringlichkeit: ${safeData.urgencyReason || "-"}`,
    `Eskalation: ${
      safeData.escalationRecommendation ||
      "Keine Eskalation empfohlen."
    }`,
    "",
    "Zusammenfassung:",
    safeData.summary || "-",
    "",
    formatBriefList("Naechste Schritte", safeData.actions),
    "",
    formatBriefList("Todos", safeData.todos),
    "",
    formatBriefList("Risiko-Hinweise", safeData.riskFlags)
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

  const riskFlags =
    document.getElementById("riskFlags");

  const riskLevelBox =
    document.getElementById("riskLevelBox");

  const escalationBox =
    document.getElementById("escalationBox");

  const handoffBrief =
    document.getElementById("handoffBrief");

  const handoffCopyBtn =
    document.getElementById("handoffCopyBtn");

  const followUp =
    document.getElementById("followUp");

  const status =
    document.getElementById("status");

  const privacyStatus =
    document.getElementById("privacyStatus");

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
    "Analysieren";

  summary.textContent =
    "Email wird analysiert...";

  suggestions.innerHTML = "";
  actions.innerHTML = "";
  todos.innerHTML = "";
  riskFlags.innerHTML = "";
  followUp.innerHTML = "";
  handoffBrief.textContent =
    "Uebergabe wird vorbereitet...";
  handoffCopyBtn.disabled = true;
  handoffCopyBtn.onclick = null;

  status.textContent =
    "KI analysiert Email...";

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

    button.disabled = false;
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

          button.disabled = false;
          return;
        }

        clearSensitiveConfirmation();

        status.textContent =
          "KI analysiert anonymisierte Email...";

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

        priorityBox.textContent =
          data.priority || "-";

        sentimentBox.textContent =
          data.sentiment || "-";

        salesBox.textContent =
          data.salesChance || "-";

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
            "Als Outlook-Antwort öffnen";

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
