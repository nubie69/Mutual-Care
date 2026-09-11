# Mutual Care

A community marketplace with a member portal, persistent accounts, merchant offers, requests, referrals, and restricted administration. The original branding and landing page are retained, with responsive member screens backed by saved data.

## Run locally

Requires Node.js 22 or newer. No dependency installation is needed.

```sh
npm start
```

Open http://127.0.0.1:3000. Register an account to enter the dashboard. For development with automatic server restarts, use `npm run dev`.

To try the marketplace, create two accounts in separate browser profiles: publish an offer with one, then request it with the other. Manage incoming and outgoing requests on the Activity page.

## Administration

Register your account, stop the server, then run:

```sh
npm run admin -- your_username
npm start
```

Sign in and open `/admin.html`. Public registration cannot grant administrator privileges.

## Configuration

See `.env.example` for supported environment variables. Set them in your shell, or use `node --env-file=.env server.js` after creating `.env`. Normal `npm start` does not automatically read `.env`.

Data is saved in `data/store.json`, outside the public directory and ignored by Git. Keep one server process per data file. Use HTTPS and `NODE_ENV=production` when hosting.

## Verification

```sh
npm test
```

The integration suite checks registration, login, referrals, profile updates, listing ownership, request transitions, account isolation, administrator restrictions, cross-site request rejection, private-file protection, concurrent registrations, restart persistence, password changes, and logout. Tests use a temporary data file.

## Project guide

- `public/`: pages, styles, images, and browser JavaScript.
- `src/`: HTTP application, route handlers, authentication, and storage.
- `scripts/`: administrator provisioning.
- `tests/`: integration coverage.
- `docs/architecture.md`: structure, API reference, and deployment boundaries.

The backend uses a single-process JSON repository with atomic writes. Payments and email delivery are not connected; wallet balances are read-only. See [architecture and API documentation](docs/architecture.md) for details.
