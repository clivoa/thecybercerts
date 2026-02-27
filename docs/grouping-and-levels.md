# Certification Grouping and Level Guide

This document explains how certifications are grouped in TheCyberCerts and what each skill level means.

## Grouping Model

Each certification can be categorized across multiple dimensions at the same time:

- `domain_area`: primary security domain
- `sub_areas`: optional specialization under the domain
- `role_groups`: job-oriented grouping (team/function perspective)
- `tracks`: keyword-style learning path tags (search/navigation support)
- `level`: skill depth (`foundational`, `intermediate`, `advanced`, `expert`)

The grouping is multi-label by design. A certification can belong to multiple `sub_areas`, `role_groups`, and `tracks`.

## Domain Areas

Primary domain list:

- Communication and Network Security
- IAM
- Security Architecture and Engineering
- Asset Security
- Security and Risk Management
- Security Assessment and Testing
- Software Security
- Security Operations

### Domain to Sub-area Mapping

Allowed sub-areas by domain:

- Communication and Network Security: none
- IAM: none
- Security Architecture and Engineering:
  - Cloud/SysOps
  - *nix
  - ICS/IoT
- Asset Security: none
- Security and Risk Management:
  - GRC
- Security Assessment and Testing: none
- Software Security: none
- Security Operations:
  - Forensics
  - Incident Handling
  - Penetration Testing
  - Exploitation

## Sub-areas

Sub-areas represent deeper specialization slices:

- `Cloud/SysOps`: cloud platform security and operations-oriented administration
- `*nix`: Linux/Unix hardening, administration, and security operations
- `ICS/IoT`: industrial systems, OT, and embedded/IoT environments
- `GRC`: governance, risk, compliance, and assurance
- `Forensics`: digital evidence collection, triage, and analysis
- `Incident Handling`: detection-to-response lifecycle and operational response
- `Penetration Testing`: offensive assessment and adversary simulation
- `Exploitation`: exploit development and advanced offensive engineering

## Role Groups

Role groups support filtering by operational function:

- `Network`: network/security infrastructure roles
- `Asset`: asset ownership, protection, and lifecycle governance
- `Engineer`: architecture, implementation, and platform engineering
- `Management`: leadership, governance, and strategic decision roles
- `Testing`: assessment, audit, validation, and verification roles
- `Software`: secure software engineering and AppSec roles
- `Blue Team Ops`: defensive operations (SOC/DFIR/detection)
- `Red Team Ops`: offensive operations (PT/adversary emulation/exploitation)
- `IAM`: identity and access management specialization

## Level Definitions

### Foundational

Entry level. Focuses on core concepts, terminology, and baseline workflows.

Typical profile:

- 0 to 1 years of security experience
- beginner-to-junior role readiness
- concept-heavy content with practical basics

### Intermediate

Applied level. Requires working knowledge and operational context.

Typical profile:

- 1 to 3 years of relevant experience
- can execute standard tasks with limited supervision
- combines theory, tooling, and real-world scenarios

### Advanced

Deep practitioner level. Emphasizes complex environments and decision-making.

Typical profile:

- 3 to 5+ years of relevant experience
- handles design/troubleshooting in complex cases
- often includes hands-on labs, case analysis, or multi-domain reasoning

### Expert

Specialist/master level. Targets high-complexity implementation or strategy.

Typical profile:

- 5+ years of strong domain experience
- leads architecture/program direction or advanced offensive/defensive execution
- expects broad context, depth, and high autonomy

## Notes About Level Interpretation

- Level indicates expected depth and complexity, not absolute professional value.
- Equivalent levels can vary by provider exam style and prerequisites.
- Some certifications are domain-specialized and may feel harder than their level label suggests.

## Quality Gate Alignment

The validator enforces consistency between grouping fields and schema expectations.

See:

- `scripts/validate_catalog.py`
- `docs/schema.md`
