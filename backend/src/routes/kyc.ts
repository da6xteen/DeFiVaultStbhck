import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { MockKycProvider } from '../services/kyc/mockKycProvider';
import { config } from '../config';
import { KycStatus } from '@prisma/client';

const router = Router();
const kycProvider = new MockKycProvider();

const submitKycSchema = z.object({
  fullName: z.string().min(1),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid ISO date',
  }),
  nationality: z.string().length(2).regex(/^[A-Z]{2}$/),
  documentType: z.enum(['PASSPORT', 'ID_CARD', 'DRIVERS_LICENSE']),
  documentNumber: z.string().min(1),
});

/**
 * POST /api/kyc/submit
 * Requires auth
 */
router.post('/submit', authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const walletAddress = req.user!.walletAddress;

  const validation = submitKycSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.error.format(),
    });
  }

  const { fullName, dateOfBirth, nationality, documentType, documentNumber } = validation.data;

  try {
    // Check if user already has APPROVED KYC
    const existingKyc = await prisma.kycRecord.findUnique({
      where: { userId },
    });

    if (existingKyc?.status === KycStatus.APPROVED) {
      return res.status(400).json({ message: 'User already has APPROVED KYC' });
    }

    // Check if user has PENDING KYC submitted less than 1 hour ago
    if (existingKyc?.status === KycStatus.PENDING) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existingKyc.updatedAt > oneHourAgo) {
        return res.status(400).json({ message: 'User has a pending KYC submission. Please wait.' });
      }
    }

    // Create or update KycRecord with status PENDING
    const kycRecord = await prisma.kycRecord.upsert({
      where: { userId },
      update: {
        status: KycStatus.PENDING,
        dateOfBirth: new Date(dateOfBirth),
        nationality,
        documentType,
        documentNumber,
        rejectionReason: null,
      },
      create: {
        userId,
        status: KycStatus.PENDING,
        dateOfBirth: new Date(dateOfBirth),
        nationality,
        documentType,
        documentNumber,
      },
    });

    // Also update User full name
    await prisma.user.update({
      where: { id: userId },
      data: { fullName },
    });

    // Call MockKycProvider.checkIdentity()
    const result = await kycProvider.checkIdentity({
      fullName,
      dateOfBirth,
      nationality,
      documentType,
      documentNumber,
    });

    // Update KycRecord
    const approvedAt = result.status === 'APPROVED' ? new Date() : null;
    const expiresAt = result.status === 'APPROVED' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;

    const updatedKyc = await prisma.kycRecord.update({
      where: { id: kycRecord.id },
      data: {
        status: result.status as KycStatus,
        riskScore: result.riskScore,
        pepFlag: result.pepFlag,
        sanctionsFlag: result.sanctionsFlag,
        mockCheckId: result.checkId,
        rawResponse: result.rawResponse as any,
        rejectionReason: result.rejectionReason,
        approvedAt,
        expiresAt,
      },
    });

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'KYC_SUBMITTED',
        actor: walletAddress,
        details: {
          status: result.status,
          riskScore: result.riskScore,
          pepFlag: result.pepFlag,
          sanctionsFlag: result.sanctionsFlag,
        },
        ipAddress: req.ip,
      },
    });

    return res.status(200).json({
      kycId: updatedKyc.id,
      status: updatedKyc.status,
      riskScore: updatedKyc.riskScore,
      pepFlag: updatedKyc.pepFlag,
      sanctionsFlag: updatedKyc.sanctionsFlag,
      message: result.status === 'APPROVED' ? 'KYC Approved' : 'KYC Rejected',
    });
  } catch (error) {
    console.error('Error in /kyc/submit:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/kyc/status
 * Requires auth
 */
router.get('/status', authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const kycRecord = await prisma.kycRecord.findUnique({
      where: { userId },
    });

    if (!kycRecord) {
      return res.status(200).json({ status: 'NOT_SUBMITTED' });
    }

    return res.status(200).json({
      status: kycRecord.status,
      riskScore: kycRecord.riskScore,
      pepFlag: kycRecord.pepFlag,
      sanctionsFlag: kycRecord.sanctionsFlag,
      approvedAt: kycRecord.approvedAt,
      expiresAt: kycRecord.expiresAt,
      rejectionReason: kycRecord.rejectionReason,
    });
  } catch (error) {
    console.error('Error in /kyc/status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/kyc/admin/all
 * Admin only
 */
router.get('/admin/all', authenticateJWT, async (req: Request, res: Response) => {
  const walletAddress = req.user!.walletAddress;

  if (walletAddress !== config.ADMIN_WALLET) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [kycRecords, total] = await Promise.all([
      prisma.kycRecord.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              walletAddress: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.kycRecord.count(),
    ]);

    const formattedRecords = kycRecords.map((record) => ({
      ...record,
      walletAddress: record.user.walletAddress,
    }));

    return res.status(200).json({
      data: formattedRecords,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error in /kyc/admin/all:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
