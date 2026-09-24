# Security Policy

## Responsible use

OSINT Portal ships reconnaissance tooling. It is intended for **ethical
use only**:

- Authorized security assessments (you own the assets or have written
  permission to test them).
- Transparency research and verification of publicly available information.
- Defensive security engineering and education.

Do not use this project for harassment, stalking, doxxing, exfiltration, or any
activity that violates local law or a target's terms of service.

## Platform safeguards

- **Shell-metacharacter rejection.** The executor seam blocks arguments
  containing `/[;&|`$<>(){}\n\r]/` before any process spawning exists.
- **Id validation.** Tool ids must match `/^[a-z0-9-_.]+$/i`.
- **Dynamic APIs.** Route handlers are `force-dynamic`; nothing is prerendered
  with runtime data.
- **Planned hardening** (lands with the first real segments):
  - explicit target allow-lists (owned/authorized CIDRs and domains) via `.env`,
  - per-tool timeouts and output-size caps,
  - argument allow-lists (allow, not block) per tool,
  - structured, auditable run logs.

## Reporting a vulnerability

Please do not open a public issue for security findings. Contact the
maintainer privately via GitHub: **[arcnosixta](https://github.com/arcnosixta)**
— use the "Report a vulnerability" flow on the repository, or open a private
advisory in the repo's **Security** tab.

We aim to acknowledge reports within 72 hours and ship a fix or mitigation
before public disclosure.