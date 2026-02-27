#!/usr/bin/env python3
"""Import and normalize the original SecCertRoadmap dataset into YAML files."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parent.parent
SOURCE_JSON = ROOT.parent / "SecCertRoadmap" / "data" / "certificates.json"
TARGET_DIR = ROOT / "data" / "certifications"
INDEX_FILE = ROOT / "data" / "index.yaml"
TODAY = "2026-02-27"

DOMAIN_LAYOUT = [
    "Communication and Network Security",
    "IAM",
    "Security Architecture and Engineering",
    "Asset Security",
    "Security and Risk Management",
    "Security Assessment and Testing",
    "Software Security",
    "Security Operations",
]

SUBAREA_LAYOUT = [
    "Cloud/SysOps",
    "*nix",
    "ICS/IoT",
    "GRC",
    "Forensics",
    "Incident Handling",
    "Penetration Testing",
    "Exploitation",
]

HOST_PROVIDER_MAP = {
    "offensive-security.com": "OffSec",
    "giac.org": "GIAC",
    "isaca.org": "ISACA",
    "isc2.org": "ISC2",
    "comptia.org": "CompTIA",
    "learn.microsoft.com": "Microsoft",
    "aws.amazon.com": "AWS",
    "cloud.google.com": "Google Cloud",
    "cisco.com": "Cisco",
    "hackthebox.com": "Hack The Box",
    "academy.hackthebox.com": "Hack The Box",
    "certifications.tcm-sec.com": "TCM Security",
    "tcm-sec.com": "TCM Security",
    "pecb.com": "PECB",
    "iapp.org": "IAPP",
    "linuxfoundation.org": "Linux Foundation",
    "training.linuxfoundation.org": "Linux Foundation",
    "sans.org": "SANS",
    "sabsa.org": "SABSA",
    "pmi.org": "PMI",
    "axelos.com": "Axelos",
    "fortinet.com": "Fortinet",
    "paloaltonetworks.com": "Palo Alto Networks",
    "ec-council.org": "EC-Council",
    "elearnsecurity.com": "INE",
    "ine.com": "INE",
    "securityblue.team": "Security Blue Team",
    "cyberdefenders.org": "CyberDefenders",
    "scrum.org": "Scrum.org",
    "zachman.com": "Zachman",
}

MAIN_TO_AREA = {
    "network": "Communication and Network Security",
    "iam": "IAM",
    "engineer": "Security Architecture and Engineering",
    "asset": "Asset Security",
    "mgmt": "Security and Risk Management",
    "test": "Security Assessment and Testing",
    "software": "Software Security",
    "blueops": "Security Operations",
    "redops": "Security Operations",
}

ROLE_GROUP_MAP = {
    "network": "Network",
    "asset": "Asset",
    "engineer": "Engineer",
    "mgmt": "Management",
    "test": "Testing",
    "software": "Software",
    "blueops": "Blue Team Ops",
    "redops": "Red Team Ops",
    "iam": "IAM",
}

SUB_TO_SUBAREA = {
    "cloud_sec_ops": "Cloud/SysOps",
    "nix": "*nix",
    "ics_iot": "ICS/IoT",
    "grc": "GRC",
    "forensics": "Forensics",
    "incident_handling": "Incident Handling",
    "pen_testing": "Penetration Testing",
    "exploit": "Exploitation",
}

AREA_TO_ROLE = {
    "Communication and Network Security": ["network-security-engineer"],
    "IAM": ["iam-engineer"],
    "Security Architecture and Engineering": ["security-architect"],
    "Asset Security": ["asset-security-specialist"],
    "Security and Risk Management": ["grc-analyst"],
    "Security Assessment and Testing": ["security-assessor"],
    "Software Security": ["appsec-engineer"],
    "Security Operations": ["soc-analyst"],
}

SUBAREA_TO_ROLE = {
    "Cloud/SysOps": ["cloud-security-engineer"],
    "*nix": ["linux-security-engineer"],
    "ICS/IoT": ["ot-security-engineer"],
    "GRC": ["compliance-analyst"],
    "Forensics": ["forensic-analyst"],
    "Incident Handling": ["incident-responder"],
    "Penetration Testing": ["penetration-tester"],
    "Exploitation": ["exploit-developer"],
}


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "cert"


def unique_id(base: str, used: set[str]) -> str:
    if base not in used:
        used.add(base)
        return base
    idx = 2
    while f"{base}-{idx}" in used:
        idx += 1
    candidate = f"{base}-{idx}"
    used.add(candidate)
    return candidate


def parse_provider(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return "Unknown"

    host = host.replace("www.", "")

    for key, provider in HOST_PROVIDER_MAP.items():
        if host == key or host.endswith(f".{key}"):
            return provider

    parts = host.split(".")
    if len(parts) >= 2:
        base = parts[-2]
    else:
        base = host
    return base.replace("-", " ").title() if base else "Unknown"


def normalize_lines(tooltip: str) -> List[str]:
    tooltip = tooltip.replace("\\n", "\n")
    lines: List[str] = []
    for raw in tooltip.split("\n"):
        line = " ".join(raw.split()).strip()
        if line:
            lines.append(line)
    return lines


def extract_price(lines: List[str]) -> Tuple[str, int, str]:
    if not lines:
        return "Price not listed", 0, "estimated"

    price_lines = [
        line
        for line in lines[1:]
        if re.search(r"(\$|€|£|free|subscription|travel|member|exam)", line, flags=re.IGNORECASE)
    ]

    if not price_lines and len(lines) > 1:
        price_lines = [lines[1]]

    if not price_lines:
        return "Price not listed", 0, "estimated"

    label = " | ".join(price_lines[:2])
    amount_match = re.search(r"\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)", label)
    amount = 0
    if amount_match:
        amount = int(float(amount_match.group(1).replace(",", "")))

    confidence = "from-original-tooltip"
    return label, amount, confidence


def skill_to_level(skill: int) -> str:
    if skill <= 6:
        return "expert"
    if skill <= 12:
        return "advanced"
    if skill <= 18:
        return "intermediate"
    return "foundational"


def category_to_domain(main_cat: str, sub_cat: str | None) -> Tuple[str, List[str]]:
    area = MAIN_TO_AREA.get(main_cat, "Security Operations")
    sub_areas: List[str] = []

    if sub_cat and sub_cat in SUB_TO_SUBAREA:
        sub_areas.append(SUB_TO_SUBAREA[sub_cat])

    return area, sub_areas


def infer_delivery(lines: List[str]) -> str:
    text = " ".join(lines).lower()
    if "interview" in text:
        return "interview"
    if "lab" in text and "exam" in text:
        return "exam+lab"
    if "lab" in text:
        return "lab"
    if "course" in text and "exam" in text:
        return "course+exam"
    if "course" in text:
        return "course"
    return "exam"


def infer_ai_focus(cert_code: str, title: str, summary: str, tags: List[str]) -> bool:
    text = f"{cert_code} {title} {summary} {' '.join(tags)}".lower()
    keywords = [" ai", "machine learning", "ml ", "llm", "model", "iso42001", "iso/iec 42001", "aigp"]
    return any(keyword in text for keyword in keywords)


def infer_tracks(area: str, sub_areas: List[str]) -> List[str]:
    track_map = {
        "Communication and Network Security": "communication-network-security",
        "IAM": "iam",
        "Security Architecture and Engineering": "security-architecture-and-engineering",
        "Asset Security": "asset-security",
        "Security and Risk Management": "security-and-risk-management",
        "Security Assessment and Testing": "security-assessment-and-testing",
        "Software Security": "software-security",
        "Security Operations": "security-operations",
    }

    sub_track_map = {
        "Cloud/SysOps": "cloud-sysops",
        "*nix": "nix",
        "ICS/IoT": "ics-iot",
        "GRC": "grc",
        "Forensics": "forensics",
        "Incident Handling": "incident-handling",
        "Penetration Testing": "penetration-testing",
        "Exploitation": "exploitation",
    }

    tracks = [track_map.get(area, slugify(area))]
    for sub in sub_areas:
        tracks.append(sub_track_map.get(sub, slugify(sub)))
    return sorted(set(tracks))


def infer_roles(area: str, sub_areas: List[str]) -> List[str]:
    roles = list(AREA_TO_ROLE.get(area, ["security-professional"]))
    for sub in sub_areas:
        roles.extend(SUBAREA_TO_ROLE.get(sub, []))
    return sorted(set(roles))


def infer_tags(main_cat: str, sub_cat: str | None, adjacent: List[str], area: str, sub_areas: List[str]) -> List[str]:
    tags = {slugify(main_cat), slugify(area)}
    if sub_cat:
        tags.add(slugify(sub_cat))
    for sub in sub_areas:
        tags.add(slugify(sub))
    for cat in adjacent:
        tags.add(slugify(cat))
    return sorted(tags)


def infer_prereqs(lines: List[str]) -> List[str]:
    out = []
    for line in lines[1:]:
        l = line.lower()
        if "require" in l or "prereq" in l or "recommended" in l:
            out.append(line)
    return out or ["See provider requirements"]


def infer_role_groups(main_cat: str, adjacent: List[str]) -> List[str]:
    groups = set()
    if main_cat in ROLE_GROUP_MAP:
        groups.add(ROLE_GROUP_MAP[main_cat])
    for cat in adjacent:
        if cat in ROLE_GROUP_MAP:
            groups.add(ROLE_GROUP_MAP[cat])
    return sorted(groups) if groups else ["Management"]


def build_cert(record: Dict, used_ids: set[str]) -> Dict:
    tooltip_lines = normalize_lines(record.get("tooltiptext", ""))
    description = tooltip_lines[0] if tooltip_lines else record["content"]
    area, sub_areas = category_to_domain(record.get("mainCategory", ""), record.get("subCategory"))
    price_label, price_usd, price_confidence = extract_price(tooltip_lines)

    cert_id = unique_id(slugify(record["content"]), used_ids)
    provider = parse_provider(record.get("href", ""))

    tags = infer_tags(
        record.get("mainCategory", ""),
        record.get("subCategory"),
        record.get("adjacentCategory", []),
        area,
        sub_areas,
    )

    cert = {
        "id": cert_id,
        "name": record.get("content", "").strip(),
        "provider": provider,
        "cert_code": record.get("content", "").strip(),
        "url": record.get("href", "").strip(),
        "domain_area": area,
        "sub_areas": sub_areas,
        "tracks": infer_tracks(area, sub_areas),
        "level": skill_to_level(int(record.get("skillLevel", 26))),
        "status": "active",
        "ai_focus": infer_ai_focus(record.get("content", ""), description, description, tags),
        "introduced_year": 0,
        "last_updated": TODAY,
        "delivery": infer_delivery(tooltip_lines),
        "renewal": "See provider policy",
        "language": "en",
        "role_groups": infer_role_groups(record.get("mainCategory", ""), record.get("adjacentCategory", [])),
        "roles": infer_roles(area, sub_areas),
        "tags": tags,
        "prerequisites": infer_prereqs(tooltip_lines),
        "description": description,
        "summary": description,
        "price_usd": int(price_usd),
        "price_label": price_label,
        "price_confidence": price_confidence,
        "tooltip_legacy": " | ".join(tooltip_lines[:3]),
    }
    return cert


def build_extra_ai_certs(used_ids: set[str]) -> List[Dict]:
    extras = [
        {
            "id": "comptia-secai-plus",
            "name": "CompTIA SecAI+",
            "provider": "CompTIA",
            "cert_code": "SecAI+",
            "url": "https://www.comptia.org/en/certifications/secai/",
            "domain_area": "Security Operations",
            "sub_areas": ["Incident Handling"],
            "tracks": ["ai-security", "security-operations", "incident-handling"],
            "level": "intermediate",
            "status": "active",
            "ai_focus": True,
            "introduced_year": 2026,
            "last_updated": TODAY,
            "delivery": "exam",
            "renewal": "3 years",
            "language": "en",
            "role_groups": ["Blue Team Ops"],
            "roles": ["ai-security-analyst", "soc-analyst"],
            "tags": ["ai-security", "ai-operations", "comptia"],
            "prerequisites": ["Security+ or equivalent recommended"],
            "description": "AI-focused security certification for defending AI systems and handling AI-driven threats.",
            "summary": "AI-focused security certification for defending AI systems and handling AI-driven threats.",
            "price_usd": 499,
            "price_label": "$499 exam (list price, may vary by region)",
            "price_confidence": "estimated",
            "tooltip_legacy": "CompTIA SecAI+ | $499 exam (list price, may vary by region)",
        },
        {
            "id": "isaca-aaia",
            "name": "Advanced in AI Audit (AAIA)",
            "provider": "ISACA",
            "cert_code": "AAIA",
            "url": "https://www.isaca.org/credentialing/aaia",
            "domain_area": "Security Assessment and Testing",
            "sub_areas": ["GRC"],
            "tracks": ["ai-security", "audit", "grc"],
            "level": "advanced",
            "status": "active",
            "ai_focus": True,
            "introduced_year": 2025,
            "last_updated": TODAY,
            "delivery": "exam",
            "renewal": "3 years",
            "language": "en",
            "role_groups": ["Management", "Testing"],
            "roles": ["ai-audit-specialist", "it-auditor"],
            "tags": ["ai-audit", "assurance", "isaca"],
            "prerequisites": ["CISA or equivalent required"],
            "description": "Advanced AI audit credential covering governance, controls, and assurance techniques.",
            "summary": "Advanced AI audit credential covering governance, controls, and assurance techniques.",
            "price_usd": 575,
            "price_label": "$575 member / $760 non-member",
            "price_confidence": "estimated",
            "tooltip_legacy": "Advanced in AI Audit (AAIA) | $575 member / $760 non-member",
        },
        {
            "id": "isaca-aaism",
            "name": "Advanced in AI Security Management (AAISM)",
            "provider": "ISACA",
            "cert_code": "AAISM",
            "url": "https://www.isaca.org/credentialing/aaism",
            "domain_area": "Security and Risk Management",
            "sub_areas": ["GRC"],
            "tracks": ["ai-security", "grc", "security-management"],
            "level": "advanced",
            "status": "active",
            "ai_focus": True,
            "introduced_year": 2025,
            "last_updated": TODAY,
            "delivery": "exam",
            "renewal": "3 years",
            "language": "en",
            "role_groups": ["Management"],
            "roles": ["ai-security-manager", "security-manager"],
            "tags": ["ai-risk", "security-management", "isaca"],
            "prerequisites": ["CISM/CISSP or equivalent recommended"],
            "description": "AI security management credential for enterprise governance and risk execution.",
            "summary": "AI security management credential for enterprise governance and risk execution.",
            "price_usd": 575,
            "price_label": "$575 member / $760 non-member",
            "price_confidence": "estimated",
            "tooltip_legacy": "Advanced in AI Security Management (AAISM) | $575 member / $760 non-member",
        },
        {
            "id": "isaca-aair",
            "name": "Advanced in AI Risk (AAIR)",
            "provider": "ISACA",
            "cert_code": "AAIR",
            "url": "https://www.isaca.org/credentialing/aair",
            "domain_area": "Security and Risk Management",
            "sub_areas": ["GRC"],
            "tracks": ["ai-security", "grc", "risk-management"],
            "level": "advanced",
            "status": "beta",
            "ai_focus": True,
            "introduced_year": 2025,
            "last_updated": TODAY,
            "delivery": "beta-exam",
            "renewal": "See provider policy",
            "language": "en",
            "role_groups": ["Management"],
            "roles": ["ai-risk-specialist", "risk-manager"],
            "tags": ["ai-risk", "beta", "isaca"],
            "prerequisites": ["Risk certification or equivalent experience recommended"],
            "description": "AI risk credential focused on lifecycle risk decisions and governance controls.",
            "summary": "AI risk credential focused on lifecycle risk decisions and governance controls.",
            "price_usd": 575,
            "price_label": "$575 member / $760 non-member (expected)",
            "price_confidence": "estimated",
            "tooltip_legacy": "Advanced in AI Risk (AAIR) | $575 member / $760 non-member (expected)",
        },
        {
            "id": "iapp-aigp",
            "name": "Artificial Intelligence Governance Professional (AIGP)",
            "provider": "IAPP",
            "cert_code": "AIGP",
            "url": "https://iapp.org/certify/aigp/",
            "domain_area": "Security and Risk Management",
            "sub_areas": ["GRC"],
            "tracks": ["ai-security", "governance", "grc"],
            "level": "advanced",
            "status": "active",
            "ai_focus": True,
            "introduced_year": 2023,
            "last_updated": TODAY,
            "delivery": "exam",
            "renewal": "2 years",
            "language": "en",
            "role_groups": ["Management"],
            "roles": ["ai-governance-lead", "privacy-lead"],
            "tags": ["ai-governance", "privacy", "policy"],
            "prerequisites": ["Governance or privacy background recommended"],
            "description": "Governance-focused AI credential for responsible and compliant AI programs.",
            "summary": "Governance-focused AI credential for responsible and compliant AI programs.",
            "price_usd": 550,
            "price_label": "$550 exam + $250 one-time fee",
            "price_confidence": "estimated",
            "tooltip_legacy": "AIGP | $550 exam + $250 one-time fee",
        },
        {
            "id": "giac-goaa",
            "name": "GIAC Offensive AI Analyst (GOAA)",
            "provider": "GIAC",
            "cert_code": "GOAA",
            "url": "https://www.giac.org/certifications/offensive-ai-analyst-goaa/",
            "domain_area": "Security Operations",
            "sub_areas": ["Exploitation"],
            "tracks": ["ai-security", "offensive-security", "exploitation"],
            "level": "advanced",
            "status": "active",
            "ai_focus": True,
            "introduced_year": 2026,
            "last_updated": TODAY,
            "delivery": "exam",
            "renewal": "4 years",
            "language": "en",
            "role_groups": ["Red Team Ops"],
            "roles": ["offensive-ai-analyst", "red-team-operator"],
            "tags": ["offensive-ai", "giac", "cyberlive"],
            "prerequisites": ["Offensive security experience recommended"],
            "description": "New GIAC credential validating offensive AI tradecraft and adversarial workflows.",
            "summary": "New GIAC credential validating offensive AI tradecraft and adversarial workflows.",
            "price_usd": 999,
            "price_label": "$999 exam",
            "price_confidence": "estimated",
            "tooltip_legacy": "GIAC Offensive AI Analyst (GOAA) | $999 exam",
        },
        {
            "id": "pecb-iso-42001-lead-auditor",
            "name": "ISO/IEC 42001 Lead Auditor",
            "provider": "PECB",
            "cert_code": "ISO42001-LA",
            "url": "https://pecb.com/en/education-and-certification-for-individuals/iso-iec-42001",
            "domain_area": "Security and Risk Management",
            "sub_areas": ["GRC"],
            "tracks": ["ai-security", "grc", "audit"],
            "level": "advanced",
            "status": "active",
            "ai_focus": True,
            "introduced_year": 2024,
            "last_updated": TODAY,
            "delivery": "course+exam",
            "renewal": "See provider policy",
            "language": "en",
            "role_groups": ["Management", "Testing"],
            "roles": ["ai-compliance-specialist", "lead-auditor"],
            "tags": ["iso42001", "audit", "ai-management-system"],
            "prerequisites": ["Audit background recommended"],
            "description": "Audit track for assessing AI management systems against ISO/IEC 42001.",
            "summary": "Audit track for assessing AI management systems against ISO/IEC 42001.",
            "price_usd": 0,
            "price_label": "Price varies by training partner",
            "price_confidence": "estimated",
            "tooltip_legacy": "ISO/IEC 42001 Lead Auditor | Price varies by training partner",
        },
    ]

    output: List[Dict] = []
    for cert in extras:
        cert_id = unique_id(cert["id"], used_ids)
        cert["id"] = cert_id
        output.append(cert)
    return output


def write_yaml(cert: Dict, path: Path) -> None:
    # keep key order stable for maintainability
    ordered = {
        "id": cert["id"],
        "name": cert["name"],
        "provider": cert["provider"],
        "cert_code": cert["cert_code"],
        "url": cert["url"],
        "domain_area": cert["domain_area"],
        "sub_areas": cert["sub_areas"],
        "tracks": cert["tracks"],
        "level": cert["level"],
        "status": cert["status"],
        "ai_focus": cert["ai_focus"],
        "introduced_year": cert["introduced_year"],
        "last_updated": cert["last_updated"],
        "delivery": cert["delivery"],
        "renewal": cert["renewal"],
        "language": cert["language"],
        "role_groups": cert["role_groups"],
        "roles": cert["roles"],
        "tags": cert["tags"],
        "prerequisites": cert["prerequisites"],
        "description": cert["description"],
        "summary": cert["summary"],
        "price_usd": cert["price_usd"],
        "price_label": cert["price_label"],
        "price_confidence": cert["price_confidence"],
        "tooltip_legacy": cert["tooltip_legacy"],
    }

    text = yaml.safe_dump(ordered, sort_keys=False, allow_unicode=False)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    source_data = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    for old in TARGET_DIR.glob("*.yaml"):
        old.unlink()

    used_ids: set[str] = set()
    certifications = [build_cert(record, used_ids) for record in source_data]
    certifications.extend(build_extra_ai_certs(used_ids))

    filenames: List[str] = []
    for cert in certifications:
        filename = f"{cert['id']}.yaml"
        write_yaml(cert, TARGET_DIR / filename)
        filenames.append(filename)

    index = {
        "catalog": "TheCyberCert - Security Certification Roadmap",
        "version": "2026.03",
        "last_reviewed": TODAY,
        "schema": "v2",
        "domains": DOMAIN_LAYOUT,
        "sub_areas": SUBAREA_LAYOUT,
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
        "certifications": sorted(filenames),
    }

    INDEX_FILE.write_text(yaml.safe_dump(index, sort_keys=False, allow_unicode=False), encoding="utf-8")
    print(f"Imported {len(certifications)} certifications into {TARGET_DIR}")


if __name__ == "__main__":
    main()
