# Security Policy

## Supported Versions

PHANTOM currently supports the active `main` branch and the latest tagged release. Older releases, forks, prototype branches, and removed legacy code paths are not maintained unless a maintainer explicitly marks them as supported.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| `main` branch | Yes |
| Older releases | No |

## Reporting a Vulnerability

Report suspected vulnerabilities privately through GitHub Security Advisories when available. If advisories are unavailable, contact the repository maintainer with:

- a clear description of the issue,
- affected files or features,
- reproduction steps,
- expected impact, and
- any safe proof-of-concept details.

Do not publish exploit details until a fix is released or maintainers confirm the issue is not exploitable.

## Security Expectations

- Provenance operations must run inside Minima MDS and fail closed when `window.MDS` is unavailable.
- Ghost Bridge generation must use the configured local Ollama node and must not silently create simulated pattern output when the model is unavailable.
- Hardware and radio features must validate operator input before sending commands to local devices.
- Secrets must remain in environment files or host secret stores and must never be committed.
- Dependencies must be installed from the locked package manifest and reviewed for advisories before upgrades.

## Response Process

Maintainers should acknowledge valid reports, triage severity, prepare a minimal fix, and document any required operator action. Security fixes should include validation with the existing lint and build commands.
