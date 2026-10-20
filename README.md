# VTG MilkSetu — Dairy Milk Collection

*Dairy ka hisaab, ab aasaan.*

A dairy milk collection system: a Hindi-first Android app for dairy owners, a
Node/Express + MongoDB backend that owns all business logic, and a Next.js
admin panel.

```
DAIRY/
  VTGMilkSetu/   React Native CLI app (TypeScript, Android-first)
  backend/       Express + MongoDB + TypeScript REST API
  admin/         Next.js admin panel
  image/         Reference design image
```

---

## 1. Prerequisites (Windows)

| Tool | Version | Notes |
|---|---|---|
| Node.js | >= 22.11 | `node -v` |
| MongoDB | 6 or 7 | Local service or Atlas |
| JDK | 17 | Required by React Native 0.87 |
| Android SDK | API 35 | Android Studio, or cmdline-tools |
| Android NDK | as installed | Needed for the New Architecture build |

Set these environment variables:

```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Microsoft\jdk-17.x.x
```

Verify MongoDB is running:

```powershell
Get-Service MongoDB
Test-NetConnection 127.0.0.1 -Port 27017
```

---

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and set a real `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/vtgmilksetu`, or your Atlas SRV string |
| `DB_NAME` | Database name, when the URI has none in its path (Atlas strings often stop at the host). Leave blank if the URI already ends in `/<db>` |
| `JWT_SECRET` | Signs admin tokens. **Required** — the server refuses to start without it |
| `SESSION_TTL_DAYS` | Dairy session lifetime (default 180) |
| `CORS_ORIGINS` | Comma-separated browser origins, e.g. `http://localhost:3000` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Used **only** by the seed command |

Create the first admin (there is deliberately no public admin signup):

```bash
npm run seed:admin
```

Run it:

```bash
npm run dev     # development, auto-reload on http://localhost:4000
npm run build && npm start   # production
```

### MongoDB Atlas instead of local

1. Create a free cluster at <https://cloud.mongodb.com>.
2. Database Access → add a user.
3. Network Access → allow your IP.
4. Put the SRV string in `MONGODB_URI`:
   `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/vtgmilksetu?retryWrites=true&w=majority`

> **The database name goes before the `?`.** Writing
> `...mongodb.net?retryWrites=true&w=majority/Dairy` silently connects to the
> default `test` database — `/Dairy` is parsed as part of the `w` value, not as
> a database. If your string ends at the host, set `DB_NAME=Dairy` instead and
> leave the URI alone. On startup the server logs the database it actually
> opened: `[db] connected: Dairy`.

---

## 3. Mobile app

```bash
cd VTGMilkSetu
npm install
npm start           # Metro, terminal 1
npm run android     # build + install, terminal 2
```

### Pointing the app at your backend

`src/api/config.ts` resolves the dev host automatically:

