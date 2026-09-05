# Critical Security & Compliance Protocol for B2B iGaming Systems

The following non-negotiable security mandates MUST be strictly enforced across all code generation, scripts, configuration files, test suites, and documentation:

## 1. Zero Hardcoded Secrets
- Never hardcode any real or sensitive API keys, private keys, database passwords, JWT secrets, webhook tokens, HMAC credentials, or personal identifiers into source code, test scripts, or documentation.
- Never commit actual production credentials or sensitive keys to version control.

## 2. Mandatory Environment Variable Usage
- Always access sensitive configuration via environment variables:
  - Node.js / TypeScript: `process.env.<VARIABLE_NAME>`
  - Python: `os.getenv("<VARIABLE_NAME>")`
  - Shell / CI: `${VARIABLE_NAME}`
- In documentation and `.env.example` templates, use explicit, non-real placeholders (e.g., `YOUR_API_KEY_HERE`, `YOUR_JWT_SECRET_HERE`, `DB_PASSWORD`).

## 3. Sanitized Examples & Mock Stubs
- All code snippets, mock datasets, integration test suites, and configuration templates must strictly contain dummy values, mock IDs (e.g., `USR_MOCK_123`, `OP_TEST_PARTNER`), or randomized test vectors.
- Ensure automated test scripts dynamically generate test IDs or load mock keys from environment variables rather than hardcoding static secrets.

## 4. Immediate Redaction & Masking
- If any user prompt, external payload, or error log contains a real API key, credential, or sensitive token, it must be masked or redacted (e.g., `sk_live_...[REDACTED]`) and never echoed back or persisted.
