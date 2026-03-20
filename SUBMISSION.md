# StableHacks Vault Submission

**Project Name**: StableHacks Vault

**Track**: Institutional Permissioned DeFi Vaults

**Team**: [TEAM_NAME] | [COUNTRY]

**Problem Statement**
Institutional investors cannot access DeFi yields due to lack of KYC/AML compliance infrastructure. Traditional vaults have no permissioning, no travel rule support, and no audit trails — making them unusable for regulated entities.

**Solution**
A permissioned USDC vault on Solana where:
- Every depositor must pass KYC before interacting with the smart contract
- Every transaction is screened by KYT for suspicious activity
- Transactions above $1,000 USDC trigger the FATF Travel Rule with full counterparty data
- All compliance events are written to an immutable audit log
- Institutional admins have a full compliance dashboard

**Architecture**
[Institutional User]
│
▼
[Next.js Dashboard] ──── Wallet Connect (Phantom)
│
▼
[Express API + JWT Auth]
│
├──► [KYC Engine] ── MockKYC Provider ── DB: kyc_records
├──► [KYT Engine] ── MockKYT Provider ── DB: transactions
├──► [AML Screen] ── Sanctions List
├──► [Travel Rule] ── FATF threshold $1,000
│
▼
[Solana Devnet]
├── KYC Registry Program (on-chain whitelist PDA per wallet)
└── Vault Program (deposit/withdraw gated by KYC PDA)
│
▼
[Audit Log] ── All compliance events stored immutably

**Compliance Implementation**
- KYC: Identity verification with PEP screening, sanctions check, risk scoring (0-1.0)
- KYT: Real-time transaction monitoring with risk levels LOW/MEDIUM/HIGH/BLOCKED
- AML: Address screening against OFAC SDN list (mocked)
- Travel Rule: FATF-compliant counterparty data collection for transfers >$1,000 USDC
- On-chain: KYC status stored as PDA — vault program reads directly, no trusted intermediary

**Regulatory Alignment**
- FINMA (Switzerland) AML framework
- FATF Travel Rule (Recommendation 16)
- MiCA Article 67 (Travel Rule for crypto-asset transfers)
- VASP ID: STABLEHACKS-VASP-001

**Testnet Demo**
Link: [TESTNET_URL]
Network: Solana Devnet
Vault Program: BXRCHDecnkhFgcweBhjVUtQMPhYTEmGvuyVB8UzvZuyN
KYC Registry: 8z9D4kVpSKL5WjQCo92oU4vvZeBPwb7VMe1Et9T3qKHa

**Test Credentials for Judges**
- Approved KYC: documentNumber = VALID123, nationality = DE
- Rejected KYC (sanctions): nationality = IR
- Rejected KYC (high risk): documentNumber = REJECT999
- KYT blocked wallet: any wallet starting with "DIRTY"
- Travel Rule trigger: deposit >= $1,000 USDC

**Partner Alignment**
- AMINA Bank: Compliance-first architecture ready for pilot integration
- Solana Foundation: Native Anchor programs, devnet deployment
- Fireblocks: VaultConfig authority designed for MPC wallet integration
- Solstice/Solstream: Event emission on all vault transactions
