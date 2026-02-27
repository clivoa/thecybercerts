import { load as parseYAML } from "./vendor/js-yaml.mjs";

const MAX_SELECTION = 4;

const state = {
  certifications: [],
  filtered: [],
  selectedIds: [],
};

const searchInput = document.getElementById("searchInput");
const selectionInfo = document.getElementById("selectionInfo");
const resultsList = document.getElementById("resultsList");
const comparisonTable = document.getElementById("comparisonTable");

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
  role_groups: normalizeArray(cert.role_groups),
  level: String(cert.level || "foundational").toLowerCase(),
  delivery: cert.delivery || "exam",
  renewal: cert.renewal || "See provider policy",
  ai_focus: Boolean(cert.ai_focus),
  description: cert.description || cert.summary || cert.name,
  prerequisites: normalizeArray(cert.prerequisites),
  price_label: cert.price_label || "Price not listed",
  price_usd: Number(cert.price_usd) || 0,
  url: cert.url || "#",
  search_blob: [
    cert.name,
    cert.provider,
    cert.cert_code,
    cert.domain_area,
    ...(Array.isArray(cert.sub_areas) ? cert.sub_areas : []),
    ...(Array.isArray(cert.role_groups) ? cert.role_groups : []),
    cert.description,
  ]
    .join(" ")
    .toLowerCase(),
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

const applySearch = () => {
  const term = searchInput.value.trim().toLowerCase();
  state.filtered = state.certifications
    .filter((cert) => !term || cert.search_blob.includes(term))
    .sort((a, b) => a.name.localeCompare(b.name, "en-US", { sensitivity: "base" }))
    .slice(0, 120);

  renderResults();
};

const toggleSelection = (certId, checked) => {
  if (checked) {
    if (!state.selectedIds.includes(certId) && state.selectedIds.length < MAX_SELECTION) {
      state.selectedIds.push(certId);
    }
  } else {
    state.selectedIds = state.selectedIds.filter((id) => id !== certId);
  }

  renderResults();
  renderComparison();
};

const renderResults = () => {
  resultsList.innerHTML = "";

  if (state.filtered.length === 0) {
    resultsList.innerHTML = '<div class="empty">No certifications found for this query.</div>';
    return;
  }

  const selectedCount = state.selectedIds.length;
  selectionInfo.textContent = `${selectedCount}/${MAX_SELECTION} selected`;

  const fragment = document.createDocumentFragment();

  for (const cert of state.filtered) {
    const selected = state.selectedIds.includes(cert.id);
    const disabled = !selected && selectedCount >= MAX_SELECTION;

    const item = document.createElement("article");
    item.className = "result-item";
    item.innerHTML = `
      <label>
        <input type="checkbox" ${selected ? "checked" : ""} ${disabled ? "disabled" : ""} />
        <span>
          <strong>${cert.name}</strong>
          <div class="result-meta">${cert.provider} • ${cert.level} • ${cert.price_label}</div>
        </span>
      </label>
    `;

    item.querySelector("input").addEventListener("change", (event) => {
      toggleSelection(cert.id, event.target.checked);
    });

    fragment.appendChild(item);
  }

  resultsList.appendChild(fragment);
};

const buildCell = (cert, field) => {
  switch (field) {
    case "name":
      return `<a href="${cert.url}" target="_blank" rel="noopener noreferrer">${cert.name}</a>`;
    case "provider":
      return cert.provider;
    case "code":
      return cert.cert_code;
    case "level":
      return cert.level;
    case "role_groups":
      return cert.role_groups.join(", ");
    case "domain":
      return cert.domain_area;
    case "sub_areas":
      return cert.sub_areas.join(", ") || "-";
    case "price":
      return cert.price_label;
    case "renewal":
      return cert.renewal;
    case "delivery":
      return cert.delivery;
    case "practical":
      return cert.delivery.includes("lab") || cert.delivery.includes("performance") ? "Yes" : "No/Unknown";
    case "ai_focus":
      return cert.ai_focus ? "Yes" : "No";
    case "prerequisites":
      return cert.prerequisites.slice(0, 2).join(" | ") || "-";
    case "description":
      return cert.description;
    default:
      return "-";
  }
};

const renderComparison = () => {
  comparisonTable.innerHTML = "";

  const selected = state.certifications.filter((cert) => state.selectedIds.includes(cert.id));

  if (selected.length < 2) {
    comparisonTable.innerHTML = '<div class="empty">Select at least 2 certifications to compare.</div>';
    return;
  }

  const rows = [
    ["Certification", "name"],
    ["Provider", "provider"],
    ["Code", "code"],
    ["Skill level", "level"],
    ["Role category", "role_groups"],
    ["Domain", "domain"],
    ["Sub-areas", "sub_areas"],
    ["Price", "price"],
    ["Renewal", "renewal"],
    ["Delivery", "delivery"],
    ["Practical focus", "practical"],
    ["AI focus", "ai_focus"],
    ["Prerequisites", "prerequisites"],
    ["Description", "description"],
  ];

  let tableHtml = '<div class="table-wrap"><table><thead><tr><th class="row-name">Field</th>';
  for (const cert of selected) {
    tableHtml += `<th>${cert.cert_code}</th>`;
  }
  tableHtml += "</tr></thead><tbody>";

  for (const [label, field] of rows) {
    tableHtml += `<tr><td class="row-name">${label}</td>`;
    for (const cert of selected) {
      tableHtml += `<td>${buildCell(cert, field)}</td>`;
    }
    tableHtml += "</tr>";
  }

  tableHtml += "</tbody></table></div>";
  comparisonTable.innerHTML = tableHtml;
};

const wireEvents = () => {
  searchInput.addEventListener("input", applySearch);
};

const boot = async () => {
  try {
    state.certifications = await loadCatalog();
    wireEvents();
    applySearch();
    renderComparison();
  } catch (error) {
    console.error(error);
    resultsList.innerHTML = '<div class="empty">Failed to load catalog for compare view.</div>';
  }
};

boot();
