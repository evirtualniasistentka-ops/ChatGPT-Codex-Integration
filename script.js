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

function toBulletList(text) {
  return text
    .split(/[\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join("\n");
}

const STOP_WORDS = new Set([
  "a",
  "ale",
  "ani",
  "asi",
  "bez",
  "by",
  "byl",
  "byla",
  "bylo",
  "byly",
  "co",
  "do",
  "ho",
  "i",
  "jak",
  "je",
  "jsou",
  "jsem",
  "jsi",
  "k",
  "kde",
  "která",
  "které",
  "který",
  "má",
  "mají",
  "málo",
  "mezi",
  "mít",
  "na",
  "nad",
  "nebo",
  "není",
  "o",
  "od",
  "po",
  "pod",
  "pokud",
  "pro",
  "proto",
  "první",
  "se",
  "si",
  "s",
  "tak",
  "tam",
  "ten",
  "tento",
  "tě",
  "to",
  "toto",
  "u",
  "už",
  "ve",
  "v",
  "vše",
  "všech",
  "všechny",
  "z",
  "za",
]);

function upperFirst(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const chars = Array.from(trimmed);
  const [first, ...rest] = chars;
  return first.toLocaleUpperCase("cs-CZ") + rest.join("");
}

function splitIntoMeaningfulUnits(text) {
  const rawLines = text
    .split(/[\n\r]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fragments = [];

  rawLines.forEach((line) => {
    const sanitized = line.replace(/^[\-\*•–\u2022]+\s*/, "");
    const sentences = sanitized.match(/[^.!?]+[.!?]?/gu);

    if (sentences) {
      sentences.forEach((sentence) => {
        const trimmed = sentence.trim();
        if (trimmed) {
          fragments.push(trimmed);
        }
      });
    } else if (sanitized) {
      fragments.push(sanitized);
    }
  });

  if (!fragments.length && text.trim()) {
    fragments.push(text.trim());
  }

  return fragments;
}

function extractTopKeywords(text, maxKeywords = 6) {
  const tokens = text.toLowerCase().match(/[a-zá-ž0-9]+/giu) || [];
  const filtered = tokens.filter((token) => token.length > 3 && !STOP_WORDS.has(token));

  const frequency = new Map();
  filtered.forEach((token) => {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  });

  return Array.from(frequency.entries())
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0], "cs");
      }
      return b[1] - a[1];
    })
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

function detectMissingDetails(text) {
  const suggestions = [];

  if (!/(publikum|uživatel|uživatelé|klient|klienti|zákazník|zákazníci|cílová skupina|audience|divák|čtenář|student|tým)/i.test(text)) {
    suggestions.push("Uveď přesně cílové publikum nebo zainteresované strany, pro které je výstup určen.");
  }

  if (!/(deadline|termín|lhůta|do\s+\d|časový rámec|časový harmonogram|časový plán)/i.test(text)) {
    suggestions.push("Specifikuj časový rámec, milníky nebo termíny, které musí být dodrženy.");
  }

  if (!/(rozpočet|budget|náklad|financ|limit|omezení)/i.test(text)) {
    suggestions.push("Doplň rozpočtové limity, dostupné zdroje nebo jiná omezení.");
  }

  if (!/(cíl|cíle|úspěch|metrika|měřítko|kpi|výsledek|výsledky)/i.test(text)) {
    suggestions.push("Popiš, jak bude vypadat úspěch a jaké metriky nebo kritéria se mají sledovat.");
  }

  if (!/(formát|format|kanál|platforma|deliverable|výstupní formát|způsob dodání)/i.test(text)) {
    suggestions.push("Upřesni výsledný formát, kanál nebo platformu, kde má být výstup využit.");
  }

  if (!/(rizik|úskalí|překáž|závislost|předpoklad)/i.test(text)) {
    suggestions.push("Zvaž možná rizika, závislosti nebo předpoklady, které mohou ovlivnit řešení.");
  }

  if (!suggestions.length) {
    suggestions.push("Kontext pokrývá klíčové parametry; pouze ověř konzistenci informací během řešení.");
  }

  return suggestions;
}

