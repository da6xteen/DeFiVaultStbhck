import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const requireKyc = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const kycRecord = await prisma.kycRecord.findUnique({
      where: { userId: req.user.userId },
    });

    if (!kycRecord || kycRecord.status !== 'APPROVED') {
      return res.status(403).json({ message: 'KYC verification required' });
    }

    if (kycRecord.expiresAt && kycRecord.expiresAt < new Date()) {
      return res.status(403).json({ message: 'KYC expired' });
    }

    next();
  } catch (error) {
    console.error('Error checking KYC status:', error);
    return res.status(500).json({ message: 'Internal server error during KYC check' });
  }
};
