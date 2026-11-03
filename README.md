# eventShare

A shared photo gallery for events. Attendees join an event (QR, link or code), take or upload photos, and every attendee sees every photo from that event, at original quality.

## Repo layout

```
eventShare/
├── apps/
│   ├── mobile/              Expo (React Native) app — iOS + Android
│   │   └── src/
│   │       ├── app/         Expo Router screens (routes only)
│   │       ├── features/    events, uploads (persistent upload queue)
│   │       ├── components/  ui/ design-system components, tab bar
│   │       ├── services/    api client + react-query hooks, session
│   │       ├── store/       small app state (current event)
│   │       ├── constants/   theme tokens (see docs/DESIGN.md)
│   │       └── utils/
│   └── api/                 NestJS API — Postgres (Drizzle) + S3 storage
│       ├── src/             auth/, events/, photos/, storage/, users/, db/, config/
│       ├── drizzle/         SQL migrations
│       └── test/            end-to-end test of the core flow
├── packages/shared/         API contract: zod schemas + types used by app and API
├── infra/                   local infrastructure config
├── docker-compose.yml       local Postgres + S3-compatible storage
└── docs/                    DESIGN.md, ROADMAP.md, adr/
```

## Running it locally

Requires Node 22.13+ (`nvm use`), Docker Desktop, and Xcode for iOS.

```bash
npm install
npm run build -w @eventshare/shared      # build the shared contract package
docker compose up -d                     # Postgres :5433 + S3 storage :9000
cp apps/api/.env.example apps/api/.env   # first time only: set JWT_SECRET (openssl rand -base64 48)
npm run db:migrate -w @eventshare/api    # apply database migrations
npm run start:dev -w @eventshare/api     # API on http://localhost:4000
```

In another terminal, run the app (development build; Expo Go can't load our native modules):

```bash
cd apps/mobile
npx expo run:ios        # first build / after adding native packages
npm start               # day to day: Metro only, then open the installed app
```

Sign-in is our own email + password (`POST /auth/signup`, `POST /auth/login`), returning a JWT the app keeps in SecureStore. Clerk is installed but commented out (`apps/mobile/src/features/auth/clerk-sign-in.tsx`). `AUTH_DEV_BYPASS=true` (a test-user header) is switched on only by `test:e2e` and refused in production.

## Checks

```bash
npm run typecheck                         # all workspaces
npm run lint
npm run test:e2e -w @eventshare/api       # core flow against the local stack
```

## Conventions

- UI follows [docs/DESIGN.md](docs/DESIGN.md): theme tokens and `components/ui` only.
- Add Expo/React Native packages with `npx expo install <pkg>` (from `apps/mobile`) so versions match the SDK.
- API request bodies are validated with the zod schemas in `packages/shared`.
- Never commit `.env` files or signing keys.

## Deploy (AWS, Mumbai)

One EC2 server runs the API, Postgres and Caddy (HTTPS); photos live in a private S3 bucket.
Branches: `pre-prod` and `prod`. Nothing deploys automatically; you choose which branch goes live.

- **One-time setup** (from your Mac): `infra/aws/setup.sh` creates the buckets, server, firewall and SSH key
  (`~/.ssh/eventshare-admin.pem`). SSH is only open to the IP you ran it from; re-run it if your IP changes.
- **Go live:** push the branch to GitHub, then
  ```bash
  ssh -i ~/.ssh/eventshare-admin.pem ec2-user@<server-ip>
  cd /opt/eventshare/app && ./scripts/server-deploy.sh prod      # or pre-prod
  ```
  It pulls that branch exactly as on GitHub, rebuilds the API and restarts it (migrations run on start).
  Each deploy is logged in `/opt/eventshare/deploys.log`.
- **CI:** GitHub Actions ([ci.yml](.github/workflows/ci.yml)) runs the API tests and app checks on every push; it never deploys.
- Secrets (database password, `JWT_SECRET`) are generated on the server in `/opt/eventshare` and never leave it.
