import { load as parseYAML } from "./vendor/js-yaml.mjs";

const LEVEL_ORDER = ["foundational", "intermediate", "advanced", "expert"];

const GOAL_RULES = {
  blue: {
    label: "Blue Team",
  },
  red: {
    label: "Red Team",
  },
  grc: {
    label: "GRC",
  },
  cloud: {
    label: "Cloud",
  },
};

const RED_TRACK_HINTS = ["red", "offensive", "penetration", "pentest", "exploit", "adversary", "attack", "vulnerability"];
const BLUE_TRACK_HINTS = ["blue", "soc", "dfir", "incident", "forensic", "defensive", "threat", "siem", "security-operations", "monitor"];
const GRC_TRACK_HINTS = ["grc", "governance", "risk", "compliance", "privacy", "audit", "iso27", "isms"];
const CLOUD_TRACK_HINTS = ["cloud", "aws", "azure", "gcp", "google-cloud", "kubernetes", "container", "devsecops", "sysops"];

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

const includesAnyHint = (values, hints) => values.some((value) => hints.some((hint) => value.includes(hint)));

const inferGoalCategories = (cert) => {
  const goals = new Set();
  const roleGroups = cert.role_groups.map((group) => group.toLowerCase());
  const subAreas = cert.sub_areas.map((subArea) => subArea.toLowerCase());
  const tracksAndTags = [...cert.tracks, ...cert.tags].map((value) => value.toLowerCase());
  const domain = cert.domain_area.toLowerCase();

  if (roleGroups.includes("blue team ops")) {
    goals.add("blue");
  }
  if (roleGroups.includes("red team ops")) {
    goals.add("red");
  }

  if (roleGroups.includes("management")) {
    goals.add("grc");
  }
  if (roleGroups.includes("testing") || roleGroups.includes("software")) {
    goals.add("red");
  }
  if (roleGroups.includes("network") || roleGroups.includes("iam")) {
    goals.add("blue");
  }
  if (roleGroups.includes("asset")) {
    goals.add("blue");
    goals.add("grc");
  }
  if (roleGroups.includes("engineer")) {
    goals.add("blue");
  }

  if (domain === "security and risk management" || subAreas.includes("grc")) {
    goals.add("grc");
  }
  if (subAreas.includes("cloud/sysops")) {
    goals.add("cloud");
  }
  if (subAreas.includes("penetration testing") || subAreas.includes("exploitation")) {
    goals.add("red");
  }
  if (subAreas.includes("forensics") || subAreas.includes("incident handling")) {
    goals.add("blue");
  }

  if (includesAnyHint(tracksAndTags, RED_TRACK_HINTS)) {
    goals.add("red");
  }
  if (includesAnyHint(tracksAndTags, BLUE_TRACK_HINTS)) {
    goals.add("blue");
  }
  if (includesAnyHint(tracksAndTags, GRC_TRACK_HINTS)) {
    goals.add("grc");
  }
  if (includesAnyHint(tracksAndTags, CLOUD_TRACK_HINTS)) {
    goals.add("cloud");
  }

  if (domain === "security assessment and testing") {
    goals.add("red");
  }
  if (domain === "software security") {
    goals.add("blue");
    goals.add("red");
  }
  if (domain === "communication and network security" || domain === "iam") {
    goals.add("blue");
  }
  if (domain === "asset security") {
    goals.add("grc");
  }
  if (domain === "security operations" && !goals.has("red")) {
    goals.add("blue");
  }
  if (domain === "security architecture and engineering" && !subAreas.includes("cloud/sysops") && !includesAnyHint(tracksAndTags, CLOUD_TRACK_HINTS)) {
    goals.add("blue");
  }

  if (goals.size === 0) {
    goals.add("blue");
  }

  return [...goals];
};

const matchesGoal = (cert, goalKey) => cert.goal_categories.includes(goalKey);

const fetchYAML = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return parseYAML(await response.text());
};

const normalizeCertification = (cert) => {
  const normalized = {
    id: cert.id,
    name: cert.name,
    cert_code: cert.cert_code || cert.name,
    provider: cert.provider || cert.vendor || "Unknown",
    domain_area: cert.domain_area || "Security Operations",
    sub_areas: normalizeArray(cert.sub_areas),
    tracks: normalizeArray(cert.tracks),
    tags: normalizeArray(cert.tags),
    role_groups: normalizeArray(cert.role_groups),
    level: String(cert.level || "foundational").toLowerCase(),
    description: cert.description || cert.summary || cert.name,
    price_usd: Number(cert.price_usd) || 0,
    price_label: cert.price_label || "Price not listed",
    prerequisites: normalizeArray(cert.prerequisites),
    url: cert.url || "#",
  };

  normalized.goal_categories = inferGoalCategories(normalized);
  return normalized;
};

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
    .filter((cert) => matchesGoal(cert, goalKey))
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
    const roleLabel = cert.role_groups.length > 0 ? cert.role_groups.join(", ") : "Not specified";

    card.innerHTML = `
      <h3><a href="${cert.url}" target="_blank" rel="noopener noreferrer">${cert.name}</a></h3>
      <div class="meta">
        <span class="badge">provider ${cert.provider}</span>
        <span class="badge">skill ${cert.level}</span>
        <span class="badge">price ${cert.price_label}</span>
        <span class="badge">role ${roleLabel}</span>
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