- **Emulator** → `10.0.2.2:4000` (the host's loopback as seen from the emulator)
- **Physical device** → reuses the Metro host IP, so it works over Wi-Fi

For a physical device, both the phone and PC must be on the same network, and
Windows Firewall must allow inbound TCP 4000:

```powershell
New-NetFirewallRule -DisplayName "VTG backend 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
```

For production, set the real HTTPS URL in `API_BASE_URL` in that same file.

### Debug APK

```bash
cd VTGMilkSetu/android
./gradlew assembleDebug
```

> **Windows path-length note.** CMake/ninja object paths for React Native's
> codegen exceed the 260-character limit under a deep project folder. This repo
> redirects the native build output to a short root via `vtgNativeBuildDir` in
> `android/gradle.properties`. The APK therefore lands at:
>
> `C:/rnbuild/vtgmilksetu/app/outputs/apk/debug/app-debug.apk`
>
> To restore the default location, delete the `vtgNativeBuildDir` property —
> but the build will then fail unless the project sits near the drive root.

Build only your device's ABI to save several minutes:

```bash
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Install it:

```bash
adb install -r C:/rnbuild/vtgmilksetu/app/outputs/apk/debug/app-debug.apk
```

### Release APK

```bash
cd VTGMilkSetu/android
./gradlew assembleRelease
```

Signing is not configured; the release build uses the debug keystore. Create a
real keystore and wire it into `android/app/build.gradle` before publishing.

### Illustrations

The app ships 1×1 transparent placeholders and draws themed SVG fallbacks in
their place. To use real artwork, overwrite these files and rebuild — nothing
else to change:

```
VTGMilkSetu/src/assets/
  hero.png      1200x700   farmer + buffalo + cow + milk can
  buffalo.png    600x420   buffalo portrait
  cow.png        600x420   cow portrait
  morning.png    800x420   sunrise over village
  evening.png    800x420   moonlit village
  success.png    500x500   checkmark / celebration
```

---

## 4. Deploying (backend + admin as ONE service)

In production a single Node process serves both: the API at `/api` and the
admin panel at `/admin`. One URL, one deploy, and no CORS between them.

Locally you still run them separately (`npm run dev` in each) so Next keeps
fast refresh. `SERVE_ADMIN` controls which mode you get — it defaults to
`true` in production and `false` in development.

### Build and run the combined server locally

```bash
npm run install:all        # installs backend/ and admin/
npm run build              # builds the admin panel, then compiles the API
npm start                  # one server on :4000
```

Then: API at <http://localhost:4000/api/health>, panel at
<http://localhost:4000/admin>.

### Deploy to Render

The repo includes `render.yaml`, so Render can configure the service itself:

1. Push this repo to GitHub.
2. Render → **New** → **Blueprint** → pick the repo. It reads `render.yaml`.
3. Fill in the secrets it marks as required:

   | Variable | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas SRV string |
   | `DB_NAME` | `Dairy` (only if the URI has no `/db` in its path) |
   | `CORS_ORIGINS` | your service URL, e.g. `https://vtgmilksetu.onrender.com` |
   | `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | for the one-time admin seed |

   `JWT_SECRET` is generated by Render. `PORT` is injected automatically —
   do not set it.

4. In MongoDB Atlas → **Network Access**, allow Render's egress IPs, or
   `0.0.0.0/0` if you accept any-IP access with password auth.
5. After the first deploy, open Render's **Shell** and seed the admin once:

   ```bash
   npm run seed:admin
   ```

Railway works the same way — set the build command to
`npm run install:all && npm run build`, the start command to `npm start`, and
add the same variables.

### After deploying

Point the mobile app at the live API in
`VTGMilkSetu/src/api/config.ts`:

```ts
export const API_BASE_URL = __DEV__
  ? `http://${devHost()}:${DEV_PORT}/api`
  : 'https://your-service.onrender.com/api';   // <- set this
```

Android blocks cleartext HTTP in release builds, so the production URL must
be HTTPS. Render provides that automatically.

> **Free tier:** the service sleeps after inactivity, so the first request
> after a pause takes ~30s to wake. Fine for testing; move to a paid instance
> before real dairies depend on it.

---

## 5. Admin panel

```bash
cd admin
npm install
cp .env.example .env     # API_BASE_URL=http://localhost:4000/api
npm run dev              # http://localhost:3000
```

Sign in with the credentials from `npm run seed:admin`.

The admin token is stored in an **httpOnly cookie**, so client JavaScript can
never read it. Every page re-checks authorization on the server; hiding UI is
not relied on for access control.

---

## 6. API reference

Base URL `http://localhost:4000/api`. All responses are
`{ "ok": true, "data": ... }` or `{ "ok": false, "error": { code, message } }`.

Dairy endpoints take `Authorization: Bearer <session token>`.

### `POST /register`

```json
{ "ownerName": "Ramesh Patil", "mobile": "9876543210",
  "dairyName": "Shree Dairy", "deviceId": "device-abc12345" }
```

→ `201` `{ "token": "…", "dairy": { "id": "…", "rateSettings": {…} } }`
Duplicate mobile → `409 mobile_exists`.

### `POST /session`

Re-enrol a known mobile on a device. `{ "mobile", "deviceId" }` → same shape as
register.

### `GET /me`

Validates the stored token on app launch → `{ "dairy": {…} }`.

### `GET /dashboard`

```json
{ "date": "2026-10-16",
  "dairy": { "dairyName": "Shree Dairy" },
  "today": { "overall": { "litres": 30, "amount": 1500, "entries": 3 },
             "morning": {…}, "evening": {…}, "buffalo": {…}, "cow": {…} },
  "rateSettings": {…}, "recentEntries": […] }
```

### `POST /milk`

```json
{ "entryDate": "2026-10-16", "shift": "morning",
  "milkType": "buffalo", "quantityLitres": 10, "fatPercentage": 5 }
```

The rate and amount are taken from the dairy's saved settings and recomputed
server-side. A client-sent `totalAmount`, `appliedRate` or `dairyId` is ignored.
No rate set → `400 rate_not_set`. Future date → `400 future_date`.

### `GET /milk`

Query: `from`, `to`, `shift`, `milkType`, `page`, `limit` (max 100)
→ `{ items, page, limit, total, totalPages }`

### `GET /rates` · `PUT /rates`

```json
{ "buffalo": { "rateMode": "perFatPoint", "rate": 9 },
  "cow":     { "rateMode": "perLitre",    "rate": 60 } }
```

### `GET /reports`

Query: `from`, `to`, `shift`, `milkType` → the summary block plus a
`daily[]` breakdown. Range is capped at 366 days.

### `GET /reports/pdf`

Same query. Streams `application/pdf`, generated on demand and never stored.

### Admin

| Endpoint | Notes |
|---|---|
| `POST /admin/login` | `{ email, password }` → `{ token }` (JWT, 12h) |
| `GET /admin/dashboard` | Global counts and today's totals |
| `GET /admin/dairies` | `search`, `page`, `limit` |
| `GET /admin/milk` | `dairyId`, `from`, `to`, `shift`, `milkType`, `page`, `limit` |

---

## 7. Business rules

**Two calculation modes, independent per milk type:**

| Mode | Formula | Example |
|---|---|---|
| `perLitre` | litres × rate | 10 × ₹60 = **₹600** (fat ignored) |
| `perFatPoint` | litres × fat × rate | 10 × 5 × ₹9 = **₹450** |

- Every entry stores a **snapshot** of `rateMode` and `appliedRate`. Changing a
  rate later never rewrites historical records.
- The server is the only authority on amounts; the app's live preview is for
  convenience and is recalculated on save.
- Entry dates are stored at UTC midnight of the dairy's **India** calendar day,
  so a day's totals group identically regardless of server timezone.

---

## 8. Data model

| Collection | Key fields | Indexes |
|---|---|---|
| `dairies` | ownerName, mobile (unique), dairyName, status, rateSettings | `mobile` unique, `status` |
| `milkEntries` | dairyId, entryDate, shift, milkType, quantityLitres, fatPercentage, rateMode, appliedRate, totalAmount | `dairyId+entryDate`, `dairyId+entryDate+shift`, `entryDate` |
| `sessions` | dairyId, tokenHash, deviceId, expiresAt, revokedAt | `tokenHash` unique, TTL on `expiresAt` |
| `admins` | email (unique), passwordHash, role, status | `email` unique |
| `auditLogs` | adminId, action, target, meta | `adminId` |

Session tokens are stored only as a SHA-256 hash; the raw token is returned to
the device once and never logged. Admin passwords use bcrypt (cost 12).

---

## 9. Security notes

**The mobile number is not verified.** OTP is disabled by product decision, so
possession of a number is not proof of identity. What is in place:

- Registration and session endpoints are rate-limited (10 per 15 min per IP).
- Sessions are revocable per device and expire after `SESSION_TTL_DAYS`.
- Tokens live in the Android Keystore (`react-native-keychain`), never in
  plain AsyncStorage.
- Dairy identity always comes from the session — a client-supplied `dairyId` is
  never trusted, which is what enforces cross-dairy isolation.
- Helmet, explicit CORS allow-list, 100 kB JSON body cap, global rate limit.

Before production: serve over HTTPS, restrict `CORS_ORIGINS`, move secrets to a
secret manager, and add admin-assisted account recovery.

---

## 10. Testing

```bash
cd backend
npm run test:unit   # money + date logic, no server needed
npm run test        # 60 end-to-end API checks (needs server + MongoDB running)
```

`npm run test` covers registration and duplicate handling, validation,
auth rejection, the rate gate, both calculation modes, rejection of
client-supplied amounts, dashboard aggregation, **cross-dairy isolation**,
rate-change immutability of history, filters and pagination, reports,
report-filter narrowing, entry-level detail rows, admin authorization, and
PDF generation.

Helper scripts:

```bash
npm run seed:dev 30   # one dairy with 30 days of entries; prints a session token
npm run clear:dev     # wipe dairies/entries/sessions (admins kept)
```

> Running the full suite twice inside 15 minutes will trip the registration
> rate limiter and two checks will report `rate_limited`. That is the limiter
> working. Restart the server to reset its in-memory counters.

### Manual checklist

- [ ] Register a dairy → lands on Home without an OTP step
- [ ] Kill and reopen the app → session restores, no re-registration
- [ ] Try to register the same mobile again → Hindi "already registered" error
- [ ] Save a milk entry before setting a rate → blocked with a clear message
- [ ] Set buffalo `perFatPoint` ₹9, cow `perLitre` ₹60 → both save independently
- [ ] Add 10 L @ 5 fat buffalo → total is ₹450, not ₹90
- [ ] Add 10 L cow → total is ₹600, fat ignored
- [ ] Double-tap "सेव करें" → exactly one entry is created
- [ ] Home totals update after returning from the success screen
- [ ] Change the buffalo rate to ₹20 → the old entry still reads ₹9 / ₹450
- [ ] Reports: switch आज / सप्ताह / महीना and the shift and type filters
- [ ] Reports: toggle सारांश / विवरण — विवरण lists each entry with fat and rate
- [ ] Reports: with "सुबह" selected, totals drop to the morning-only amount
- [ ] Download the PDF → opens from Downloads, totals match the screen
- [ ] Turn off Wi-Fi → a clear connection error, no false "saved" message
- [ ] Register a second dairy → it sees none of the first dairy's records
- [ ] Admin panel: visit `/dairies` while logged out → redirected to `/login`

---

## 11. Status

**Working and verified**

- Backend: all 12 endpoints, 60/60 automated checks passing against real MongoDB
- PDF: multi-page, repeated headers, correct grand totals, page footers
- Admin panel: builds clean, 0 npm vulnerabilities, all pages verified with live
  data and screenshots
- Mobile: TypeScript clean, Metro bundle succeeds, **debug APK builds**

**Needs your input**

| Item | Why |
|---|---|
| Runtime test on a device | No emulator/device was attached here, so the UI has not been exercised on-screen. Everything else is verified. |
| Real illustrations | Placeholders ship; SVG fallbacks render until you drop in artwork. |
| Release signing keystore | Not generated — required before publishing. |
| Production API URL | `src/api/config.ts` still points at a placeholder host. |
| HTTPS + hosting | Local HTTP only; Android blocks cleartext in release builds by default. |

**Deliberately not built** (out of scope per the brief): offline storage/sync,
OTP, fat-wise rate tables (marked "skip this" on the reference), Excel and
WhatsApp export, bottom tab navigation.
