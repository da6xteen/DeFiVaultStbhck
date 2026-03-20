export interface AmlResult {
  passed: boolean;
  reason?: string;
}

export async function screenForAml(walletAddress: string): Promise<AmlResult> {
  if (walletAddress.startsWith('SANCTION')) {
    return { passed: false, reason: 'Address on OFAC SDN list' };
  }

  if (walletAddress.startsWith('PEP')) {
    return { passed: false, reason: 'Politically exposed person wallet' };
  }

  return { passed: true };
}
