import { load as parseYAML } from "./vendor/js-yaml.mjs";

const DOMAIN_SUBAREA_MAP = {
  "Communication and Network Security": [],
  IAM: [],
  "Security Architecture and Engineering": ["Cloud/SysOps", "*nix", "ICS/IoT"],
  "Asset Security": [],
  "Security and Risk Management": ["GRC"],
  "Security Assessment and Testing": [],
  "Software Security": [],
  "Security Operations": ["Forensics", "Incident Handling", "Penetration Testing", "Exploitation"],
};

const SEARCH_KEY_ALIASES = {
  sub: "subarea",
  rolegroup: "rolegroup",
  rolecategory: "rolegroup",
  vendor: "provider",
};

const LEVEL_ORDER = {
  foundational: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const state = {
  certifications: [],
  filtered: [],
  metadata: null,
};

const searchInput = document.getElementById("search");
const domainFilter = document.getElementById("domainFilter");
const subAreaFilter = document.getElementById("subAreaFilter");
const levelFilter = document.getElementById("levelFilter");
const providerFilter = document.getElementById("providerFilter");
const roleGroupFilter = document.getElementById("roleGroupFilter");
const priceTypeFilter = document.getElementById("priceTypeFilter");
const minPriceFilter = document.getElementById("minPriceFilter");
const maxPriceFilter = document.getElementById("maxPriceFilter");
const aiOnly = document.getElementById("aiOnly");
const pricedOnly = document.getElementById("pricedOnly");

const cardsNode = document.getElementById("cards");
const domainChartNode = document.getElementById("domainChart");
const resultCountNode = document.getElementById("resultCount");
const chartCountNode = document.getElementById("chartCount");
const statsNode = document.getElementById("stats");
const cardTemplate = document.getElementById("cardTemplate");
const clearFiltersBtn = document.getElementById("clearFilters");

const normalizeArray = (value) => (Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []);

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const fetchYAML = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return parseYAML(await response.text());
};

const normalizeCertification = (cert, sourceFile) => {
  const normalized = {
    id: cert.id,
    name: cert.name,
    provider: cert.provider || cert.vendor || "Unknown",
    cert_code: cert.cert_code || cert.name || "N/A",
    url: cert.url || "#",
    domain_area: cert.domain_area || "Security Operations",
    sub_areas: normalizeArray(cert.sub_areas),
    tracks: normalizeArray(cert.tracks),
    level: String(cert.level || "foundational").toLowerCase(),
    status: String(cert.status || "active").toLowerCase(),
    ai_focus: Boolean(cert.ai_focus),
    introduced_year: Number(cert.introduced_year) || 0,
    last_updated: cert.last_updated || "",
    summary: cert.summary || cert.name || "",
    delivery: cert.delivery || "exam",
    renewal: cert.renewal || "See provider policy",
    language: cert.language || "en",
    role_groups: normalizeArray(cert.role_groups),
    roles: normalizeArray(cert.roles),
    tags: normalizeArray(cert.tags),
    prerequisites: normalizeArray(cert.prerequisites),
    description: cert.description || cert.summary || cert.name || "",
    price_usd: Number(cert.price_usd) || 0,
    price_label: cert.price_label || "Price not listed",
    price_confidence: cert.price_confidence || "estimated",
    source_file: sourceFile,
  };

  normalized.search_blob = [
    normalized.name,
    normalized.provider,
    normalized.cert_code,
    normalized.domain_area,
    ...normalized.sub_areas,
    ...normalized.tracks,
    normalized.level,
    normalized.status,
    normalized.delivery,
    normalized.description,
    normalized.summary,
    normalized.last_updated,
    ...normalized.role_groups,
    ...normalized.roles,
    ...normalized.tags,
    ...normalized.prerequisites,
    normalized.price_label,
    String(normalized.price_usd),
  ]
    .join(" ")
    .toLowerCase();

  return normalized;
};

const loadCatalog = async () => {
  const metadata = await fetchYAML("data/index.yaml");
  const files = normalizeArray(metadata.certifications);

  const certs = await Promise.all(
    files.map(async (file) => {
      const cert = await fetchYAML(`data/certifications/${file}`);
      return normalizeCertification(cert, file);
    }),
  );

  return { metadata, certifications: certs };
};

