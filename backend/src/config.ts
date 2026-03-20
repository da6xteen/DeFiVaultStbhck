import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  PORT: z.string().transform(Number).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_NETWORK: z.string(),
  ADMIN_WALLET: z.string().min(1),
  VAULT_AUTHORITY_KEYPAIR: z.string().min(1),
  VAULT_PROGRAM_ID: z.string().min(1),
  KYC_REGISTRY_PROGRAM_ID: z.string().min(1),
  VAULT_USDC_MINT: z.string().min(1),
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid environment variables:', result.error.format());
  process.exit(1);
}

export const config = result.data;
