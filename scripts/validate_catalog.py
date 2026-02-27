#!/usr/bin/env python3
"""Validate catalog YAML files for required v2 fields."""

from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CERTS_DIR = ROOT / "data" / "certifications"

VALID_LEVELS = {"foundational", "intermediate", "advanced", "expert"}
VALID_STATUS = {"active", "beta", "retired"}
VALID_PRICE_CONFIDENCE = {"from-original-tooltip", "estimated"}
VALID_DOMAINS = {
    "Communication and Network Security",
    "IAM",
    "Security Architecture and Engineering",
    "Asset Security",
    "Security and Risk Management",
    "Security Assessment and Testing",
    "Software Security",
    "Security Operations",
}
VALID_SUB_AREAS = {
    "Cloud/SysOps",
    "*nix",
    "ICS/IoT",
    "GRC",
    "Forensics",
    "Incident Handling",
    "Penetration Testing",
    "Exploitation",
}
VALID_ROLE_GROUPS = {
    "Network",
    "Asset",
    "Engineer",
    "Management",
    "Testing",
    "Software",
    "Blue Team Ops",
    "Red Team Ops",
    "IAM",
}
DOMAIN_SUBAREA_MAP = {
    "Communication and Network Security": set(),
    "IAM": set(),
    "Security Architecture and Engineering": {"Cloud/SysOps", "*nix", "ICS/IoT"},
    "Asset Security": set(),
    "Security and Risk Management": {"GRC"},
    "Security Assessment and Testing": set(),
    "Software Security": set(),
    "Security Operations": {
        "Forensics",
        "Incident Handling",
        "Penetration Testing",
        "Exploitation",
    },
}
UNKNOWN_PRICE_LABEL_HINTS = {
    "not listed",
    "unknown",
    "tbd",
    "see provider",
    "n/a",
    "varies",
}
URL_RE = re.compile(r"^https?://")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

