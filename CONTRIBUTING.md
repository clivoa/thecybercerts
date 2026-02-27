# Contributing

Thank you for contributing to TheCyberCerts (Security Certification Roadmap).

Project website: `https://thecybercerts.com`

## Scope

Contributions are welcome for:

- Certification metadata updates
- New certifications (including AI/security tracks)
- UI/UX improvements
- Search/filter enhancements
- Documentation fixes

## Before You Start

1. Fork the repository and create a feature branch.
2. Keep changes focused (single topic per pull request).
3. Do not include unrelated formatting-only changes.

## Data Contributions

Certification entries live in `data/certifications/*.yaml`.

Requirements:

- Follow `docs/schema.md` exactly.
- Keep `id` equal to the filename.
- Use clear `description` and consistent `price_label`.
- Populate `role_groups` with valid values only:
  - `Network`, `Asset`, `Engineer`, `Management`, `Testing`, `Software`, `Blue Team Ops`, `Red Team Ops`, `IAM`

## Local Validation

Run these commands before opening a PR:

```bash
python3 scripts/rebuild_index.py
python3 scripts/validate_catalog.py
```

If you changed import logic:

```bash
python3 scripts/import_from_original.py
python3 scripts/rebuild_index.py
python3 scripts/validate_catalog.py
```

## Local Preview

Static preview:

```bash
python3 -m http.server 8080
```

Jekyll preview:

```bash
bundle install
bundle exec jekyll serve
```

## Pull Request Guidelines

- Describe what changed and why.
- List any assumptions made (especially for prices and status values).
- Include screenshots/GIFs for UI changes.
- Mention commands used for validation.

## Attribution and Licensing

By contributing, you agree your contributions are licensed under this repository's license.
Because this project derives from SecCertRoadmap content, contributions are distributed under CC BY-SA 4.0 terms.
