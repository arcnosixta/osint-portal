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

- **Target allow-list.** Before any segment runs a process, the target must
  fall inside `OSINT_ALLOWED_TARGETS` (CIDRs, IPs, IPv6, domains). Defaults to
  loopback + private + link-local ranges and `localhost` only — public targets
  require an operator to explicitly allow them.
- **Argument allow-list per tool.** Segments forward only whitelisted flags and
  values. The reference nmap segment rejects unknown flags, output-redirect
  flags (`-oN`/`-oX`), script loading (`--script`), input lists (`-iL`) and
  malformed port/timing specs.
- **Shell-metacharacter rejection.** The executor seam blocks any argument
  containing `/[;&|`$<>(){}\n\r]/` before a segment is invoked.
- **Id validation.** Tool ids must match `/^[a-z0-9-_.]+$/i`.
- **Timeouts & output caps.** Every run enforces a hard timeout
  (`OSINT_RUN_TIMEOUT_MS`, default 20s) and a captured-output ceiling
  (`OSINT_MAX_OUTPUT_BYTES`, default 64KB). Timed-out processes are SIGKILLed.
- **Dynamic APIs.** Route handlers are `force-dynamic`; nothing is prerendered
  with runtime data. Blocked targets respond `403`.
- **Planned hardening** (lands with further segments):
  - explicit per-tool argument schemas beyond the current flag allow-lists,
  - structured, auditable run logs,
  - sandboxed process spawning (seccomp / containers) for untrusted tools.

## Reporting a vulnerability

Please do not open a public issue for security findings. Contact the
maintainer privately via GitHub: **[arcnosixta](https://github.com/arcnosixta)**
— use the "Report a vulnerability" flow on the repository, or open a private
advisory in the repo's **Security** tab.

We aim to acknowledge reports within 72 hours and ship a fix or mitigation
before public disclosure.