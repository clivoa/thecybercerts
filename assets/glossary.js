import { load as parseYAML } from "./vendor/js-yaml.mjs";

const ALPHABET = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

const state = {
  certifications: [],
  filtered: [],
  letter: "All",
  selectedId: null,
};

const searchInput = document.getElementById("searchInput");
const resultInfo = document.getElementById("resultInfo");
const alphabetNav = document.getElementById("alphabetNav");
const glossaryList = document.getElementById("glossaryList");
const certDetails = document.getElementById("certDetails");

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

const getFirstLetter = (text) => {
  const first = String(text || "").trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
};

const normalizeCertification = (cert) => {
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
    delivery: cert.delivery || "exam",
    renewal: cert.renewal || "See provider policy",
    language: cert.language || "en",
    role_groups: normalizeArray(cert.role_groups),
    roles: normalizeArray(cert.roles),
    tags: normalizeArray(cert.tags),
    prerequisites: normalizeArray(cert.prerequisites),
    summary: cert.summary || cert.description || cert.name || "",
    description: cert.description || cert.summary || cert.name || "",
    price_usd: Number(cert.price_usd) || 0,
    price_label: cert.price_label || "Price not listed",
    price_confidence: cert.price_confidence || "estimated",
  };

  normalized.letter = getFirstLetter(normalized.name);
  normalized.search_blob = [
    normalized.name,
    normalized.provider,
    normalized.cert_code,
    normalized.domain_area,
    ...normalized.sub_areas,
    ...normalized.tracks,
    ...normalized.role_groups,
    ...normalized.roles,
    ...normalized.tags,
    normalized.level,
    normalized.status,
    normalized.description,
    normalized.summary,
    normalized.price_label,
    String(normalized.price_usd),
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

  return certs.sort((a, b) => a.name.localeCompare(b.name, "en-US", { sensitivity: "base" }));
};

const getActiveLetters = () => new Set(state.certifications.map((cert) => cert.letter).filter((letter) => /^[A-Z]$/.test(letter)));

const renderAlphabet = () => {
  const activeLetters = getActiveLetters();
  alphabetNav.innerHTML = "";

  for (const letter of ALPHABET) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `alpha-btn${state.letter === letter ? " active" : ""}`;
    button.textContent = letter;

    if (letter !== "All" && !activeLetters.has(letter)) {
      button.disabled = true;
    }

    button.addEventListener("click", () => {
      state.letter = letter;
      applyFilters();
    });

    alphabetNav.appendChild(button);
  }
};

const ensureSelection = () => {
  const selectedIsVisible = state.filtered.some((cert) => cert.id === state.selectedId);
  if (!selectedIsVisible) {
    state.selectedId = state.filtered[0]?.id || null;
  }
};

const renderList = () => {
  glossaryList.innerHTML = "";

  if (state.filtered.length === 0) {
    glossaryList.innerHTML = '<p class="empty">No certifications found for this query.</p>';
    return;
  }

  const grouped = new Map();
  for (const cert of state.filtered) {
    const key = cert.letter;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(cert);
  }

  const sortedLetters = [...grouped.keys()].sort((a, b) => a.localeCompare(b, "en-US", { sensitivity: "base" }));
  const fragment = document.createDocumentFragment();

  for (const letter of sortedLetters) {
    const group = document.createElement("section");
    group.className = "letter-group";
    group.innerHTML = `<h3 class="letter-heading">${escapeHtml(letter)}</h3>`;

    for (const cert of grouped.get(letter)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `glossary-item${cert.id === state.selectedId ? " active" : ""}`;
      button.innerHTML = `
        <div class="glossary-item-name">${escapeHtml(cert.name)}</div>
        <div class="glossary-item-meta">${escapeHtml(cert.provider)} • ${escapeHtml(cert.cert_code)} • ${escapeHtml(cert.price_label)}</div>
      `;
      button.addEventListener("click", () => {
        state.selectedId = cert.id;
        renderList();
        renderDetails();
      });

      group.appendChild(button);
    }

    fragment.appendChild(group);
  }

  glossaryList.appendChild(fragment);
};

const renderMetaBlock = (label, value) => `
  <article class="meta-block">
    <p class="meta-label">${escapeHtml(label)}</p>
    <p class="meta-value">${escapeHtml(value || "-")}</p>
  </article>
`;

const renderDetails = () => {
  const cert = state.filtered.find((item) => item.id === state.selectedId);

  if (!cert) {
    certDetails.innerHTML = '<p class="empty">Select a certification to view details.</p>';
    return;
  }

  const infoBlocks = [
    ["Price", cert.price_label],
    ["Price (USD)", cert.price_usd > 0 ? `$${cert.price_usd}` : "Unknown/Included in label"],
    ["Level", cert.level],
    ["Status", cert.status],
    ["Domain", cert.domain_area],
    ["Sub-areas", cert.sub_areas.join(", ") || "General"],
    ["Role groups", cert.role_groups.join(", ") || "Not specified"],
    ["Roles", cert.roles.join(", ") || "Not specified"],
    ["Tracks", cert.tracks.join(", ") || "Not specified"],
    ["Delivery", cert.delivery],
    ["Renewal", cert.renewal],
    ["Language", cert.language],
    ["Introduced year", cert.introduced_year > 0 ? String(cert.introduced_year) : "Not listed"],
    ["Last updated", cert.last_updated || "Not listed"],
    ["Prerequisites", cert.prerequisites.join(" | ") || "Not listed"],
    ["Price confidence", cert.price_confidence],
  ];

  certDetails.innerHTML = `
    <div class="detail-head">
      <div>
        <h2>${escapeHtml(cert.name)}</h2>
        <p class="detail-provider">${escapeHtml(cert.provider)}</p>
      </div>
      <span class="detail-code">${escapeHtml(cert.cert_code)}</span>
    </div>

    <p class="detail-summary">${escapeHtml(cert.description || cert.summary)}</p>

    <div class="detail-actions">
      <a class="detail-link" href="${escapeHtml(cert.url)}" target="_blank" rel="noopener noreferrer">Open official certification page</a>
    </div>

    <div class="meta-grid">${infoBlocks.map(([label, value]) => renderMetaBlock(label, value)).join("")}</div>

    <div class="tag-row">
      ${cert.ai_focus ? '<span class="tag ai">AI Focus</span>' : ""}
      ${cert.tags.slice(0, 12).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
};

const applyFilters = () => {
  const term = searchInput.value.trim().toLowerCase();

  state.filtered = state.certifications
    .filter((cert) => state.letter === "All" || cert.letter === state.letter)
    .filter((cert) => !term || cert.search_blob.includes(term));

  ensureSelection();
  renderAlphabet();
  renderList();
  renderDetails();

  resultInfo.textContent = `${state.filtered.length} certification(s) shown from ${state.certifications.length}`;
};

const wireEvents = () => {
  searchInput.addEventListener("input", applyFilters);
};

const boot = async () => {
  try {
    state.certifications = await loadCatalog();
    wireEvents();
    renderAlphabet();
    applyFilters();
  } catch (error) {
    console.error(error);
    glossaryList.innerHTML = '<p class="empty">Failed to load glossary catalog.</p>';
    certDetails.innerHTML = '<p class="empty">Details unavailable.</p>';
  }
};

boot();
