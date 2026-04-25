#!/usr/bin/env python3
"""Build data/catalog.json: all certifications pre-normalized into a single JSON file.

Replaces 495+ individual YAML fetches with a single JSON request on page load.
Run this script whenever the catalog data changes:

    python3 scripts/build_catalog.py
"""

from __future__ import annotations

import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CERTS_DIR = DATA_DIR / "certifications"
INDEX_PATH = DATA_DIR / "index.yaml"
CATALOG_OUT = DATA_DIR / "catalog.json"


def normalize_array(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if item is not None and str(item).strip()]


def normalize_cert(raw: dict, source_file: str) -> dict:
    price_usd = int(raw.get("price_usd") or 0)
    price_label = str(raw.get("price_label") or "Price not listed")
    description = str(raw.get("description") or raw.get("summary") or raw.get("name") or "")
    summary = str(raw.get("summary") or raw.get("description") or raw.get("name") or "")

    cert = {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or ""),
        "provider": str(raw.get("provider") or raw.get("vendor") or "Unknown"),
        "cert_code": str(raw.get("cert_code") or raw.get("name") or "N/A"),
        "url": str(raw.get("url") or "#"),
        "domain_area": str(raw.get("domain_area") or "Security Operations"),
        "sub_areas": normalize_array(raw.get("sub_areas")),
        "tracks": normalize_array(raw.get("tracks")),
        "level": str(raw.get("level") or "foundational").lower(),
        "status": str(raw.get("status") or "active").lower(),
        "ai_focus": bool(raw.get("ai_focus")),
        "introduced_year": int(raw.get("introduced_year") or 0),
        "last_updated": str(raw.get("last_updated") or ""),
        "summary": summary,
        "delivery": str(raw.get("delivery") or "exam"),
        "renewal": str(raw.get("renewal") or "See provider policy"),
        "language": str(raw.get("language") or "en"),
        "role_groups": normalize_array(raw.get("role_groups")),
        "roles": normalize_array(raw.get("roles")),
        "tags": normalize_array(raw.get("tags")),
        "prerequisites": normalize_array(raw.get("prerequisites")),
        "description": description,
        "price_usd": price_usd,
        "price_label": price_label,
        "price_confidence": str(raw.get("price_confidence") or "estimated"),
        "source_file": source_file,
    }

    # Pre-build search blob for fast client-side filtering
    cert["search_blob"] = " ".join([
        cert["name"],
        cert["provider"],
        cert["cert_code"],
        cert["domain_area"],
        *cert["sub_areas"],
        *cert["tracks"],
        cert["level"],
        cert["status"],
        cert["delivery"],
        cert["description"],
        cert["summary"],
        cert["last_updated"],
        *cert["role_groups"],
        *cert["roles"],
        *cert["tags"],
        *cert["prerequisites"],
        cert["price_label"],
        str(cert["price_usd"]),
    ]).lower()

    return cert


def main() -> None:
    index = yaml.safe_load(INDEX_PATH.read_text(encoding="utf-8"))
    files: list[str] = index.get("certifications") or []

    certifications = []
    for filename in files:
        raw = yaml.safe_load((CERTS_DIR / filename).read_text(encoding="utf-8"))
        certifications.append(normalize_cert(raw, filename))

    output = {
        "catalog": index.get("catalog", "TheCyberCerts"),
        "version": index.get("version", ""),
        "last_reviewed": str(index.get("last_reviewed") or ""),
        "schema": index.get("schema", "v2"),
        "domains": index.get("domains") or [],
        "sub_areas": index.get("sub_areas") or [],
        "certifications": certifications,
    }

    CATALOG_OUT.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"catalog.json written: {CATALOG_OUT}")
    print(f"certifications bundled: {len(certifications)}")


if __name__ == "__main__":
    main()
