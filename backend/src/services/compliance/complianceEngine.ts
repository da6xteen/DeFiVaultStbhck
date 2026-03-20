import { prisma } from '../../lib/prisma';
import { KycStatus, TransactionType, KytRisk } from '@prisma/client';
import { MockKytProvider, KytResult } from './mockKytProvider';
import { screenForAml, AmlResult } from './amlScreening';
import {
  checkTravelRuleRequired,
  buildTravelRuleData,
  TravelRuleData,
} from './travelRule';

const kytProvider = new MockKytProvider();

export interface ComplianceCheckResult {
  approved: boolean;
  rejectionReason?: string;
  kytResult: KytResult;
  amlResult: AmlResult;
  travelRuleRequired: boolean;
  travelRuleData?: TravelRuleData;
}

export async function runComplianceCheck(params: {
  userId: string;
  walletAddress: string;
  toAddress: string;
  amountUsdc: number;
  transactionType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
}): Promise<ComplianceCheckResult> {
  // 1. Load user's KycRecord from DB — reject if not APPROVED ("KYC required")
  const kycRecord = await prisma.kycRecord.findUnique({
    where: { userId: params.userId },
    include: { user: true },
  });

  if (!kycRecord || kycRecord.status !== KycStatus.APPROVED) {
    throw new Error('KYC required');
  }

  // 2. Run AML screening on walletAddress — reject if not passed
  const amlResult = await screenForAml(params.walletAddress);
  if (!amlResult.passed) {
    return {
      approved: false,
      rejectionReason: amlResult.reason,
      kytResult: null as any, // KYT not run yet
      amlResult,
      travelRuleRequired: false,
    };
  }

  // 3. Run KYT screening — reject if recommendation === BLOCK
  const kytResult = await kytProvider.screenTransaction({
    txId: 'PENDING',
    fromAddress: params.walletAddress,
    toAddress: params.toAddress,
    amountUsdc: params.amountUsdc,
    transactionType: params.transactionType,
  });

  if (kytResult.recommendation === 'BLOCK') {
    return {
      approved: false,
      rejectionReason: `KYT blocked: ${kytResult.flags.join(', ')}`,
      kytResult,
      amlResult,
      travelRuleRequired: false,
    };
  }

  // 4. Check travel rule threshold — build TravelRuleData if required
  const travelRuleRequired = checkTravelRuleRequired(params.amountUsdc);
  let travelRuleData: TravelRuleData | undefined;

  if (travelRuleRequired) {
    travelRuleData = buildTravelRuleData({
      originatorName: kycRecord.user.fullName || 'Unknown',
      originatorWallet: params.walletAddress,
      originatorCountry: kycRecord.nationality || 'Unknown',
      beneficiaryName: 'Unknown', // In a real system, this would be provided
      beneficiaryWallet: params.toAddress,
      beneficiaryVaspId: 'UNKNOWN-VASP',
      beneficiaryCountry: 'Unknown',
      transferAmount: params.amountUsdc,
    });
  }

  // 5. All checks passed → approved: true
  const result: ComplianceCheckResult = {
    approved: true,
    kytResult,
    amlResult,
    travelRuleRequired,
    travelRuleData,
  };

  // 6. Write AuditLog with full compliance result
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: 'COMPLIANCE_CHECK',
      actor: 'SYSTEM',
      details: result as any,
    },
  });

  return result;
}
