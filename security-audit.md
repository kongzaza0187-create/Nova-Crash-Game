# SKY RUSH — SECURITY AUDIT SCHEMATIC & PROTOCOL MANUAL
### Multi-Layer Security Architecture for Tactical Multiplier Engine

This document provides administrative and architectural instructions defining the defensive fortifications, encryption constraints, firewall restrictions, token lifetimes, DDoS protection policies, and automated auditing procedures established for the **SKY RUSH** platform.

---

## 1. FIREWALL & NETWORK CONTROLS

The network configuration enforces positive, locked-down outer boundaries:

| Parameter | Configuration Specification | Target / Bound |
| :--- | :--- | :--- |
| **Port White List** | Allow Port `80` (HTTP Redirection) and Port `443` (HTTPS TLS). | Block all other ports by default. |
| **Admin IP Range** | Strict CIDR whitelist restricting route access to authorized staff IPs. | Administrative Dashboard Routes only. |
| **Malicious IP Ranges**| Automatic IP threat intelligence feeds blocked at Cloud Armor level. | Universal protection boundary. |
| **Standard Rate Limit** | Maximum **1,000 requests per hour** per unique IP address. | General traffic protection layer. |

---

## 2. ADVANCED TOKEN SECURITY (JWT PROFILES)

To protect accounts and user state, asymmetric tokens govern authorization cycles:

1.  **Production Cryptographic Algorithm**: Symmetric keys are upgraded to **RS256** (RSA Signature with SHA-256) utilizing split public/private key pairs.
2.  **Access Token Expiry**: Strictly capped at **15 minutes** to minimize compromised token lifetimes.
3.  **Refresh Token Expiry**: Capped at **7 days** maximum.
4.  **Token Rotation (RTR)**: Refresh tokens are rotated on every use. Consuming an old refresh token instantly invalidates the entire child key hierarchy, triggering automated alerts.
5.  **Revocation Trigger**: All active sessions and tokens are instantly blacklisted upon password modification.
6.  **Blacklist Store**: Revoked session IDs and signatures are distributed to a high-speed, in-memory **Redis Cache Cluster** with automatic TTL pruning.
7.  **Admin Key Separation**: Administrative tokens are signed using a distinct, separate high-entropy RSA key pair completely decoupled from player-facing login scopes.

---

## 3. DATA ENCRYPTION STANDARDS

All assets are secured in-transit and at-rest using high-grade cryptographic standards:

*   **Data In Transit**: Mandatory **TLS 1.3** minimum. Any secure socket negotiation below TLS 1.2 is dropped immediately.
*   **Data At Rest**: **AES-256** encryption across all transactional ledger partitions, database files, and system volumes.
*   **Password Hashing**: Stored using the memory-hard, GPU-resistant **Argon2id** algorithm:
    *   *Parameters*: Limit memory: 64MB, Iterations: 4, Parallelism: 4 threads.
*   **Provably Fair Hash Commitment**: Round seeds are hidden and precommitted utilizing **SHA-256** digests.
*   **Backup Security**: Database snapshots are doubly encrypted utilizing a disjoint split recovery key stored in an air-gapped key management system.

---

## 4. MULTI-LAYER DDOS MITIGATION

Protection layers trigger auto-mitigations across distinct request shapes:

### Traffic Flood Thresholds
*   **Connection Limits**: High-performance socket limits restrict active connections per IP address.
*   **SYN Flood Protection**: SynCookies activated at standard kernel level to prevent state pool exhaustion.
*   **UDP Flood Protection**: Dropping non-essential UDP transport ports directly at edge proxies.
*   **HTTP GET/POST Flood Sentry**: Block clients exceeding a burst threshold of **100 requests per second** per IP address.
*   **Automated IP Sentry**: Heavy offenders are temporarily banned across proxy filters.
*   **DDoS Level Alarm**: Trigger immediate operations response upon detecting traffic spikes exceeding **10,000 requests per second** stemming from a single localized host range.

---

## 5. MONITORING, ALERT TELEMETRIES & DEPLOYMENT POLICIES

Sentry alerts are published instantly via synchronized integrations (SMTP Email channels + secure Slack webhooks):

1.  **Authentication Floods**: Alert when failed login attempts exceed **10 per minute** from a single IP range.
2.  **Traffic Volumetric Alert**: Trigger immediate warnings on volumetric traffic spikes exceeding **200% of normal rolling averages**.
3.  **Persistence Layer Failure**: Real-time high-priority notifications on database cluster connection dropouts or transactional failures.
4.  **JWT Integrity Alarms**: Instantly alert when a cluster of cryptographic signature validation errors are registered within a short burst window.
5.  **Host CPU Abuse**: Alert if global CPU usage averages hit **>90% for a continuous 5-minute period**.

---

## 6. PRODUCTION CHECKLIST

Before deploying the SKY RUSH environment, verify every system checks out:

- [ ] **SSL / TLS Certificate Configuration**
  Valid, auto-renewing TLS certificate issued by a trusted CA with strict HSTS (HTTP Strict Transport Security) active.
- [ ] **Symmetric Key Declassification**
  All local mock keys (e.g. JWT_SECRET default values) have been rotated with randomized cryptographically secure values.
- [ ] **Strict Endpoint Authentication Rules**
  All API routing pathways (excluding public indices and log-ins) are guarded with authenticated token checkers.
- [ ] **Input Cleansing (No Query Injection or Cross-Site Scripting)**
  Raw request bodies, queries, and URL params are thoroughly sanitised against SQL and script-injection blocks.
- [ ] **Strict CORS Policy Protection**
  Cross-Origin Resource Sharing rules are bound to whitelisted source origins, prohibiting arbitrary script sources.
- [ ] **PII and Database Secrets Sanitization**
  Sensitive user hashes or API keys are stripped and missing from developer logs.
- [ ] **Dependency Scan Inspection**
  NPM audit checks completed with zero CVE indicators.
- [ ] **Verified Provably Fair Commitments**
  Confirm salt-hashing triggers before game flight runs.
- [ ] **Admin Route Decoupling**
  The administration routing pathways are fully locked down behind distinct RS256 token verifications.
- [ ] **System Stress Audit Complete**
  The cloud architecture has been tested under simulated heavy traffic scenarios.
