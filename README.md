# Hospital Billing

IPD healthcare billing — React client + Express/Prisma/PostgreSQL backend.

```
billing-dashboard/
├── client/    # React 19 + Rspack UI (:3009)
└── backend/   # Express + Prisma + PostgreSQL API (:8090)
```

## Backend

```bash
cd backend
cp .env.example .env   # set DATABASE_URL
npm install
npx prisma db push
npm run db:seed
npm run dev
```

- API: http://localhost:8090  
- Docs: http://localhost:8090/api/docs  
- Demo login: `billing` / `billing123`

## Client

```bash
cd client
npm install
npm run dev
```

UI: http://localhost:3000 (proxies `/api` → `:8090`)

## Tests

```bash
cd backend && npm test
```
