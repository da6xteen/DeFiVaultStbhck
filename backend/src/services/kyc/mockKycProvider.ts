import { v4 as uuidv4 } from 'uuid';

export interface KycCheckData {
  fullName: string;
  dateOfBirth: string; // ISO date
  nationality: string; // ISO 3166-1 alpha-2
  documentType: 'PASSPORT' | 'ID_CARD' | 'DRIVERS_LICENSE';
  documentNumber: string;
}

export interface KycCheckResult {
  checkId: string;
  status: 'APPROVED' | 'REJECTED';
  riskScore: number; // 0.0 to 1.0
  pepFlag: boolean;
  sanctionsFlag: boolean;
  rejectionReason?: string;
  rawResponse: object;
}

export class MockKycProvider {
  async checkIdentity(data: KycCheckData): Promise<KycCheckResult> {
    // Always returns after 500ms delay (simulate async)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const checkId = uuidv4();
    let status: 'APPROVED' | 'REJECTED' = 'APPROVED';
    let riskScore = Math.random() * (0.35 - 0.05) + 0.05;
    let pepFlag = false;
    let sanctionsFlag = false;
    let rejectionReason: string | undefined;

    // Mock logic
    if (data.documentNumber.startsWith('REJECT')) {
      status = 'REJECTED';
      rejectionReason = 'Document verification failed';
    } else if (data.documentNumber.startsWith('PEP')) {
      pepFlag = true;
      riskScore = 0.7;
      status = 'APPROVED';
    } else if (['IR', 'KP', 'SY'].includes(data.nationality.toUpperCase())) {
      sanctionsFlag = true;
      status = 'REJECTED';
      rejectionReason = 'Sanctioned country';
    }

    const rawResponse = {
      provider: 'MockKYC',
      version: '1.0',
      timestamp: new Date().toISOString(),
      input: data,
    };

    return {
      checkId,
      status,
      riskScore,
      pepFlag,
      sanctionsFlag,
      rejectionReason,
      rawResponse,
    };
  }
}
