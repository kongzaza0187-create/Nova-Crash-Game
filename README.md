# SKY RUSH — Tactical Multiplier Crash Game
### Core Developer Documentation & Production Handoff Manual

Welcome to the **SKY RUSH** developer guide. This document serves as a comprehensive handoff manual for the incoming development team tasked with launching, maintaining, or expanding this secure real-time crash multiplier ecosystem.

---

## 1. Project Overview

**SKY RUSH** is an immersive, high-integrity tactical crash-style wagering simulator. Players place bets, watch a flight vector ascend with an exponential multi-color multiplier, and must cash out before the rocket crashes.

### Tech Stack
*   **Frontend SPA / Client Layer**: React 18, TypeScript, Tailwind CSS, HTML5 Canvas API (custom rendering loops with physics simulation and double-buffering), and synthetic procedural web audio synthesis for audio telemetry.
*   **Backend Server Layer & Gateways**: Node.js/TypeScript with Express. Handles static SPA hosting in production and integrates Vite middlewares in development.
*   **Security Architecture**: Custom HTTP security headers, parameterized query parsing, cryptographic PBKDF2 user credential protectors (simulating 12 bcrypt cost factor rounds), server-side game integrity verification engines (Provably Fair round commitments with SHA-256), client-side keyboard/system event interceptors, memory-isolated connection pools, and secure JWT-based stateless authorization with token blacklisting.

### File Structure & Architecture
```bash
├── .env.example              # Blueprint template for local & environment variables
├── .gitignore                # Production ignored paths (node_modules, compilation outputs)
├── components.json           # Optional component bindings
├── index.html                # Main entry point with robust client inspection protection script
├── metadata.json             # AI Studio platform definition and integration configurations
├── package-lock.json         # Lockfile for precise package version reproducibility
├── package.json              # App dependencies, bundlers, compilers, and lifecycle run scripts
├── server.ts                 # Fullstack Node/Express engine implementing multi-layered security & endpoints
├── tsconfig.json             # TypeScript compiler settings for absolute strict safety imports
├── vite.config.ts            # Vite client bundler configurations
└── src                       # Frontend Application Source Code
    ├── main.tsx              # React mounting root
    ├── App.tsx               # Primary interface orchestrating views, modals, and the HUD
    ├── audio.ts              # Procedural audio generator system synthesizing engine noises and alerts
    ├── index.css             # Tailwind compiler CSS mappings
    ├── types.ts              # System-wide static interfaces, wagers, and transaction contracts
    ├── components            # Reusable React display subsystems
    │   └── GameCanvas.tsx    # High-performance HTML5 canvas engine rendering the game environment
    └── lib                   # Visual utility helpers
        └── utils.ts
```

---

## 2. Installation Steps

### Prerequisites
Before constructing the build environment, ensure your developer workstation is backed by:
*   **Node.js**: v18.0.0 (or greater LTS release recommended)
*   **npm**: v9.0.0 (or greater)

### Step-by-Step Setup
1.  **Clone / Unzip the Repository**:
    Extract all files into a clean workspace directory.
    
2.  **Initialize Node Modules**:
    Run standard dependency installers to resolve package mappings:
    ```bash
    npm install
    ```
    
3.  **Prepare the Local Environment**:
    Create a local `.env` configuration file by duplicating the existing blueprint template:
    ```bash
    cp .env.example .env
    ```

---

## 3. Environment Variables

The application queries internal parameters from the host environment to guarantee clean, custom, and secure runtimes. Declare these variables inside your `.env` file prior to boot:

```env
# Port the node container listens to externally (standard reverse-proxy maps to 3000)
PORT=3000

# Server Node execution setting ('development' activates Vite live-reload, use 'production' to freeze assets)
NODE_ENV=development

# Base canonical URL matching public domain references
APP_URL=https://localhost:3000

# High-entropy salt used to sign, verify, and validate symmetric bearer tokens.
# IN PRODUCTION: Use a secure cryptographically random generator (do NOT leave blank).
JWT_SECRET=f9a8b7c6d5e4f3a2b1c09876543210fedcba9876543210abcdef
```

