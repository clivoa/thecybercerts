# YAML Schema (v2)

Each certification lives in its own file under `data/certifications/`.

Required fields:

- `id` (string, unique, matches filename)
- `name` (string)
- `provider` (string)
- `cert_code` (string)
- `url` (string)
- `domain_area` (string)
- `sub_areas` (list of strings)
- `tracks` (list of strings)
- `level` (`foundational|intermediate|advanced|expert`)
- `status` (`active|beta|retired`)
- `ai_focus` (boolean)
- `introduced_year` (integer)
- `last_updated` (string, `YYYY-MM-DD`)
- `delivery` (string)
- `renewal` (string)
- `language` (string)
- `role_groups` (list from: `Network|Asset|Engineer|Management|Testing|Software|Blue Team Ops|Red Team Ops|IAM`)
- `roles` (list of strings)
- `tags` (list of strings)
- `prerequisites` (list of strings)
- `description` (string)
- `summary` (string, currently mirrors description)
- `price_usd` (integer, use `0` when no stable numeric value is available)
- `price_label` (string, always required)
- `price_confidence` (`from-original-tooltip|estimated`)
- `tooltip_legacy` (string)

## Semantic Quality Gates

`scripts/validate_catalog.py` enforces additional semantic checks:

- `url` must start with `http://` or `https://`
- `last_updated` must be a valid calendar date in `YYYY-MM-DD`
- `domain_area` and `sub_areas` must be compatible with the domain model
- `price_usd` and `price_label` must be coherent
- `tooltip_legacy` must include the certification name

## Example

```yaml
id: osee
name: OSEE
provider: OffSec
cert_code: OSEE
url: https://www.offensive-security.com/awe-osee/
domain_area: Security Operations
sub_areas:
  - Exploitation
tracks:
  - exploitation
  - security-operations
level: expert
status: active
ai_focus: false
introduced_year: 0
last_updated: '2026-02-27'
delivery: lab
renewal: See provider policy
language: en
role_groups:
  - Red Team Ops
roles:
  - exploit-developer
  - soc-analyst
tags:
  - exploit
  - redops
prerequisites:
  - See provider requirements
description: Offensive Security Exploitation Expert
summary: Offensive Security Exploitation Expert
price_usd: 5000
price_label: "$5,000 lab | Plus travel"
price_confidence: from-original-tooltip
tooltip_legacy: Offensive Security Exploitation Expert | $5,000 lab | Plus travel
```
