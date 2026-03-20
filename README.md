# StableHacks Vault

Institutional Permissioned DeFi Vault on Solana for the StableHacks 2026 hackathon.

## 1. Project Overview
StableHacks Vault is a secure, compliant, and permissioned DeFi vault system designed for institutional investors. It integrates KYC/AML registries and compliance oracles to ensure all on-chain activities meet regulatory requirements.

## 2. Architecture Diagram
```text
  ┌──────────────────┐      ┌──────────────────┐      ┌────────────────────────┐
  │  Next.js 14      │      │  Express API     │      │  Solana Devnet         │
  │  Frontend        │─────▶│  (Backend)       │─────▶│  (Anchor Programs)     │
  └──────────────────┘      └────────┬─────────┘      └────────────────────────┘
                                     │
                                     │      ┌────────────────────────┐
                                     └─────▶│  Compliance Engine     │
                                            │  (AML/KYT/Travel Rule) │
                                            └────────────────────────┘
```

## 3. Prerequisites
- Node.js 20+
- Rust & Cargo
- Solana CLI 1.18+
- Anchor CLI 0.30+
- Docker & Docker Compose

## 4. Local Development
1. Start local services:
   ```bash
   docker-compose up -d
   ```
2. Set up environment variables in `backend/.env` and `frontend/.env.local` (use examples).
3. Install dependencies and set up DB:
   ```bash
   cd backend && npm install
   npx prisma migrate dev
   npx prisma generate
   npm run seed
   ```
4. Run development servers:
   ```bash
   # In backend/
   npm run dev
   # In frontend/
   npm run dev
   ```

## 5. Deploy Backend to Railway
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize project: `railway new`
4. Add PostgreSQL: `railway add postgresql`
5. Set Environment Variables:
   - `DATABASE_URL` (automatically set by Railway)
   - `JWT_SECRET`
   - `SOLANA_RPC_URL`
   - `SOLANA_NETWORK`
   - `ADMIN_WALLET`
   - `VAULT_AUTHORITY_KEYPAIR`
   - `VAULT_PROGRAM_ID`
   - `KYC_REGISTRY_PROGRAM_ID`
   - `VAULT_USDC_MINT`
6. Deploy: `railway up` (from `backend/` directory)

## 6. Deploy Frontend to Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Set Environment Variables in Vercel Dashboard:
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL
   - `NEXT_PUBLIC_SOLANA_NETWORK`: devnet
   - `NEXT_PUBLIC_VAULT_PROGRAM_ID`
   - `NEXT_PUBLIC_KYC_PROGRAM_ID`
   - `NEXT_PUBLIC_ADMIN_WALLET`
4. Redeploy to apply env vars.

## 7. Deploy Solana Programs
1. Navigate to `anchor/`:
   ```bash
   cd anchor
   anchor build
   anchor deploy --provider.cluster devnet
   ```
2. Update the backend and frontend environment variables with the new Program IDs.

## 8. Running the Demo
1. **Connect Wallet**: Access the frontend and connect your Solana wallet (Phantom/Backpack).
2. **KYC**: Complete the onboarding flow to register your identity in the on-chain KYC registry.
3. **Deposit**: Navigate to the Vault page. Deposits > $1,000 will trigger the Travel Rule compliance check.
4. **Admin Audit**: Admin users (defined by `ADMIN_WALLET`) can access the admin dashboard to view compliance logs and system stats.

## 9. Compliance Architecture
- **KYC Registry**: On-chain program that stores hashed user identity data and compliance status.
- **AML (Anti-Money Laundering)**: Mock service that screens wallet addresses against known sanction lists.
- **KYT (Know Your Transaction)**: Analyzes transaction patterns and amounts to flag suspicious activity.
- **Travel Rule**: Implements requirements to collect and transmit originator/beneficiary information for transfers exceeding $1,000.