function enhanceContext(rawContext) {
  const trimmed = rawContext.trim();
  if (!trimmed) {
    return "Kontext nebyl upřesněn; nejprve si vyžádej klíčové informace a potvrď zadání.";
  }

  const fragments = splitIntoMeaningfulUnits(trimmed);
  const uniqueFragments = [];

  fragments.forEach((fragment) => {
    const normalized = fragment.toLocaleLowerCase("cs-CZ");
    if (!uniqueFragments.some((existing) => existing.toLocaleLowerCase("cs-CZ") === normalized)) {
      uniqueFragments.push(fragment);
    }
  });

  const bulletPoints = uniqueFragments
    .slice(0, 8)
    .map((fragment) => `- ${upperFirst(fragment)}`)
    .join("\n");

  const keywords = extractTopKeywords(trimmed);
  const keywordLine = keywords.length
    ? `Klíčová témata k akcentování: ${keywords
        .map((word) => upperFirst(word))
        .join(", ")}.`
    : "Klíčová témata k akcentování: stanov specifické pojmy, které nesmí chybět.";

  const refinementSuggestions = detectMissingDetails(trimmed)
    .map((item) => `- ${item}`)
    .join("\n");

  return [
    "Klíčová fakta z kontextu:",
    bulletPoints,
    "",
    keywordLine,
    "",
    "Doplňující body k ověření:",
    refinementSuggestions,
  ]
    .filter((section) => section !== null && section !== undefined)
    .join("\n");
}

function buildPrompt(values) {
  const { tool, role, context, steps, output, tone } = values;

  const promptSections = [];

  const enhancedContext = enhanceContext(context || "");
  const originalContext = (context || "").trim();

  promptSections.push(
    [
      "=== ROLE A NÁSTROJ ===",
      `Pracuj s nástrojem ${tool} a přijmi roli: ${role}.`,
      "Předpokládej profesionální znalost nástroje a přizpůsob tomuto výstup.",
    ].join("\n")
  );

  promptSections.push(
    [
      "=== KONTEXT ===",
      "Shrnutí a rozšíření zadání:",
      enhancedContext,
      originalContext ? "" : null,
      originalContext ? "Původní poznámky od zadavatele:" : null,
      originalContext || null,
      "Zohledni výše uvedené skutečnosti při každém kroku řešení.",
    ].join("\n")
  );

  if (steps) {
    promptSections.push(
      [
        "=== DOPORUČENÝ POSTUP ===",
        toBulletList(steps),
        "Můžeš navrhnout lepší přístup, pokud zvýší kvalitu výsledku, ale vždy vysvětli proč.",
      ].join("\n")
    );
  }

  promptSections.push(
    [
      "=== CÍLOVÝ VÝSTUP ===",
      toBulletList(output),
      "Doruč konkrétní, prakticky využitelný výstup, který plní všechny požadavky.",
    ].join("\n")
  );

  if (tone) {
    promptSections.push(
      ["=== TON A KOMUNIKAČNÍ STYL ===", tone, "Dodrž uvedený styl v celé odpovědi."].join(
        "\n"
      )
    );
  }

  promptSections.push(
    [
      "=== STRUKTURA ODPOVĚDI ===",
      "1. Shrnutí: 2–3 věty, které popisují plánovaný postup a očekávaný výsledek.",
      "2. Detailní řešení: logicky členěné sekce nebo odrážky s podrobným vysvětlením.",
      "3. Doporučení / další kroky: co může následovat nebo na co si dát pozor.",
    ].join("\n")
  );

  promptSections.push(
    [
      "=== KONTROLNÍ SEZNAM PŘED ODESLÁNÍM ===",
      "- Ověř, že byla využita role i nástroj a jejich specifika.",
      "- Zahrň všechny uvedené požadavky na výstup a případné instrukce.",
      "- Pokud něco chybí nebo je nejasné, vysvětli, jak by bylo vhodné to doplnit.",
    ].join("\n")
  );

  return promptSections.join("\n\n");
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