---

## 4. How to Run

Three critical run cycles govern the client-server lifecycle. These can be executed directly through the npm terminal:

### A. Development Mode
Launches the full-stack server instance concurrently wrapping the client assets under Vite's live reload middleware:
```bash
npm run dev
```

### B. Production Compression & Building
Compiles and staticizes the React frontend client into the `dist/` workspace folder using sequential client-code pruning. Simultaneously bundles the backend Node TypeScript `server.ts` into a standalone, optimized ES5 module representation in CommonJS format, completely isolating ES module-path friction points:
```bash
npm run build
```

### C. Live Server Production Launch
Starts the compiled, production-grade, self-contained server script:
```bash
npm run start
```

---

## 5. API Endpoints Documentation

All custom data, logging, and security handshakes are piped via the `/api/` prefix.

### 1. Account Authentication Gateway
*   **Method**: `POST`
*   **Route**: `/api/security/login`
*   **Headers**: `Content-Type: application/json`
*   **Request Payload**:
    ```json
    {
      "username": "admin",
      "password": "SecureAdminPass1!_$"
    }
    ```
*   **Successful Response (200 OK)**:
    ```json
    {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImlzUmVm...",
      "expiresIn": 86400,
      "user": {
        "userId": "usr_admin",
        "username": "admin",
        "balance": 2500000.00
      }
    }
    ```
*   **Error Response (401 Unauthorized)**:
    ```json
    { "error": "Access key validation failed." }
    ```

### 2. Session Revocation / Logout
*   **Method**: `POST`
*   **Route**: `/api/security/logout`
*   **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
*   **Successful Response (200 OK)**:
    ```json
    { "message": "Security token blacklisted. Logout finalized." }
    ```

### 3. Initialize Provably Fair Game Round
*   **Method**: `POST`
*   **Route**: `/api/security/round/start`
*   **Headers**: `None`
*   **Successful Response (200 OK)**:
    ```json
    {
      "roundId": "rnd_a3b2c1d0-e9f8...",
      "fairHash": "7f83b1c62908f9aef...",
      "active": true,
      "hint": "Valid server hash generated. Salt precommitted."
    }
    ```
    *Note: The actual crashPoint value is locked and hidden server-side inside the memory model; only the precommitted double-salted SHA-256 commitment hash is published to confirm game fairness before flight start.*

### 4. Register Gameplay Wager
*   **Method**: `POST`
*   **Route**: `/api/security/bet`
*   **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`, `Content-Type: application/json`
*   **Request Payload**:
    ```json
    {
      "betAmount": 500
    }
    ```
*   **Successful Response (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Security deposit and gameplay wager validated and registered on server."
    }
    ```

