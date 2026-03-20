import crypto from 'crypto';

/**
 * Computes SHA-256 of JSON.stringify(sorted keys of kycData)
 * @param kycData The KYC data to hash
 * @returns hex string
 */
export function computeKycHash(kycData: object): string {
  const sortedData = sortObjectKeys(kycData);
  const jsonString = JSON.stringify(sortedData);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Helper to sort object keys recursively
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sortedKeys = Object.keys(obj).sort();
  const result: any = {};
  for (const key of sortedKeys) {
    result[key] = sortObjectKeys(obj[key]);
  }
  return result;
}

/**
 * Returns Solana KYC registry PDA seeds
 * @param walletAddress The user's wallet address
 * @returns Buffer[]
 */
export function getKycPdaSeeds(walletAddress: string): Buffer[] {
  return [Buffer.from('kyc'), Buffer.from(walletAddress)];
}
