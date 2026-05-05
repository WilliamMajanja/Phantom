# PHANTOM Policies

## Runtime Policy

PHANTOM is a Minima-PiNet-Os DApp. Production operation requires Raspberry Pi edge hardware, local Ollama, and Minima MDS/MiniHub for RNPE-2 provenance actions. Features that depend on unavailable local services must report the failure instead of simulating success.

## AI Policy

Ghost Bridge uses the configured local Ollama endpoint for pattern generation. Cloud AI fallback and deterministic pattern simulation are not part of the supported runtime. Operators are responsible for reviewing generated patterns before export, broadcast, or provenance registration.

## Provenance Policy

RNPE-2 is the supported provenance and peer-exchange profile. Session anchoring and asset registration must include the cryptographic session hash plus its RMP root, must run through Minima MDS, and must fail closed if the chain interface is unavailable.

## Data Handling Policy

PHANTOM should minimize retained operator data. Environment variables, API endpoints, device addresses, and node identifiers must not be logged beyond what is required for local diagnostics. Exported samples, MIDI files, and manifests remain under the operator's control.

## Hardware and Radio Policy

GPIO, FM RDS, LoRa, NPU, and audio-device integrations are intended for lawful local operation on owned or authorized hardware. Operators must comply with applicable radio spectrum, privacy, and safety rules before enabling broadcast or mesh features.

## Dependency Policy

Use the committed package lock for Node dependencies. New runtime dependencies should be added only when necessary, reviewed for known vulnerabilities, and validated with the existing lint and build scripts.

## Contribution Policy

Changes should keep the supported Express/Vite DApp path focused and avoid reintroducing unused legacy application stacks. Pull requests should document changes to runtime behavior, provenance semantics, security posture, or operator policies.