### 5. Settle Symmetrical Flight Cashout
*   **Method**: `POST`
*   **Route**: `/api/security/cashout`
*   **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`, `Content-Type: application/json`
*   **Request Payload**:
    ```json
    {
      "targetMultiplier": 2.45
    }
    ```
*   **Successful Response (200 OK)**:
    ```json
    {
      "success": true,
      "payout": 1225.00,
      "message": "Server validated receipt and transaction settled securely."
    }
    ```

### 6. Security Diagnostics & Health Report
*   **Method**: `GET`
*   **Route**: `/api/security/health`
*   **Successful Response (200 OK)**:
    ```json
    {
      "status": "active",
      "securityMetrics": {
        "poolActive": 0,
        "jwtSecretActive": true,
        "provablyFairHashActive": true,
        "activeViolationsBlocked": 0
      }
    }
    ```

### 7. Security Audit Trails (Telemetry Logs)
*   **Method**: `GET`
*   **Route**: `/api/security/logs`
*   **Successful Response (200 OK)**:
    ```json
    {
      "totalLogsTracked": 142,
      "logs": [
        {
          "id": "log_8b7c6d5e...",
          "type": "BET_VALIDATED_OK",
          "ip": "127.0.0.1",
          "userId": "usr_admin",
          "timestamp": "2026-05-30T08:15:21Z",
          "details": "Validated state of wager correctly: 500 THB"
        }
      ]
    }
    ```

---

## 6. Security Notes for Developers

Security is deeply integrated on both the server-side and client-side layers of this application.

### Multi-layered Protection Specifications
1.  **Strict Security Headers**: The server enforces state-of-the-art integrity protection headers:
    *   `X-Content-Type-Options: nosniff` (Defeats MIME-type sniffing)
    *   `X-Frame-Options: DENY` (Prohibits Clickjacking attacks inside third-party frames)
    *   `X-XSS-Protection: 1; mode=block` (Blocks Cross-Site Scripting parsing)
    *   `Strict-Transport-Security` (Guarantees local HTTPS redirection policies)
    *   `Content-Security-Policy` (Restricts execution contexts to fully validated resources)
    *   `Referrer-Policy: no-referrer` (Prevents credential leakage through external links)

2.  **Strict Threat Limit Enforcement (Rate Limiters)**:
    *   **Global Request Limiter**: Prevents denial of service by rejecting clients exceeding **100 global API/asset requests per minute per IP address**.
    *   **Login Protection Gate**: Slows down brute-force entry attempts with a limit of **5 credential logins per minute per IP address**.
    *   **Anti-Wager Flooding System**: Restricts betting concurrency to **10 wagers per minute per unique user ID**.
    *   **Automated IP Sentry**: Clients exceeding rate-limits 3 consecutive times receive a hard IP block and are completely rejected with `status 403 (Forbidden)`.

3.  **Client Inspections Blockers**:
    The main client HTML entry page contains embedded active event listeners that block reverse engineering shortcut attempts silently, including F12, developer panel command keys (`Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`), source viewing (`Ctrl+U`), and standard right-click context menu displays.

4.  **Database Shielding**:
    All storage transactions are simulation-pooled to limit connections strictly to **10 parallel channels**, logging database errors without exposing details to the client. Inputs are strictly parsed for SQL injection characters and HTML template keywords to neutralize malicious payload attempts.

---

## 7. Developer Handoff Notes

### Completed & Configured Features (Ready to Deploy)
*   **Dynamic Visual HUD Engine**: Fully functional HTML5 Canvas render loop in `/src/components/GameCanvas.tsx`. Implements progressive real-time scaling and **color-changing multipliers** mirroring values dynamically (from Lime Green for safety to Magenta, Purple, and vibrating White Neon Glows for high ranges).
*   **Double-Column Slash Screen**: Fluid responsive landing/loading overlay that splits into an elegant visual image container (contain/containment) on the left (80% viewport) and a stylized vertical status monitor on the right (20% viewport) with bottom-to-top glowing loading fills.
*   **Sound FX System**: Fully integrated Web Audio oscillators in `/src/audio.ts` providing game sounds dynamically without lagging external file loads.

### Recommendations for Production Deployment
1.  **Persistent Storage Migration**: The database module (`SecurityProtectedDatabase` in `server.ts`) is currently in-memory. Replace `userRecordsStore` with a real database connector, such as **Cloud Firestore**, PostgreSQL, or Spanner, and bind the query logic to actual database drivers using parameterized placeholders to match the database protective layer layout.
2.  **Environment Hashing Key**: Swap out the automatically generated base64 JWT salt initialization key with a strictly managed environment secret bound in Google Secret Manager or your production container's parameters.
3.  **Winch Integration**: Connect the backend security endpoints (`/api/security/bet`, `/api/security/cashout`, and the registration pipeline) directly into the UI's state triggers to transition the client-side game state from local mock state tracking into an elegant server-validated experience.
