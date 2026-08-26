# AGENTS.md - Project Engineering & Security Guidelines

## 1. Privacy & Security Constraints
- Strictly prohibit recording, capturing, storing, or transmitting personal identifying information (PII), client/server IP addresses, MAC addresses, machine IDs, hardware identifiers, personal emails, or usernames.
- Strip all local environment paths, system metadata, and hardware/network fingerprints.
- Ensure all logging mechanisms are anonymized, sanitized, and scrubbed of infrastructure or personal identifiers.
- Hardware & network decoupling: No hardcoded connection strings, local IP defaults, domain ownership records, or server telemetry.

## 2. Attribution & Signature Neutralization
- Exclude all watermarks, branding credits, author tags, AI generation disclosures, or metadata disclaimers.
- Avoid stereotypical AI disclaimers, generic introductory fluff, and marketing hype.

## 3. Code & Documentation Standards
- Write all technical documentation (`README.md`, specs, API docs) in a clean, senior principal engineer tone.
- Code stylometry: Follow standard, industry-neutral idiomatic TypeScript/Node/React design patterns.
- Ensure 100% production readiness, high-performance execution, and comprehensive test coverage.
