import { runComplianceCheck } from '../complianceEngine';
import { prisma } from '../../../lib/prisma';
import { KycStatus } from '@prisma/client';

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    kycRecord: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe('ComplianceEngine', () => {
  const mockUser = {
    id: 'user-1',
    fullName: 'John Doe',
  };

  const mockKycRecord = {
    userId: 'user-1',
    status: KycStatus.APPROVED,
    nationality: 'US',
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject if user has no APPROVED KYC', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      runComplianceCheck({
        userId: 'user-1',
        walletAddress: 'CLEAN_WALLET',
        toAddress: 'RECIPIENT',
        amountUsdc: 100,
        transactionType: 'TRANSFER',
      })
    ).rejects.toThrow('KYC required');
  });

  it('should block if wallet address is DIRTY', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(mockKycRecord);

    const result = await runComplianceCheck({
      userId: 'user-1',
      walletAddress: 'DIRTY_WALLET',
      toAddress: 'RECIPIENT',
      amountUsdc: 100,
      transactionType: 'TRANSFER',
    });

    expect(result.approved).toBe(false);
    expect(result.rejectionReason).toContain('KYT blocked');
    expect(result.kytResult.recommendation).toBe('BLOCK');
  });

  it('should set travelRuleRequired=true for amount >= 1000 USDC', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(mockKycRecord);

    const result = await runComplianceCheck({
      userId: 'user-1',
      walletAddress: 'CLEAN_WALLET',
      toAddress: 'RECIPIENT',
      amountUsdc: 1000,
      transactionType: 'TRANSFER',
    });

    expect(result.approved).toBe(true);
    expect(result.travelRuleRequired).toBe(true);
    expect(result.travelRuleData).toBeDefined();
    expect(result.travelRuleData?.transferAmount).toBe(1000);
  });

  it('should approve clean transaction under threshold', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(mockKycRecord);

    const result = await runComplianceCheck({
      userId: 'user-1',
      walletAddress: 'CLEAN_WALLET',
      toAddress: 'RECIPIENT',
      amountUsdc: 500,
      transactionType: 'TRANSFER',
    });

    expect(result.approved).toBe(true);
    expect(result.travelRuleRequired).toBe(false);
    expect(result.travelRuleData).toBeUndefined();
  });

  it('should reject if AML screening fails (SANCTION)', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(mockKycRecord);

    const result = await runComplianceCheck({
      userId: 'user-1',
      walletAddress: 'SANCTION_WALLET',
      toAddress: 'RECIPIENT',
      amountUsdc: 100,
      transactionType: 'TRANSFER',
    });

    expect(result.approved).toBe(false);
    expect(result.rejectionReason).toBe('Address on OFAC SDN list');
    expect(result.amlResult.passed).toBe(false);
  });
});
