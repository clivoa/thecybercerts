import { load as parseYAML } from "./vendor/js-yaml.mjs";

const LEVEL_ORDER = ["foundational", "intermediate", "advanced", "expert"];

const GOAL_RULES = {
  blue: {
    label: "Blue Team",
    match: (cert) => cert.role_groups.includes("Blue Team Ops"),
  },
  red: {
    label: "Red Team",
    match: (cert) => cert.role_groups.includes("Red Team Ops"),
  },
  grc: {
    label: "GRC",
    match: (cert) => cert.domain_area === "Security and Risk Management" || cert.sub_areas.includes("GRC"),
  },
  cloud: {
    label: "Cloud",
    match: (cert) => cert.sub_areas.includes("Cloud/SysOps") || cert.tracks.includes("cloud-sysops"),
  },
};

const state = {
  certifications: [],
  filteredPath: [],
};

const goalSelect = document.getElementById("goalSelect");
const startLevelSelect = document.getElementById("startLevelSelect");
const maxBudgetInput = document.getElementById("maxBudgetInput");
const includeUnknownPrice = document.getElementById("includeUnknownPrice");
const pathSummary = document.getElementById("pathSummary");
const pathGrid = document.getElementById("pathGrid");

const normalizeArray = (value) => (Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []);

const fetchYAML = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return parseYAML(await response.text());
};

const normalizeCertification = (cert) => ({
  id: cert.id,
  name: cert.name,
  cert_code: cert.cert_code || cert.name,
  provider: cert.provider || "Unknown",
  domain_area: cert.domain_area || "Security Operations",
  sub_areas: normalizeArray(cert.sub_areas),
  tracks: normalizeArray(cert.tracks),
  role_groups: normalizeArray(cert.role_groups),
  level: String(cert.level || "foundational").toLowerCase(),
  description: cert.description || cert.summary || cert.name,
  price_usd: Number(cert.price_usd) || 0,
  price_label: cert.price_label || "Price not listed",
  prerequisites: normalizeArray(cert.prerequisites),
  url: cert.url || "#",
});

const loadCatalog = async () => {
  const metadata = await fetchYAML("../data/index.yaml");
  const files = normalizeArray(metadata.certifications);

  const certs = await Promise.all(
    files.map(async (file) => {
      const cert = await fetchYAML(`../data/certifications/${file}`);
      return normalizeCertification(cert);
    }),
  );

  return certs;
};

const compareByLevelAndPrice = (a, b) => {
  const levelDiff = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
  if (levelDiff !== 0) {
    return levelDiff;
  }

  const aPrice = a.price_usd > 0 ? a.price_usd : Number.MAX_SAFE_INTEGER;
  const bPrice = b.price_usd > 0 ? b.price_usd : Number.MAX_SAFE_INTEGER;
  if (aPrice !== bPrice) {
    return aPrice - bPrice;
  }

  return a.name.localeCompare(b.name, "en-US", { sensitivity: "base" });
};

const buildPath = () => {
  const goalKey = goalSelect.value;
  const startLevel = startLevelSelect.value;
  const includeUnknown = includeUnknownPrice.checked;
  const maxBudget = Number(maxBudgetInput.value);
  const hasBudget = maxBudgetInput.value !== "" && Number.isFinite(maxBudget) && maxBudget >= 0;

  const goal = GOAL_RULES[goalKey];
  const startLevelIndex = LEVEL_ORDER.indexOf(startLevel);

  const candidates = state.certifications
    .filter((cert) => goal.match(cert))
    .filter((cert) => LEVEL_ORDER.indexOf(cert.level) >= startLevelIndex)
    .filter((cert) => includeUnknown || cert.price_usd > 0 || cert.price_label.toLowerCase().includes("free"))
    .sort(compareByLevelAndPrice);

  const picked = [];
  let runningBudget = 0;

  for (const level of LEVEL_ORDER.slice(startLevelIndex)) {
    const levelCandidates = candidates.filter((cert) => cert.level === level);
    let levelCount = 0;

    for (const cert of levelCandidates) {
      if (levelCount >= 3) {
        break;
      }

      const paid = cert.price_usd > 0;
      if (hasBudget && paid && runningBudget + cert.price_usd > maxBudget) {
        continue;
      }

      picked.push(cert);
      if (paid) {
        runningBudget += cert.price_usd;
      }
      levelCount += 1;
    }
  }

  state.filteredPath = picked;
  render(goal.label, runningBudget, hasBudget ? maxBudget : null);
};

const render = (goalLabel, knownCost, budgetCap) => {
  pathGrid.innerHTML = "";

  if (state.filteredPath.length === 0) {
    pathSummary.innerHTML = '<div class="empty">No path could be generated with the current filters.</div>';
    return;
  }

  const unknownCount = state.filteredPath.filter((cert) => cert.price_usd === 0).length;
  const budgetText = budgetCap === null ? "No budget cap" : `Budget cap: $${budgetCap}`;

  pathSummary.innerHTML = `
    <strong>${goalLabel} path</strong><br>
    ${state.filteredPath.length} certification(s) selected • Known total cost: $${knownCost} • Unknown/non-numeric prices: ${unknownCount}<br>
    ${budgetText}
  `;

  const fragment = document.createDocumentFragment();

  for (const cert of state.filteredPath) {
    const card = document.createElement("article");
    card.className = `path-card level-${cert.level}`;

    const prereqs = cert.prerequisites.length > 0 ? cert.prerequisites.slice(0, 2).join(" | ") : "No prerequisites listed";

    card.innerHTML = `
      <h3><a href="${cert.url}" target="_blank" rel="noopener noreferrer">${cert.name}</a></h3>
      <div class="meta">
        <span class="badge">code ${cert.cert_code}</span>
        <span class="badge">skill ${cert.level}</span>
        <span class="badge">price ${cert.price_label}</span>
        <span class="badge">role ${cert.role_groups.join(", ")}</span>
      </div>
      <p class="desc">${cert.description}</p>
      <p class="prereqs">Prerequisites: ${prereqs}</p>
    `;

    fragment.appendChild(card);
  }

  pathGrid.appendChild(fragment);
};

const wireEvents = () => {
  [goalSelect, startLevelSelect, maxBudgetInput, includeUnknownPrice].forEach((node) => {
    node.addEventListener("input", buildPath);
    node.addEventListener("change", buildPath);
  });
};

const boot = async () => {
  try {
    state.certifications = await loadCatalog();
    wireEvents();
    buildPath();
  } catch (error) {
    console.error(error);
    pathSummary.innerHTML = '<div class="empty">Failed to load catalog for wizard.</div>';
  }
};

boot();
