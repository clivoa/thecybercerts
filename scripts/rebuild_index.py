#!/usr/bin/env python3
"""Rebuild data/index.yaml from data/certifications/*.yaml (schema v2)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CERTS_DIR = DATA_DIR / "certifications"
INDEX_PATH = DATA_DIR / "index.yaml"

DOMAIN_ORDER = [
    "Communication and Network Security",
    "IAM",
    "Security Architecture and Engineering",
    "Asset Security",
    "Security and Risk Management",
    "Security Assessment and Testing",
    "Software Security",
    "Security Operations",
]

SUBAREA_ORDER = [
    "Cloud/SysOps",
    "*nix",
    "ICS/IoT",
    "GRC",
    "Forensics",
    "Incident Handling",
    "Penetration Testing",
    "Exploitation",
]


def main() -> None:
    files = sorted(path.name for path in CERTS_DIR.glob("*.yaml"))

    domains = set()
    sub_areas = set()

    for filename in files:
        payload = yaml.safe_load((CERTS_DIR / filename).read_text(encoding="utf-8"))
        domains.add(payload.get("domain_area", "Security Operations"))
        for sub in payload.get("sub_areas", []) or []:
            sub_areas.add(sub)

    ordered_domains = [domain for domain in DOMAIN_ORDER if domain in domains] + sorted(domains - set(DOMAIN_ORDER))
    ordered_sub_areas = [sub_area for sub_area in SUBAREA_ORDER if sub_area in sub_areas] + sorted(
        sub_areas - set(SUBAREA_ORDER)
    )

    index = {
        "catalog": "TheCyberCert - Security Certification Roadmap",
        "version": "2026.03",
        "last_reviewed": date.today().isoformat(),
        "schema": "v2",
        "domains": ordered_domains,
        "sub_areas": ordered_sub_areas,
        "searchable_fields": [
            "name",
            "provider",
            "cert_code",
            "domain_area",
            "sub_areas",
            "tracks",
            "level",
            "role_groups",
            "roles",
            "tags",
            "status",
            "introduced_year",
            "description",
            "summary",
            "price_label",
            "price_usd",
        ],
        "certifications": files,
    }

    INDEX_PATH.write_text(yaml.safe_dump(index, sort_keys=False, allow_unicode=False), encoding="utf-8")
    print(f"index rebuilt: {INDEX_PATH}")
    print(f"certifications indexed: {len(files)}")


if __name__ == "__main__":
    main()