const tokenizeQuery = (query) => {
  const tokens = [];
  let buffer = "";
  let quote = null;

  for (const char of query.trim()) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        buffer += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = "";
      }
      continue;
    }

    buffer += char;
  }

  if (buffer) {
    tokens.push(buffer);
  }

  return tokens;
};

const parseNumericDslValue = (value) => {
  const trimmed = value.trim();

  const comparatorMatch = trimmed.match(/^(<=|>=|=|<|>)(-?\d+(?:\.\d+)?)$/);
  if (comparatorMatch) {
    return {
      comparator: comparatorMatch[1],
      numericValue: Number(comparatorMatch[2]),
      range: null,
    };
  }

  const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    return {
      comparator: null,
      numericValue: null,
      range: [Number(rangeMatch[1]), Number(rangeMatch[2])],
    };
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return {
      comparator: "=",
      numericValue: Number(trimmed),
      range: null,
    };
  }

  return {
    comparator: null,
    numericValue: null,
    range: null,
  };
};

const parseQuery = (query) => {
  const tokens = tokenizeQuery(query);

  const structured = [];
  const freeTerms = [];

  for (const token of tokens) {
    const separator = token.indexOf(":");
    if (separator > 0) {
      const rawKey = token.slice(0, separator).toLowerCase();
      const key = SEARCH_KEY_ALIASES[rawKey] || rawKey;
      const rawValue = token.slice(separator + 1).trim();
      if (!rawValue) {
        continue;
      }
      const valueLower = rawValue.toLowerCase();
      const numericDsl = parseNumericDslValue(rawValue);

      structured.push({
        key,
        value: rawValue,
        valueLower,
        comparator: numericDsl.comparator,
        numericValue: numericDsl.numericValue,
        range: numericDsl.range,
      });
    } else {
      freeTerms.push(token.toLowerCase());
    }
  }

  return { structured, freeTerms };
};

const isTruthySearchValue = (value) => ["true", "1", "yes"].includes(value);
const isFreePrice = (cert) => cert.price_usd === 0 && cert.price_label.toLowerCase().includes("free");
const isPaidPrice = (cert) => cert.price_usd > 0;
const isUnknownPrice = (cert) => cert.price_usd === 0 && !isFreePrice(cert);
const hasConcretePrice = (cert) => isPaidPrice(cert) || isFreePrice(cert);

const matchesNumericFilter = (candidate, token) => {
  if (token.range) {
    const [from, to] = token.range;
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    return candidate >= min && candidate <= max;
  }

  if (token.comparator && Number.isFinite(token.numericValue)) {
    switch (token.comparator) {
      case "<":
        return candidate < token.numericValue;
      case "<=":
        return candidate <= token.numericValue;
      case ">":
        return candidate > token.numericValue;
      case ">=":
        return candidate >= token.numericValue;
      case "=":
        return candidate === token.numericValue;
      default:
        return false;
    }
  }

  return false;
};

const matchesStructuredToken = (cert, token) => {
  const value = token.valueLower;

  switch (token.key) {
    case "vendor":
      return cert.provider.toLowerCase().includes(value);
    case "provider":
      return cert.provider.toLowerCase().includes(value);
    case "domain":
      return cert.domain_area.toLowerCase().includes(value);
    case "subarea":
    case "sub":
      return cert.sub_areas.some((subArea) => subArea.toLowerCase().includes(value));
    case "track":
      return cert.tracks.some((track) => track.toLowerCase().includes(value));
    case "level":
      return cert.level === value;
    case "role":
      return cert.roles.some((role) => role.toLowerCase().includes(value));
    case "rolegroup":
    case "rolecategory":
      return cert.role_groups.some((group) => group.toLowerCase().includes(value));
    case "tag":
      return cert.tags.some((tag) => tag.toLowerCase().includes(value));
    case "code":
      return cert.cert_code.toLowerCase().includes(value);
    case "status":
      return cert.status === value;
    case "ai":
      return isTruthySearchValue(value) ? cert.ai_focus : !cert.ai_focus;
    case "year":
      if (token.comparator || token.range) {
        return matchesNumericFilter(cert.introduced_year, token);
      }
      return String(cert.introduced_year).startsWith(value);
    case "price":
      if (value === "paid") {
        return isPaidPrice(cert);
      }
      if (value === "free") {
        return isFreePrice(cert);
      }
      if (value === "unknown") {
        return isUnknownPrice(cert);
      }
      if (value === "concrete") {
        return hasConcretePrice(cert);
      }
      if (token.comparator || token.range) {
        if (isUnknownPrice(cert)) {
          return false;
        }
        return matchesNumericFilter(cert.price_usd, token);
      }
      return cert.price_label.toLowerCase().includes(value) || String(cert.price_usd).includes(value);
    default:
      return cert.search_blob.includes(value);
  }
};

