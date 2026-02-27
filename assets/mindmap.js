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

const state = {
  certifications: [],
};

const searchInput = document.getElementById("mindmapSearch");
const expandAllButton = document.getElementById("expandAll");
const collapseAllButton = document.getElementById("collapseAll");
const mindmapCount = document.getElementById("mindmapCount");
const mindmapTree = document.getElementById("mindmapTree");

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

const normalizeCertification = (cert) => ({
  id: cert.id,
  name: cert.name,
  cert_code: cert.cert_code || cert.name,
  provider: cert.provider || "Unknown",
  url: cert.url || "#",
  domain_area: cert.domain_area || "Security Operations",
  sub_areas: normalizeArray(cert.sub_areas),
  level: String(cert.level || "foundational").toLowerCase(),
  ai_focus: Boolean(cert.ai_focus),
  price_label: cert.price_label || "Price not listed",
  search_blob: [
    cert.name,
    cert.cert_code,
    cert.provider,
    cert.domain_area,
    ...(Array.isArray(cert.sub_areas) ? cert.sub_areas : []),
    cert.price_label,
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

const compareCert = (a, b) => a.name.localeCompare(b.name, "en-US", { sensitivity: "base" });

const createLeaf = (cert) => {
  const leaf = document.createElement("a");
  leaf.className = `leaf level-${cert.level}${cert.ai_focus ? " ai" : ""}`;
  leaf.href = cert.url;
  leaf.target = "_blank";
  leaf.rel = "noopener noreferrer";
  leaf.textContent = cert.cert_code || cert.name;
  leaf.dataset.tooltip = `${cert.name}\n${cert.price_label}`;
  leaf.dataset.searchBlob = cert.search_blob;
  leaf.setAttribute("aria-label", `${cert.name}. ${cert.price_label}`);
  return leaf;
};

const createSubNode = (name, certs, open = false) => {
  const subNode = document.createElement("details");
  subNode.className = "sub-node";
  subNode.open = open;

  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${escapeHtml(name)}</span><span class="count-pill">${certs.length}</span>`;

  const leafGrid = document.createElement("div");
  leafGrid.className = "leaf-grid";

  certs.sort(compareCert);
  for (const cert of certs) {
    leafGrid.appendChild(createLeaf(cert));
  }

  subNode.appendChild(summary);
  subNode.appendChild(leafGrid);
  return subNode;
};

const createDomainNode = (domainName, certs) => {
  const domainNode = document.createElement("details");
  domainNode.className = "node";
  domainNode.open = true;

  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${escapeHtml(domainName)}</span><span class="count-pill">${certs.length}</span>`;

  const children = document.createElement("div");
  children.className = "node-children";

  const configuredSubAreas = DOMAIN_SUBAREA_MAP[domainName] || [];

  if (configuredSubAreas.length === 0) {
    children.appendChild(createSubNode("All", certs, true));
  } else {
    const grouped = new Map();
    grouped.set("General", []);
    for (const subArea of configuredSubAreas) {
      grouped.set(subArea, []);
    }

    for (const cert of certs) {
      const match = cert.sub_areas.find((subArea) => grouped.has(subArea));
      if (match) {
        grouped.get(match).push(cert);
      } else {
        grouped.get("General").push(cert);
      }
    }

    for (const [subAreaName, subAreaCerts] of grouped.entries()) {
      children.appendChild(createSubNode(subAreaName, subAreaCerts, subAreaName !== "General"));
    }
  }

  domainNode.appendChild(summary);
  domainNode.appendChild(children);
  return domainNode;
};

const renderMindMap = () => {
  mindmapTree.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const domainName of Object.keys(DOMAIN_SUBAREA_MAP)) {
    const certs = state.certifications.filter((cert) => cert.domain_area === domainName);
    if (certs.length === 0) {
      continue;
    }
    fragment.appendChild(createDomainNode(domainName, certs));
  }

  mindmapTree.appendChild(fragment);
  updateVisibleCount();
};

const updateVisibleCount = () => {
  const allLeaves = [...mindmapTree.querySelectorAll(".leaf")];
  const visibleLeaves = allLeaves.filter((leaf) => !leaf.classList.contains("hidden")).length;
  mindmapCount.textContent = `${visibleLeaves} visible certification node(s) of ${allLeaves.length}`;
};

const applySearchFilter = () => {
  const term = searchInput.value.trim().toLowerCase();
  const allLeaves = [...mindmapTree.querySelectorAll(".leaf")];

  for (const leaf of allLeaves) {
    const match = !term || leaf.dataset.searchBlob.includes(term);
    leaf.classList.toggle("hidden", !match);
  }

  const subNodes = [...mindmapTree.querySelectorAll(".sub-node")];
  for (const subNode of subNodes) {
    const visibleInSub = subNode.querySelectorAll(".leaf:not(.hidden)").length;
    subNode.style.display = visibleInSub > 0 ? "block" : "none";

    const countPill = subNode.querySelector(".count-pill");
    if (countPill) {
      countPill.textContent = String(visibleInSub);
    }

    if (term && visibleInSub > 0) {
      subNode.open = true;
    }
  }

  const domainNodes = [...mindmapTree.querySelectorAll(".node")];
  for (const domainNode of domainNodes) {
    const visibleInDomain = domainNode.querySelectorAll(".leaf:not(.hidden)").length;
    domainNode.style.display = visibleInDomain > 0 ? "block" : "none";

    const countPill = domainNode.querySelector("summary .count-pill");
    if (countPill) {
      countPill.textContent = String(visibleInDomain);
    }

    if (term && visibleInDomain > 0) {
      domainNode.open = true;
    }
  }

  updateVisibleCount();
};

const expandAll = () => {
  for (const node of mindmapTree.querySelectorAll("details")) {
    node.open = true;
  }
};

const collapseAll = () => {
  for (const node of mindmapTree.querySelectorAll("details")) {
    node.open = false;
  }
};

const wireEvents = () => {
  searchInput.addEventListener("input", applySearchFilter);
  expandAllButton.addEventListener("click", expandAll);
  collapseAllButton.addEventListener("click", collapseAll);
};

const boot = async () => {
  try {
    state.certifications = await loadCatalog();
    wireEvents();
    renderMindMap();
  } catch (error) {
    console.error(error);
    mindmapTree.innerHTML = '<div class="node">Failed to load catalog for mind map.</div>';
  }
};

boot();
