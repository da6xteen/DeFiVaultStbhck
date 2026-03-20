import { v4 as uuidv4 } from 'uuid';

export interface KytResult {
  screeningId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  flags: string[];
  recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';
  rawResponse: object;
}

export class MockKytProvider {
  async screenTransaction(data: {
    txId: string;
    fromAddress: string;
    toAddress: string;
    amountUsdc: number;
    transactionType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  }): Promise<KytResult> {
    // Mock 300ms delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    const screeningId = uuidv4();
    let riskScore: number;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
    let flags: string[] = [];
    let recommendation: 'ALLOW' | 'REVIEW' | 'BLOCK';

    if (data.fromAddress.startsWith('DIRTY')) {
      riskScore = 0.92;
      riskLevel = 'BLOCKED';
      flags = ['KNOWN_MALICIOUS'];
      recommendation = 'BLOCK';
    } else if (data.amountUsdc > 50000) {
      riskScore = 0.65;
      riskLevel = 'HIGH';
      flags = ['LARGE_TRANSACTION'];
      recommendation = 'REVIEW';
    } else if (data.amountUsdc > 10000) {
      riskScore = 0.45;
      riskLevel = 'MEDIUM';
      flags = ['ELEVATED_AMOUNT'];
      recommendation = 'REVIEW';
    } else {
      // random 0.02-0.25
      riskScore = Math.random() * (0.25 - 0.02) + 0.02;
      riskLevel = 'LOW';
      flags = [];
      recommendation = 'ALLOW';
    }

    const result: KytResult = {
      screeningId,
      riskScore,
      riskLevel,
      flags,
      recommendation,
      rawResponse: {
        mocked: true,
        timestamp: new Date().toISOString(),
        input: data,
      },
    };

    return result;
  }
}