REQUIRED_KEYS = {
    "id",
    "name",
    "provider",
    "cert_code",
    "url",
    "domain_area",
    "sub_areas",
    "tracks",
    "level",
    "status",
    "ai_focus",
    "introduced_year",
    "last_updated",
    "delivery",
    "renewal",
    "language",
    "role_groups",
    "roles",
    "tags",
    "prerequisites",
    "description",
    "summary",
    "price_usd",
    "price_label",
    "price_confidence",
    "tooltip_legacy",
}


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def main() -> int:
    files = sorted(CERTS_DIR.glob("*.yaml"))
    errors: list[str] = []

    if not files:
        fail("No YAML files found in data/certifications", errors)

    seen_ids: set[str] = set()

    for path in files:
        payload = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            fail(f"{path.name}: must contain a YAML object", errors)
            continue

        missing = sorted(REQUIRED_KEYS - set(payload.keys()))
        if missing:
            fail(f"{path.name}: missing keys {', '.join(missing)}", errors)

        file_id = path.stem
        cert_id = str(payload.get("id", ""))
        if cert_id != file_id:
            fail(f"{path.name}: id '{cert_id}' must match filename '{file_id}'", errors)

        if cert_id in seen_ids:
            fail(f"{path.name}: duplicate id '{cert_id}'", errors)
        seen_ids.add(cert_id)

        if payload.get("domain_area") not in VALID_DOMAINS:
            fail(f"{path.name}: invalid domain_area '{payload.get('domain_area')}'", errors)

        sub_areas = payload.get("sub_areas")
        if not isinstance(sub_areas, list):
            fail(f"{path.name}: sub_areas must be a list", errors)
        else:
            for sub_area in sub_areas:
                if sub_area not in VALID_SUB_AREAS:
                    fail(f"{path.name}: invalid sub_area '{sub_area}'", errors)

            domain = payload.get("domain_area")
            allowed_sub_areas = DOMAIN_SUBAREA_MAP.get(domain, set())
            if allowed_sub_areas:
                for sub_area in sub_areas:
                    if sub_area not in allowed_sub_areas:
                        fail(
                            (
                                f"{path.name}: sub_area '{sub_area}' is incompatible with "
                                f"domain_area '{domain}'"
                            ),
                            errors,
                        )
            elif sub_areas:
                fail(
                    (
                        f"{path.name}: domain_area '{domain}' does not define sub-areas, "
                        "so sub_areas must be empty"
                    ),
                    errors,
                )

        role_groups = payload.get("role_groups")
        if not isinstance(role_groups, list) or not role_groups:
            fail(f"{path.name}: role_groups must be a non-empty list", errors)
        else:
            for role_group in role_groups:
                if role_group not in VALID_ROLE_GROUPS:
                    fail(f"{path.name}: invalid role_group '{role_group}'", errors)

        if payload.get("level") not in VALID_LEVELS:
            fail(f"{path.name}: invalid level '{payload.get('level')}'", errors)

        if payload.get("status") not in VALID_STATUS:
            fail(f"{path.name}: invalid status '{payload.get('status')}'", errors)

        if not isinstance(payload.get("ai_focus"), bool):
            fail(f"{path.name}: ai_focus must be boolean", errors)

        if not isinstance(payload.get("introduced_year"), int):
            fail(f"{path.name}: introduced_year must be integer", errors)

        if not isinstance(payload.get("price_usd"), int):
            fail(f"{path.name}: price_usd must be integer", errors)
        elif int(payload.get("price_usd")) < 0:
            fail(f"{path.name}: price_usd must be >= 0", errors)

        description = str(payload.get("description", "")).strip()
        if not description:
            fail(f"{path.name}: description must not be empty", errors)

        price_label = str(payload.get("price_label", "")).strip()
        if not price_label:
            fail(f"{path.name}: price_label must not be empty", errors)

        price_confidence = str(payload.get("price_confidence", ""))
        if price_confidence not in VALID_PRICE_CONFIDENCE:
            fail(
                (
                    f"{path.name}: price_confidence '{price_confidence}' must be one of "
                    f"{', '.join(sorted(VALID_PRICE_CONFIDENCE))}"
                ),
                errors,
            )

        url = str(payload.get("url", "")).strip()
        if not URL_RE.match(url):
            fail(f"{path.name}: url must start with http:// or https://", errors)

        last_updated = str(payload.get("last_updated", "")).strip()
        if not ISO_DATE_RE.match(last_updated):
            fail(f"{path.name}: last_updated must use YYYY-MM-DD", errors)
        else:
            try:
                date.fromisoformat(last_updated)
            except ValueError:
                fail(f"{path.name}: last_updated is not a valid calendar date", errors)

        summary = str(payload.get("summary", "")).strip()
        if not summary:
            fail(f"{path.name}: summary must not be empty", errors)

        tooltip_legacy = str(payload.get("tooltip_legacy", "")).strip()
        name = str(payload.get("name", "")).strip()
        cert_code = str(payload.get("cert_code", "")).strip()
        description_text = str(payload.get("description", "")).strip()
        if not tooltip_legacy:
            fail(f"{path.name}: tooltip_legacy must not be empty", errors)
        else:
            tooltip_lower = tooltip_legacy.lower()
            name_match = bool(name) and name.lower() in tooltip_lower
            code_match = bool(cert_code) and cert_code.lower() in tooltip_lower
            description_match = bool(description_text) and description_text.lower() in tooltip_lower
            if not name_match and not code_match and not description_match:
                fail(
                    f"{path.name}: tooltip_legacy should contain name, cert_code, or description",
                    errors,
                )

        price_usd = int(payload.get("price_usd", 0))
        price_label_lower = price_label.lower()
        label_has_number_or_dollar = bool(re.search(r"\d", price_label)) or "$" in price_label

        if price_usd == 0 and label_has_number_or_dollar:
            if not any(marker in price_label_lower for marker in UNKNOWN_PRICE_LABEL_HINTS) and "free" not in price_label_lower:
                fail(
                    (
                        f"{path.name}: price_usd is 0 but price_label looks numeric; "
                        "set a numeric price_usd or use an unknown/free label"
                    ),
                    errors,
                )

        if price_usd > 0 and not re.search(r"\d", price_label):
            fail(
                f"{path.name}: price_usd is > 0 but price_label has no numeric hint",
                errors,
            )

        if "free" in price_label_lower and price_usd != 0:
            fail(f"{path.name}: price_label says free but price_usd is not 0", errors)

    if errors:
        print("Catalog validation failed:")
        for message in errors:
            print(f"- {message}")
        return 1

    print(f"Catalog validation passed for {len(files)} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
