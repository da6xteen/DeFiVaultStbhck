import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { config } from '../config';

const router = Router();

/**
 * GET /api/compliance/audit-log
 * Returns AuditLog entries for authenticated user, newest first, paginated
 * Query params: ?page=1&limit=20
 */
router.get('/audit-log', authenticateJWT, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where: { userId } }),
    ]);

    return res.status(200).json({
      data: logs,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/compliance/admin/audit-log
 * Returns all AuditLog entries with user info, paginated
 * Filter by ?action=KYC_SUBMITTED or ?userId=xxx
 */
router.get('/admin/audit-log', authenticateJWT, async (req: Request, res: Response) => {
  const adminWallet = req.user!.walletAddress;

  if (adminWallet !== config.ADMIN_WALLET) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const action = req.query.action as string;
  const userId = req.query.userId as string;

  const where: any = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;

  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              walletAddress: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.status(200).json({
      data: logs,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching admin audit logs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