const compareCert = (a, b) => {
  const aLevel = LEVEL_ORDER[a.level] || 0;
  const bLevel = LEVEL_ORDER[b.level] || 0;

  if (bLevel !== aLevel) {
    return bLevel - aLevel;
  }

  if (b.introduced_year !== a.introduced_year) {
    return b.introduced_year - a.introduced_year;
  }

  return a.name.localeCompare(b.name, "en-US", { sensitivity: "base" });
};

const applyFilters = () => {
  const query = searchInput.value.trim();
  const selectedDomain = domainFilter.value;
  const selectedSubArea = subAreaFilter.value;
  const selectedLevel = levelFilter.value;
  const selectedProvider = providerFilter.value;
  const selectedRoleGroup = roleGroupFilter.value;
  const selectedPriceType = priceTypeFilter.value;
  const minPrice = Number(minPriceFilter.value);
  const maxPrice = Number(maxPriceFilter.value);
  const aiOnlyEnabled = aiOnly.checked;
  const pricedOnlyEnabled = pricedOnly.checked;

  const { structured, freeTerms } = parseQuery(query);

  state.filtered = state.certifications.filter((cert) => {
    if (selectedDomain && cert.domain_area !== selectedDomain) {
      return false;
    }

    if (selectedSubArea && !cert.sub_areas.includes(selectedSubArea)) {
      return false;
    }

    if (selectedLevel && cert.level !== selectedLevel) {
      return false;
    }

    if (selectedProvider && cert.provider !== selectedProvider) {
      return false;
    }

    if (selectedRoleGroup && !cert.role_groups.includes(selectedRoleGroup)) {
      return false;
    }

    if (selectedPriceType === "paid" && !isPaidPrice(cert)) {
      return false;
    }

    if (selectedPriceType === "free" && !isFreePrice(cert)) {
      return false;
    }

    if (selectedPriceType === "unknown" && !isUnknownPrice(cert)) {
      return false;
    }

    if (Number.isFinite(minPrice) && minPriceFilter.value !== "") {
      if (!isPaidPrice(cert) || cert.price_usd < minPrice) {
        return false;
      }
    }

    if (Number.isFinite(maxPrice) && maxPriceFilter.value !== "") {
      if (!isPaidPrice(cert) || cert.price_usd > maxPrice) {
        return false;
      }
    }

    if (aiOnlyEnabled && !cert.ai_focus) {
      return false;
    }

    if (pricedOnlyEnabled && !hasConcretePrice(cert)) {
      return false;
    }

    if (structured.length > 0 && !structured.every((token) => matchesStructuredToken(cert, token))) {
      return false;
    }

    if (freeTerms.length > 0 && !freeTerms.every((term) => cert.search_blob.includes(term))) {
      return false;
    }

    return true;
  });

  state.filtered.sort(compareCert);
  updateClearButton();
  render();
};

const createBadge = (text, className = "") => {
  const extraClass = className ? ` ${className}` : "";
  return `<span class="badge${extraClass}">${escapeHtml(text)}</span>`;
};

const renderStats = () => {
  const total = state.certifications.length;
  const aiCount = state.certifications.filter((cert) => cert.ai_focus).length;
  const pricedCount = state.certifications.filter((cert) => hasConcretePrice(cert)).length;

  const domainsCount = new Set(state.certifications.map((cert) => cert.domain_area)).size;
  const lastReview = escapeHtml(state.metadata.last_reviewed || "n/a");

  statsNode.innerHTML = `
    <span class="stat-chip">${total} certifications indexed</span>
    <span class="stat-chip">${domainsCount} security domains</span>
    <span class="stat-chip">${aiCount} AI-focused certifications</span>
    <span class="stat-chip">${pricedCount} with price metadata</span>
    <span class="stat-chip">last review: ${lastReview}</span>
  `;
};

