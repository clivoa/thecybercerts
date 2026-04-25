/**
 * catalog-loader.js — shared module for loading data/catalog.json.
 *
 * Usage:
 *   import { loadCatalog } from "./catalog-loader.js";
 *   const { metadata, certifications } = await loadCatalog("data/");   // root pages
 *   const { metadata, certifications } = await loadCatalog("../data/"); // subpages
 */

export const normalizeArray = (value) =>
  Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Load and return the pre-built catalog.
 * @param {string} dataBasePath - path to the data/ directory, e.g. "data/" or "../data/"
 * @returns {{ metadata: object, certifications: object[] }}
 */
export const loadCatalog = async (dataBasePath = "data/") => {
  const url = `${dataBasePath}catalog.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load catalog: ${response.status} ${url}`);
  }
  const data = await response.json();
  const { certifications, ...metadata } = data;
  return { metadata, certifications };
};
