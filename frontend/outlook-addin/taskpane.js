async function generateAI() {

  const summary =
    document.getElementById("summary");

  const suggestions =
    document.getElementById("suggestions");

  const actions =
    document.getElementById("actions");

  const todos =
    document.getElementById("todos");

  const followUp =
    document.getElementById("followUp");

  const status =
    document.getElementById("status");

  const priorityBox =
    document.getElementById("priorityBox");

  const sentimentBox =
    document.getElementById("sentimentBox");

  const salesBox =
    document.getElementById("salesBox");

  const button =
    document.getElementById("generateBtn");

  button.disabled = true;

  summary.innerText =
    "Email wird analysiert...";

  suggestions.innerHTML = "";
  actions.innerHTML = "";
  todos.innerHTML = "";
  followUp.innerHTML = "";

  status.innerText =
    "KI analysiert Email...";

  Office.context.mailbox.item.body.getAsync(
    "text",
    async function(result) {

      try {

        const emailText = result.value;

        const response = await fetch(
          "https://localhost:3001/api/email/analyze",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              emailContent: emailText
            })
          }
        );

        const data = await response.json();

        summary.innerText =
          data.summary;

        priorityBox.innerText =
          data.priority;

        sentimentBox.innerText =
          data.sentiment;

        salesBox.innerText =
          data.salesChance;

        // ACTIONS
        actions.innerHTML = "";

        data.actions.forEach((action) => {

          const div =
            document.createElement("div");

          div.className = "listCard";

          div.innerText = action;

          actions.appendChild(div);
        });

        // TODOS
        todos.innerHTML = "";

        data.todos.forEach((todo) => {

          const div =
            document.createElement("div");

          div.className = "todoCard";

          div.innerText = "☑ " + todo;

          todos.appendChild(div);
        });

        // FOLLOWUP
        const followBtn =
          document.createElement("button");

        followBtn.innerText =
          data.followUp;

        followBtn.onclick = () => {

          navigator.clipboard.writeText(
            data.followUp
          );

          status.innerText =
            "Follow-Up kopiert";
        };

        followUp.appendChild(followBtn);

        // REPLIES
        suggestions.innerHTML = "";

        data.suggestions.forEach((reply) => {

          const btn =
            document.createElement("button");

          btn.className = "replyButton";

          btn.innerText = reply;

          btn.onclick = () => {

            navigator.clipboard.writeText(reply);

            status.innerText =
              "Antwort kopiert";
          };

          suggestions.appendChild(btn);
        });

        status.innerText =
          "Analyse abgeschlossen";

      } catch (err) {

        console.error(err);

        summary.innerText =
          "Analyse fehlgeschlagen";

        status.innerText =
          err.message;
      }

      button.disabled = false;
    }
  );
}