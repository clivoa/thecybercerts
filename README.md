# TheCyberCerts

TheCyberCerts is a modern, searchable, YAML-driven security certification platform and roadmap inspired by the original `SecCertRoadmap`.

Official domain: `https://thecybercerts.com`

## Inspiration

This project was inspired by the original work from Paul Jerimy:

- https://github.com/PaulJerimy/SecCertRoadmap

## Highlights

- Full catalog import from the original project (482 entries) plus modern AI-focused additions
- Current catalog size: **489 certifications**
- Domain chart grouped by security domains and sub-areas
- Dedicated visual **Mind Map** page with expandable domain/sub-area nodes
- **Career Paths Wizard** page (Blue Team, Red Team, GRC, Cloud) by level and budget
- **Compare View** page for side-by-side comparison of 2 to 4 certifications
- Metadata search with key-value syntax and advanced DSL comparators
- Description and price are split into dedicated fields (`description`, `price_label`, `price_usd`)
- Filters for price type, min/max price range, and role category
- Tooltip on chart chips showing certification name + price details
- PWA shell with offline-friendly cache for catalog browsing and mind map

Role category filter values:

- `Network`
- `Asset`
- `Engineer`
- `Management`
- `Testing`
- `Software`
- `Blue Team Ops`
- `Red Team Ops`
- `IAM`

## Domain Model

Primary domains:

- Communication and Network Security
- IAM
- Security Architecture and Engineering
- Asset Security
- Security and Risk Management
- Security Assessment and Testing
- Software Security
- Security Operations

Sub-areas:

- Cloud/SysOps
- *nix
- ICS/IoT
- GRC
- Forensics
- Incident Handling
- Penetration Testing
- Exploitation

## Local Run

```bash
cd <project-directory>
python3 -m http.server 8080
```

Open:

- `http://127.0.0.1:8080/` (Catalog + Domain Chart)
- `http://127.0.0.1:8080/mindmap/` (Mind Map)
- `http://127.0.0.1:8080/wizard/` (Career Paths Wizard)
- `http://127.0.0.1:8080/compare/` (Compare View)

## Jekyll (clean URLs)

This repository now includes a Jekyll config (`_config.yml`) with `permalink: pretty` to favor extensionless routes.

Typical local run (if Ruby/Jekyll is installed):

```bash
bundle exec jekyll serve
```

## Search Syntax

Examples:

- `provider:isaca`
- `domain:security operations`
- `subarea:forensics`
- `rolegroup:"Blue Team Ops"`
- `level:advanced`
- `ai:true`
- `price:<=1000`
- `year:>=2024`
- `provider:giac subarea:exploitation price:500..2000`

Supported keys:

- `provider:`
- `domain:`
- `subarea:`
- `track:`
- `level:`
- `role:`
- `rolegroup:`
- `tag:`
- `code:`
- `ai:`
- `year:`
- `status:`
- `price:`

`price:` supports `paid`, `free`, `unknown`, numeric comparison (`<`, `<=`, `=`, `>=`, `>`), and ranges (`price:300..1200`).

## Project Structure

- `index.html`: main application shell
- `assets/app.js`: catalog loading, filtering, chart and cards rendering
- `mindmap/index.html`: mind map page
- `wizard/index.html`: career wizard page
- `compare/index.html`: compare page
- `assets/styles.css`: responsive UI, chip tooltip styling, chart layout
- `service-worker.js`: runtime + shell caching for offline mode
- `manifest.webmanifest`: PWA manifest
- `data/index.yaml`: catalog index (schema v2)
- `data/certifications/*.yaml`: one certification per file
- `docs/schema.md`: v2 schema documentation
- `scripts/import_from_original.py`: imports and normalizes data from original JSON
- `scripts/rebuild_index.py`: rebuilds `data/index.yaml`
- `scripts/validate_catalog.py`: validates all YAML files against schema requirements

## Data Maintenance

Re-import from original source and regenerate catalog:

```bash
python3 scripts/import_from_original.py
```

Rebuild only the index:

```bash
python3 scripts/rebuild_index.py
```

Validate catalog integrity:

```bash
python3 scripts/validate_catalog.py
```

The validator includes semantic quality gates (domain/sub-area compatibility, URL format, date format, and price field coherence).

## Notes

- Last review date in this version: `2026-02-27`
- `price_usd` may be `0` when provider pages do not publish a stable single exam value
- `price_label` is always present and shown in chart tooltips

## Governance

- Contribution guidelines: `CONTRIBUTING.md`
- License: `LICENSE.md` (CC BY-SA 4.0)
