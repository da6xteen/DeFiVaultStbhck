import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { requireKyc } from '../middleware/requireKyc';
import { runComplianceCheck } from '../services/compliance/complianceEngine';
import { vaultService } from '../services/vault/vaultService';
import { prisma } from '../lib/prisma';
import { TransactionStatus, TransactionType } from '@prisma/client';
import bs58 from 'bs58';

const router = Router();

// All routes here require auth + KYC
router.use(authenticateJWT);
router.use(requireKyc);

/**
 * POST /api/vault/deposit
 */
router.post('/deposit', async (req: Request, res: Response) => {
  const { amountUsdc, toAddress } = req.body;
  const { userId, walletAddress } = req.user!;

  try {
    const complianceResult = await runComplianceCheck({
      userId,
      walletAddress,
      toAddress: toAddress || process.env.VAULT_ADDRESS || 'VAULT_ADDRESS_MISSING',
      amountUsdc,
      transactionType: 'DEPOSIT',
    });

    if (!complianceResult.approved) {
      await prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.REJECTED,
          amountUsdc,
          fromAddress: walletAddress,
          toAddress: toAddress || process.env.VAULT_ADDRESS,
          kytRisk: complianceResult.kytResult?.riskLevel as any,
          kytScore: complianceResult.kytResult?.riskScore,
          complianceNotes: complianceResult.rejectionReason,
        },
      });

      return res.status(403).json({
        error: 'Compliance check failed',
        rejectionReason: complianceResult.rejectionReason,
      });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.APPROVED,
        amountUsdc,
        fromAddress: walletAddress,
        toAddress: toAddress || process.env.VAULT_ADDRESS,
        kytRisk: complianceResult.kytResult?.riskLevel as any,
        kytScore: complianceResult.kytResult?.riskScore,
        travelRuleRequired: complianceResult.travelRuleRequired,
        travelRuleData: complianceResult.travelRuleData as any,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        transactionId: transaction.id,
        action: 'DEPOSIT_APPROVED',
        actor: 'SYSTEM',
        details: complianceResult as any,
      },
    });

    return res.json({
      transactionId: transaction.id,
      status: 'APPROVED',
      amountUsdc,
      travelRuleRequired: complianceResult.travelRuleRequired,
      travelRuleData: complianceResult.travelRuleData,
      message: 'Transaction approved. Submit on-chain to complete deposit.',
    });
  } catch (error: any) {
    console.error('Deposit error:', error);
    return res.status(error.message === 'KYC required' ? 403 : 500).json({ error: error.message });
  }
});

/**
 * POST /api/vault/withdraw
 */
router.post('/withdraw', async (req: Request, res: Response) => {
  const { amountUsdc } = req.body;
  const { userId, walletAddress } = req.user!;

  try {
    const complianceResult = await runComplianceCheck({
      userId,
      walletAddress,
      toAddress: walletAddress, // Withdrawal to self
      amountUsdc,
      transactionType: 'WITHDRAWAL',
    });

    if (!complianceResult.approved) {
      await prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.REJECTED,
          amountUsdc,
          fromAddress: 'VAULT',
          toAddress: walletAddress,
          kytRisk: complianceResult.kytResult?.riskLevel as any,
          kytScore: complianceResult.kytResult?.riskScore,
          complianceNotes: complianceResult.rejectionReason,
        },
      });

      return res.status(403).json({
        error: 'Compliance check failed',
        rejectionReason: complianceResult.rejectionReason,
      });
    }

    const balance = await vaultService.getVaultBalance(walletAddress);
    const availableNumeric = parseFloat(balance.availableBalance.split(' ')[0]);
    if (availableNumeric < amountUsdc) {
      return res.status(400).json({ error: 'Insufficient vault balance' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.WITHDRAWAL,
        status: TransactionStatus.APPROVED,
        amountUsdc,
        fromAddress: 'VAULT',
        toAddress: walletAddress,
        kytRisk: complianceResult.kytResult?.riskLevel as any,
        kytScore: complianceResult.kytResult?.riskScore,
        travelRuleRequired: complianceResult.travelRuleRequired,
        travelRuleData: complianceResult.travelRuleData as any,
      },
    });

    return res.json({
      transactionId: transaction.id,
      status: 'APPROVED',
      amountUsdc,
      travelRuleRequired: complianceResult.travelRuleRequired,
      message: 'Withdrawal approved.',
    });
  } catch (error: any) {
    console.error('Withdrawal error:', error);
    return res.status(error.message === 'KYC required' ? 403 : 500).json({ error: error.message });
  }
});

/**
 * GET /api/vault/balance
 */
router.get('/balance', async (req: Request, res: Response) => {
  const { userId, walletAddress } = req.user!;

  try {
    const balance = await vaultService.getVaultBalance(walletAddress);
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return res.json({
      ...balance,
      transactions,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vault/stats
 * Public route handled below
 */

/**
 * POST /api/vault/confirm
 */
router.post('/confirm', async (req: Request, res: Response) => {
  const { transactionId, solanaSignature } = req.body;
  const { userId } = req.user!;

  if (!solanaSignature || solanaSignature.length < 87 || solanaSignature.length > 88) {
    return res.status(400).json({ error: 'Invalid Solana signature format' });
  }

  try {
    bs58.decode(solanaSignature);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid Solana signature format' });
  }

  try {
    const transaction = await prisma.transaction.update({
      where: { id: transactionId, userId },
      data: {
        solanaSignature,
        status: TransactionStatus.EXECUTED,
        processedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        transactionId: transaction.id,
        action: 'TRANSACTION_CONFIRMED',
        actor: 'SYSTEM',
        details: { solanaSignature },
      },
    });

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

/**
 * Public Stats Router
 */
export const publicVaultRouter = Router();

publicVaultRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await vaultService.getVaultStats();
    return res.json(stats);
  } catch (error) {
    // Fallback to DB
    const dbStats = await prisma.vaultState.findUnique({
      where: { id: 'singleton' },
    });

    if (!dbStats) {
      return res.status(500).json({ error: 'Stats unavailable' });
    }

    return res.json({
      totalDeposited: dbStats.totalDeposited.toFixed(2) + ' USDC',
      totalWithdrawn: dbStats.totalWithdrawn.toFixed(2) + ' USDC',
      tvl: dbStats.totalDeposited.minus(dbStats.totalWithdrawn).toFixed(2) + ' USDC',
    });
  }
});
