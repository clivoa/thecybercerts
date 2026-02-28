import { load as parseYAML } from "./vendor/js-yaml.mjs";

const DOMAIN_ORDER = [
  "Communication and Network Security",
  "IAM",
  "Security Architecture and Engineering",
  "Asset Security",
  "Security and Risk Management",
  "Security Assessment and Testing",
  "Software Security",
  "Security Operations",
];

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

const LEVEL_ORDER = {
  foundational: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

const state = {
  certifications: [],
  filtered: [],
  expansion: new Map(),
};

const searchInput = document.getElementById("searchInput");
const domainFilter = document.getElementById("domainFilter");
const levelFilter = document.getElementById("levelFilter");
const aiOnly = document.getElementById("aiOnly");
const expandAllButton = document.getElementById("expandAll");
const collapseAllButton = document.getElementById("collapseAll");
const matrixBoard = document.getElementById("matrixBoard");
const matrixStats = document.getElementById("matrixStats");

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

const normalizeCertification = (cert) => {
  const normalized = {
    id: cert.id,
    name: cert.name,
    cert_code: cert.cert_code || cert.name,
    provider: cert.provider || cert.vendor || "Unknown",
    url: cert.url || "#",
    domain_area: cert.domain_area || "Security Operations",
    sub_areas: normalizeArray(cert.sub_areas),
    level: String(cert.level || "foundational").toLowerCase(),
    ai_focus: Boolean(cert.ai_focus),
    description: cert.description || cert.summary || cert.name,
    price_label: cert.price_label || "Price not listed",
  };

  normalized.search_blob = [
    normalized.name,
    normalized.cert_code,
    normalized.provider,
    normalized.domain_area,
    ...normalized.sub_areas,
    normalized.level,
    normalized.description,
    normalized.price_label,
  ]
    .join(" ")
    .toLowerCase();

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

const getDomainSequence = () => {
  const catalogDomains = [...new Set(state.certifications.map((cert) => cert.domain_area).filter(Boolean))];
  const extraDomains = catalogDomains
    .filter((domainName) => !DOMAIN_ORDER.includes(domainName))
    .sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }));

  return [...DOMAIN_ORDER, ...extraDomains];
};

const compareByLevelThenName = (a, b) => {
  const levelA = LEVEL_ORDER[a.level] || Number.MAX_SAFE_INTEGER;
  const levelB = LEVEL_ORDER[b.level] || Number.MAX_SAFE_INTEGER;
  if (levelA !== levelB) {
    return levelA - levelB;
  }

  return a.name.localeCompare(b.name, "en-US", { sensitivity: "base" });
};

const buildBucketsForDomain = (domainName, certs) => {
  const configuredSubAreas = DOMAIN_SUBAREA_MAP[domainName] || [];

  if (configuredSubAreas.length === 0) {
    return [{ name: "All", certs: [...certs].sort(compareByLevelThenName) }];
  }

  const grouped = new Map();
  grouped.set("General", []);
  for (const subArea of configuredSubAreas) {
    grouped.set(subArea, []);
  }

  for (const cert of certs) {
    const matchingSubAreas = cert.sub_areas.filter((subArea) => grouped.has(subArea));

    if (matchingSubAreas.length === 0) {
      grouped.get("General").push(cert);
      continue;
    }

    for (const subArea of matchingSubAreas) {
      grouped.get(subArea).push(cert);
    }
  }

  return [...grouped.entries()].map(([name, items]) => ({
    name,
    certs: items.sort(compareByLevelThenName),
  }));
};

const buildMatrixColumns = () =>
  getDomainSequence().map((domainName) => {
    const certs = state.filtered.filter((cert) => cert.domain_area === domainName);
    const buckets = buildBucketsForDomain(domainName, certs);

    return {
      name: domainName,
      certCount: certs.length,
      buckets,
    };
  });

const captureExpansionState = () => {
  for (const toggle of matrixBoard.querySelectorAll("[data-toggle-key]")) {
    state.expansion.set(toggle.dataset.toggleKey, toggle.open);
  }
};

const resolveExpanded = (toggleKey, defaultExpanded = true) =>
  state.expansion.has(toggleKey) ? state.expansion.get(toggleKey) : defaultExpanded;

const setAllExpanded = (expanded) => {
  for (const toggle of matrixBoard.querySelectorAll(".matrix-toggle")) {
    toggle.open = expanded;
    state.expansion.set(toggle.dataset.toggleKey, expanded);
  }
};

const setDomainSubareasExpanded = (domainKey, expanded) => {
  for (const toggle of matrixBoard.querySelectorAll(".subarea-block")) {
    if (toggle.dataset.domainKey !== domainKey) {
      continue;
    }
    toggle.open = expanded;
    state.expansion.set(toggle.dataset.toggleKey, expanded);
  }
};

