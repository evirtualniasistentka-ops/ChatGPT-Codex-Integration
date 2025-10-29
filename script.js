const form = document.getElementById("promptForm");
const resultField = document.getElementById("promptResult");
const copyBtn = document.getElementById("copyBtn");
const resetBtn = document.getElementById("resetBtn");
const historyToggle = document.getElementById("historyToggle");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");

const HISTORY_KEY = "prompt-generator-history";
const MAX_HISTORY = 6;

function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error("Historii se nepodařilo načíst", err);
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error("Historii se nepodařilo uložit", err);
  }
}

function updateHistoryList() {
  const history = loadHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    const emptyMessage = document.createElement("li");
    emptyMessage.textContent = "Zatím zde není žádný prompt.";
    emptyMessage.classList.add("empty-history");
    historyList.appendChild(emptyMessage);
    return;
  }

  history.forEach((prompt) => {
    const item = document.createElement("li");
    const preview = prompt.split(/\s+/).slice(0, 14).join(" ");
    item.textContent = `${preview}${prompt.length > preview.length ? "…" : ""}`;
    historyList.appendChild(item);
  });
}

function buildPrompt(values) {
  const { tool, role, context, steps, output, tone } = values;

  const lines = [
    `Nástroj: ${tool}`,
    `Role: ${role}`,
    `Kontext: ${context}`,
  ];

  if (steps) {
    lines.push(`Postup / instrukce: ${steps}`);
  }

  lines.push(`Požadovaný výstup: ${output}`);

  if (tone) {
    lines.push(`Ton / styl: ${tone}`);
  }

  lines.push(
    "Ujisti se, že odpověď je strukturovaná, srozumitelná a přizpůsobená danému nástroji."
  );

  return lines.join("\n\n");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const values = Object.fromEntries(formData.entries());
  const prompt = buildPrompt(values);

  resultField.value = prompt;

  const history = loadHistory();
  history.unshift(prompt);
  saveHistory(history.slice(0, MAX_HISTORY));
  updateHistoryList();
});

copyBtn.addEventListener("click", async () => {
  const text = resultField.value.trim();
  if (!text) {
    copyBtn.textContent = "Nic ke kopírování";
    setTimeout(() => (copyBtn.textContent = "Kopírovat"), 1800);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Zkopírováno";
  } catch (err) {
    console.error("Nepodařilo se zkopírovat", err);
    copyBtn.textContent = "Chyba kopírování";
  }

  setTimeout(() => (copyBtn.textContent = "Kopírovat"), 1800);
});

resetBtn.addEventListener("click", () => {
  form.reset();
  resultField.value = "";
});

historyToggle.addEventListener("click", () => {
  const isHidden = historyPanel.classList.toggle("hidden");
  historyToggle.setAttribute("aria-expanded", (!isHidden).toString());
  if (!isHidden) {
    updateHistoryList();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  updateHistoryList();
});
