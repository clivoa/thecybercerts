#!/usr/bin/env python3
"""Audit data quality issues in the certification catalog.

Prints a report of certifications with missing or trivial data so maintainers
can prioritize which YAML files to improve.

    python3 scripts/audit_data_quality.py [--json]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CERTS_DIR = ROOT / "data" / "certifications"


def _load(path: Path) -> dict:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _normalize_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if item is not None and str(item).strip()]


def audit(raw: dict, filename: str) -> list[dict]:
    issues: list[dict] = []

    def flag(field: str, message: str) -> None:
        issues.append({"file": filename, "id": raw.get("id", "?"), "name": raw.get("name", "?"), "field": field, "issue": message})

    name = str(raw.get("name") or "")
    description = str(raw.get("description") or raw.get("summary") or "")
    price_usd = int(raw.get("price_usd") or 0)
    price_label = str(raw.get("price_label") or "")
    introduced_year = int(raw.get("introduced_year") or 0)
    url = str(raw.get("url") or "")
    last_updated = str(raw.get("last_updated") or "")
    tags = _normalize_list(raw.get("tags"))
    role_groups = _normalize_list(raw.get("role_groups"))
    sub_areas = _normalize_list(raw.get("sub_areas"))

    # Missing or trivial description
    if not description or description == name:
        flag("description", "description is missing or identical to name")

    # Missing year
    if introduced_year == 0:
        flag("introduced_year", "introduced_year is 0 / not set")

    # Missing URL
    if not url or url == "#":
        flag("url", "url is missing or placeholder '#'")

    # Price label looks like not listed
    if not price_label or price_label.lower() in ("price not listed", ""):
        flag("price_label", "price_label is missing or 'Price not listed'")

    # Missing last_updated
    if not last_updated:
        flag("last_updated", "last_updated is not set")

    # Missing tags — not a hard failure but worth noting
    if not tags:
        flag("tags", "no tags defined")

    # Missing role_groups
    if not role_groups:
        flag("role_groups", "no role_groups defined")

    return issues


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit certification catalog data quality")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    args = parser.parse_args()

    files = sorted(CERTS_DIR.glob("*.yaml"))
    all_issues: list[dict] = []

    for path in files:
        raw = _load(path)
        all_issues.extend(audit(raw, path.name))

    if args.json:
        print(json.dumps(all_issues, indent=2, ensure_ascii=False))
        return

    if not all_issues:
        print("No data quality issues found.")
        return

    # Group by file
    by_file: dict[str, list[dict]] = {}
    for issue in all_issues:
        by_file.setdefault(issue["file"], []).append(issue)

    print(f"Data quality audit — {len(all_issues)} issue(s) across {len(by_file)} file(s)\n")
    print(f"{'File':<35} {'Field':<20} Issue")
    print("-" * 90)

    for filename in sorted(by_file):
        for issue in by_file[filename]:
            print(f"{filename:<35} {issue['field']:<20} {issue['issue']}")

    print(f"\nTotal: {len(all_issues)} issue(s) in {len(by_file)} file(s) out of {len(files)} total.")


if __name__ == "__main__":
    main()