const renderMatrix = () => {
  captureExpansionState();

  const columns = buildMatrixColumns();
  let renderedCells = 0;

  for (const column of columns) {
    for (const bucket of column.buckets) {
      renderedCells += bucket.certs.length;
    }
  }

  matrixStats.textContent = `${state.filtered.length} certification(s) matched • ${renderedCells} matrix cell(s)`;

  matrixBoard.innerHTML = "";

  const visibleColumns = columns.filter((column) => column.certCount > 0 || !domainFilter.value);

  if (visibleColumns.length === 0) {
    matrixBoard.style.gridTemplateColumns = "1fr";
    matrixBoard.style.minWidth = "0";
    matrixBoard.innerHTML = '<div class="empty">No certifications found for current filters.</div>';
    return;
  }

  const columnCount = visibleColumns.length;
  matrixBoard.style.gridTemplateColumns = `repeat(${columnCount}, minmax(180px, 1fr))`;
  matrixBoard.style.minWidth = `${columnCount * 210}px`;

  const fragment = document.createDocumentFragment();

  for (const column of visibleColumns) {
    const domainKey = `domain:${column.name}`;
    const domainExpanded = resolveExpanded(domainKey, true);
    const panel = document.createElement("details");
    panel.className = "domain-column matrix-toggle";
    panel.dataset.toggleKey = domainKey;
    panel.open = domainExpanded;
    panel.addEventListener("toggle", () => {
      state.expansion.set(domainKey, panel.open);
    });

    const blocksHtml = column.buckets
      .map((bucket) => {
        const subareaKey = `${domainKey}|sub:${bucket.name}`;
        const subareaExpanded = resolveExpanded(subareaKey, true);
        const cardsHtml = bucket.certs
          .map(
            (cert) => `
          <a
            class="cert-card level-${escapeHtml(cert.level)}${cert.ai_focus ? " ai" : ""}"
            href="${escapeHtml(cert.url)}"
            target="_blank"
            rel="noopener noreferrer"
            title="${escapeHtml(`${cert.name} | ${cert.provider} | ${cert.price_label}`)}"
          >
            <span class="cert-code">${escapeHtml(cert.cert_code)}</span>
            <span class="cert-name">${escapeHtml(cert.name)}</span>
          </a>
        `,
          )
          .join("");

        return `
        <details
          class="subarea-block matrix-toggle"
          data-toggle-key="${escapeHtml(subareaKey)}"
          data-domain-key="${escapeHtml(domainKey)}"
          ${subareaExpanded ? "open" : ""}
        >
          <summary class="subarea-head">
            <h3>${escapeHtml(bucket.name)}</h3>
            <span class="subarea-count">${bucket.certs.length}</span>
          </summary>
          <div class="cert-list">
            ${cardsHtml || '<div class="empty-slot">No certifications</div>'}
          </div>
        </details>
      `;
      })
      .join("");

    panel.innerHTML = `
      <summary class="domain-head">
        <h2>${escapeHtml(column.name)}</h2>
        <span class="domain-count">${column.certCount}</span>
      </summary>
      <div class="domain-body">
        <div class="domain-actions">
          <button type="button" data-action="expand-subareas">Expand sub-areas</button>
          <button type="button" data-action="collapse-subareas">Collapse sub-areas</button>
        </div>
        ${blocksHtml}
      </div>
    `;

    const expandSubareasButton = panel.querySelector('[data-action="expand-subareas"]');
    const collapseSubareasButton = panel.querySelector('[data-action="collapse-subareas"]');
    expandSubareasButton.addEventListener("click", () => setDomainSubareasExpanded(domainKey, true));
    collapseSubareasButton.addEventListener("click", () => setDomainSubareasExpanded(domainKey, false));

    for (const subareaToggle of panel.querySelectorAll(".subarea-block")) {
      const toggleKey = subareaToggle.dataset.toggleKey;
      subareaToggle.addEventListener("toggle", () => {
        state.expansion.set(toggleKey, subareaToggle.open);
      });
    }

    fragment.appendChild(panel);
  }

  matrixBoard.appendChild(fragment);
};

const applyFilters = () => {
  const term = searchInput.value.trim().toLowerCase();
  const selectedDomain = domainFilter.value;
  const selectedLevel = levelFilter.value;
  const onlyAi = aiOnly.checked;

  state.filtered = state.certifications
    .filter((cert) => !selectedDomain || cert.domain_area === selectedDomain)
    .filter((cert) => !selectedLevel || cert.level === selectedLevel)
    .filter((cert) => !onlyAi || cert.ai_focus)
    .filter((cert) => !term || cert.search_blob.includes(term));

  renderMatrix();
};

const hydrateDomainFilter = () => {
  for (const domainName of getDomainSequence()) {
    const option = document.createElement("option");
    option.value = domainName;
    option.textContent = domainName;
    domainFilter.appendChild(option);
  }
};

const wireEvents = () => {
  searchInput.addEventListener("input", applyFilters);
  domainFilter.addEventListener("change", applyFilters);
  levelFilter.addEventListener("change", applyFilters);
  aiOnly.addEventListener("change", applyFilters);
  expandAllButton.addEventListener("click", () => setAllExpanded(true));
  collapseAllButton.addEventListener("click", () => setAllExpanded(false));
};

const boot = async () => {
  try {
    state.certifications = await loadCatalog();
    hydrateDomainFilter();
    wireEvents();
    applyFilters();
  } catch (error) {
    console.error(error);
    matrixBoard.innerHTML = '<div class="empty">Failed to load certification matrix.</div>';
  }
};

boot();
