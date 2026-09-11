# Architecture

Mutual Care is a single Node.js service with a browser frontend. It uses Node's built-in HTTP, cryptography, filesystem, and test modules, with no runtime dependencies.

## Project layout

```text
public/
  index.html                 Landing page and sign-in
  registration.html          Account registration
  dashboard.html             Member overview
  merchant.html              Listings and offer creation
  activity.html              Requests and account history
  wallet.html                 Wallet ledger
  referrals.html              Invitations and referred members
  profile.html                Profile editor
  settings.html               Preferences and password changes
  access.html                 Membership details
  admin.html                  Restricted administration
  assets/
    css/                      Original design and workspace styles
    images/                   Brand assets
    js/
      api.js                  Shared authenticated API client
      auth.js                 Sign-in and registration forms
      workspace.js            Member views and interactions
src/
  app.js                      HTTP routing, public files, error boundary
  config.js                   Environment configuration
  lib/
    auth.js                   Passwords and persistent sessions
    http.js                   JSON parsing, validation, response helpers
    store.js                  Atomic file repository and activity records
  routes/
    auth.js                   Account and session endpoints
    workspace.js              Member and administrator endpoints
scripts/admin.js              Local administrator provisioning
tests/api.test.js             Integration and security regression checks
data/                         Private persisted records (ignored by Git)
server.js                     Startup and shutdown
```

## Storage and security

The JSON repository is intended for local development and a small, single-process installation. Updates clone the latest state and atomically replace the file only after validation. Existing starter accounts are retained and receive default roles, invite codes, and preferences. Existing password hashes remain usable. Starter in-memory sessions require a fresh sign-in.

Passwords use salted scrypt hashes. Sessions use random tokens in HttpOnly, SameSite cookies; only token hashes are stored. Sessions expire after seven days and survive server restarts. Password changes invalidate every session for that account. Production mode adds the Secure cookie flag and requires HTTPS at a reverse proxy.

All member APIs authenticate the session. Listing changes require the seller or an administrator. Request changes require the buyer or seller and enforce allowed transitions. Registration always assigns the member role. Administrator access is provisioned locally while the server is stopped.

Only `public/` is served. Data files, environment settings, source files, and Git metadata are outside the public directory. Mutation endpoints reject cross-site browser requests. Authentication attempts are limited per source IP in memory. Requests accept bounded JSON objects; user text is escaped when rendered.

## API

All bodies are JSON. Errors use `{ "error": "message" }`. Session cookies authenticate protected routes.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service health |
| POST | `/api/auth/register` | Register with username, mobile, password, optional referralCode |
| POST | `/api/auth/login` | Sign in with username and password |
| POST | `/api/auth/logout` | Revoke current session |
| GET | `/api/auth/me` | Current public account fields |
| POST | `/api/auth/password` | Change password using currentPassword and password |
| GET | `/api/workspace` | Account, listings, own requests, activity, referrals, wallet |
| PATCH | `/api/profile` | Update displayName, mobile, email, address, bio |
| PATCH | `/api/settings` | Save boolean notifications preference |
| POST | `/api/listings` | Create title, description, integer priceCents |
| PATCH | `/api/listings/:id` | Set active boolean |
| POST | `/api/requests` | Request listingId with optional note |
| PATCH | `/api/requests/:id` | Change request status |
| GET | `/api/admin` | Administrator member, listing, request and activity overview |

Pending requests can be accepted or declined by the seller, or cancelled by the buyer. Accepted requests can be completed by the seller or cancelled by the buyer. Final states cannot be reopened. Prices are snapshotted in cents on each request. Completion records a marketplace status; it does not move money.

## Deployment boundaries

Use one server process per data file; stop it before provisioning administrators or restoring backups. Back up the data directory and restrict its filesystem access. For multiple processes or larger workloads, replace the repository with a transactional database and introduce pagination and shared rate limiting. The current limiter sees the reverse proxy IP when proxied.

Payments, email delivery, password recovery, mobile verification, uploads, and QR generation are not integrated. The wallet is read-only, starts at zero, and never fabricates funds. Notification preferences are stored without sending messages. Use a payment provider and verified webhooks before enabling deposits or withdrawals.