const buildChip = (cert) => {
  const chip = document.createElement("a");
  chip.className = `cert-chip level-${cert.level}${cert.ai_focus ? " ai" : ""}`;
  chip.href = cert.url;
  chip.target = "_blank";
  chip.rel = "noopener noreferrer";
  chip.textContent = cert.cert_code || cert.name;
  chip.dataset.tooltip = `${cert.name}\n${cert.price_label}`;
  chip.setAttribute("aria-label", `${cert.name}. ${cert.price_label}`);
  return chip;
};

const renderDomainChart = () => {
  domainChartNode.innerHTML = "";

  if (state.filtered.length === 0) {
    domainChartNode.innerHTML = '<div class="empty">No certifications match the current filters.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const [areaName, configuredSubAreas] of Object.entries(DOMAIN_SUBAREA_MAP)) {
    const areaCerts = state.filtered.filter((cert) => cert.domain_area === areaName);
    if (areaCerts.length === 0) {
      continue;
    }

    const panel = document.createElement("article");
    panel.className = "domain-panel";

    const header = document.createElement("header");
    header.className = "domain-panel-header";
    header.innerHTML = `<h3>${escapeHtml(areaName)}</h3><span>${areaCerts.length}</span>`;

    const body = document.createElement("div");
    body.className = "domain-panel-body";

    const subAreas = [...configuredSubAreas];
    const hasSubAreas = subAreas.length > 0;

    const buckets = new Map();
    if (hasSubAreas) {
      buckets.set("General", []);
      for (const subArea of subAreas) {
        buckets.set(subArea, []);
      }
    } else {
      buckets.set("All", []);
    }

    for (const cert of areaCerts) {
      if (!hasSubAreas) {
        buckets.get("All").push(cert);
        continue;
      }

      const matchingSubAreas = cert.sub_areas.filter((subArea) => subAreas.includes(subArea));
      if (matchingSubAreas.length === 0) {
        buckets.get("General").push(cert);
      } else {
        for (const subArea of matchingSubAreas) {
          buckets.get(subArea).push(cert);
        }
      }
    }

    for (const [columnName, certs] of buckets.entries()) {
      certs.sort(compareCert);

      const column = document.createElement("section");
      column.className = "subarea-column";
      column.innerHTML = `<h4>${escapeHtml(columnName)}</h4>`;

      const chips = document.createElement("div");
      chips.className = "chip-list";

      for (const cert of certs) {
        chips.appendChild(buildChip(cert));
      }

      if (certs.length === 0) {
        chips.innerHTML = '<p class="muted">No mapped certifications.</p>';
      }

      column.appendChild(chips);
      body.appendChild(column);
    }

    panel.appendChild(header);
    panel.appendChild(body);
    fragment.appendChild(panel);
  }

  domainChartNode.appendChild(fragment);
};

const renderCards = () => {
  cardsNode.innerHTML = "";

  if (state.filtered.length === 0) {
    cardsNode.innerHTML = '<div class="empty">No certifications match the current filters.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const cert of state.filtered) {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);

    card.querySelector(".provider").textContent = cert.provider;
    const levelEl = card.querySelector(".level");
    levelEl.textContent = cert.level;
    levelEl.className = `level level-${cert.level}`;
    card.querySelector(".name").textContent = cert.name;
    card.querySelector(".summary").textContent = cert.description;

    const metaNode = card.querySelector(".meta");
    metaNode.innerHTML = [
      createBadge(`code ${cert.cert_code}`),
      createBadge(`skill ${cert.level}`, "skill"),
      createBadge(`domain ${cert.domain_area}`),
      createBadge(`delivery ${cert.delivery}`),
      cert.ai_focus ? createBadge("AI focus", "ai") : "",
      ...cert.role_groups.slice(0, 2).map((group) => createBadge(group, "role-group")),
      ...cert.sub_areas.slice(0, 2).map((subArea) => createBadge(subArea, "sub")),
    ]
      .filter(Boolean)
      .join("");

    const tagsNode = card.querySelector(".tags");
    tagsNode.innerHTML = cert.tags.slice(0, 4).map((tag) => createBadge(`#${tag}`)).join("");

    const link = card.querySelector(".details-link");
    link.href = cert.url;

    const priceNode = card.querySelector(".price");
    priceNode.textContent = cert.price_label;

    fragment.appendChild(card);
  }

  cardsNode.appendChild(fragment);
};

