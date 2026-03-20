import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from '../config';

export const connection = new Connection(
  config.SOLANA_RPC_URL,
  'confirmed'
);

export function getAuthorityKeypair(): Keypair {
  if (!config.VAULT_AUTHORITY_KEYPAIR) {
    return Keypair.generate(); // devnet placeholder
  }
  try {
    return Keypair.fromSecretKey(bs58.decode(config.VAULT_AUTHORITY_KEYPAIR));
  } catch (e) {
    if (config.NODE_ENV === 'test') {
      return Keypair.generate();
    }
    throw e;
  }
}

export function getKycRecordPda(walletAddress: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('kyc'), new PublicKey(walletAddress).toBuffer()],
    new PublicKey(config.KYC_REGISTRY_PROGRAM_ID || SystemProgram.programId.toString())
  );
  return pda;
}

export function getUserVaultPda(walletAddress: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_vault'), new PublicKey(walletAddress).toBuffer()],
    new PublicKey(config.VAULT_PROGRAM_ID || SystemProgram.programId.toString())
  );
  return pda;
}

export function getVaultConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_config')],
    new PublicKey(config.VAULT_PROGRAM_ID || SystemProgram.programId.toString())
  );
  return pda;
}

// Read raw account data from chain — no IDL needed
export async function getAccountData(pubkey: PublicKey): Promise<Buffer | null> {
  try {
    const info = await connection.getAccountInfo(pubkey);
    if (!info) return null;
    return Buffer.from(info.data);
  } catch {
    return null;
  }
}