const renderCounts = () => {
  resultCountNode.textContent = `${state.filtered.length} result(s)`;
  chartCountNode.textContent = `${state.filtered.length} certification node(s)`;
};

const render = () => {
  renderCounts();
  renderDomainChart();
  renderCards();
};

const buildSelectOptions = (node, values) => {
  const sorted = values.filter(Boolean).sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }));
  for (const value of sorted) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    node.appendChild(option);
  }
};

const buildFilterMenus = () => {
  const domains = new Set();
  const subAreas = new Set();
  const levels = new Set();
  const providers = new Set();
  const roleGroups = new Set();

  for (const cert of state.certifications) {
    domains.add(cert.domain_area);
    levels.add(cert.level);
    providers.add(cert.provider);
    for (const roleGroup of cert.role_groups) {
      roleGroups.add(roleGroup);
    }
    for (const subArea of cert.sub_areas) {
      subAreas.add(subArea);
    }
  }

  buildSelectOptions(domainFilter, [...domains]);
  buildSelectOptions(subAreaFilter, [...subAreas]);
  buildSelectOptions(levelFilter, [...levels]);
  buildSelectOptions(providerFilter, [...providers]);
  buildSelectOptions(roleGroupFilter, [...roleGroups]);
};

const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const isFiltersActive = () =>
  searchInput.value.trim() !== "" ||
  domainFilter.value !== "" ||
  subAreaFilter.value !== "" ||
  levelFilter.value !== "" ||
  providerFilter.value !== "" ||
  roleGroupFilter.value !== "" ||
  priceTypeFilter.value !== "" ||
  minPriceFilter.value !== "" ||
  maxPriceFilter.value !== "" ||
  aiOnly.checked ||
  pricedOnly.checked;

const updateClearButton = () => {
  if (clearFiltersBtn) {
    clearFiltersBtn.hidden = !isFiltersActive();
  }
};

const clearAllFilters = () => {
  searchInput.value = "";
  domainFilter.value = "";
  subAreaFilter.value = "";
  levelFilter.value = "";
  providerFilter.value = "";
  roleGroupFilter.value = "";
  priceTypeFilter.value = "";
  minPriceFilter.value = "";
  maxPriceFilter.value = "";
  aiOnly.checked = false;
  pricedOnly.checked = false;
  applyFilters();
};

const wireEvents = () => {
  const debouncedApply = debounce(applyFilters, 280);

  searchInput.addEventListener("input", debouncedApply);
  searchInput.addEventListener("change", applyFilters);

  const instantControls = [
    domainFilter, subAreaFilter, levelFilter, providerFilter,
    roleGroupFilter, priceTypeFilter, minPriceFilter, maxPriceFilter,
    aiOnly, pricedOnly,
  ];

  for (const control of instantControls) {
    control.addEventListener("input", applyFilters);
    control.addEventListener("change", applyFilters);
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", clearAllFilters);
  }
};

const showSkeleton = () => {
  const skeletonCard = () => `
    <div class="skeleton-card" aria-hidden="true">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div class="skeleton-line xs"></div>
        <div class="skeleton-line xs"></div>
      </div>
      <div class="skeleton-line title"></div>
      <div class="skeleton-line md"></div>
      <div class="skeleton-line grow"></div>
      <div style="display:flex;gap:6px">
        <div class="skeleton-line sm" style="height:22px;border-radius:999px"></div>
        <div class="skeleton-line xs" style="height:22px;border-radius:999px"></div>
      </div>
    </div>`;
  cardsNode.innerHTML = Array.from({ length: 9 }, skeletonCard).join("");
};

const boot = async () => {
  showSkeleton();
  try {
    const { metadata, certifications } = await loadCatalog();
    state.metadata = metadata;
    state.certifications = certifications;

    buildFilterMenus();
    renderStats();
    wireEvents();
    applyFilters();
  } catch (error) {
    console.error(error);
    cardsNode.innerHTML = '<div class="empty">Failed to load catalog. Check the browser console for details.</div>';
  }
};

boot();
