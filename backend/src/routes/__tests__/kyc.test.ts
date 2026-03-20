import request from 'supertest';
import app from '../../index';
import { prisma } from '../../lib/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { KycStatus } from '@prisma/client';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
    kycRecord: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe('KYC Module', () => {
  const userId = 'test-user-id';
  const walletAddress = '5H699B5qYjRHz9vPzT7p4J3uK7N7k8fG8D8D8D8D8D8D';
  const adminWallet = 'admin-wallet-address';

  let userToken: string;
  let adminToken: string;

  beforeAll(() => {
    userToken = jwt.sign({ userId, walletAddress }, config.JWT_SECRET);
    adminToken = jwt.sign({ userId: 'admin-id', walletAddress: adminWallet }, config.JWT_SECRET);
    // Mock admin wallet in config for the test
    (config as any).ADMIN_WALLET = adminWallet;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/kyc/submit', () => {
    const validData = {
      fullName: 'John Doe',
      dateOfBirth: '1990-01-01',
      nationality: 'US',
      documentType: 'PASSPORT',
      documentNumber: '123456789',
    };

    it('should return 400 if user already has APPROVED KYC', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue({
        status: KycStatus.APPROVED,
      });

      const response = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('User already has APPROVED KYC');
    });

    it('should return 400 if user has PENDING KYC submitted less than 1 hour ago', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue({
        status: KycStatus.PENDING,
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('pending KYC submission');
    });

    it('should return APPROVED for valid data', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.kycRecord.upsert as jest.Mock).mockResolvedValue({ id: 'kyc-id' });
      (prisma.kycRecord.update as jest.Mock).mockResolvedValue({
        id: 'kyc-id',
        status: KycStatus.APPROVED,
        riskScore: 0.1,
        pepFlag: false,
        sanctionsFlag: false,
      });

      const response = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(KycStatus.APPROVED);
      expect(response.body.message).toBe('KYC Approved');
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should return REJECTED if documentNumber starts with REJECT', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.kycRecord.upsert as jest.Mock).mockResolvedValue({ id: 'kyc-id' });
      (prisma.kycRecord.update as jest.Mock).mockResolvedValue({
        id: 'kyc-id',
        status: KycStatus.REJECTED,
        riskScore: 0.1,
        pepFlag: false,
        sanctionsFlag: false,
      });

      const response = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validData, documentNumber: 'REJECT123' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(KycStatus.REJECTED);
      expect(response.body.message).toBe('KYC Rejected');
    });

    it('should return REJECTED for sanctioned countries (IR, KP, SY)', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.kycRecord.upsert as jest.Mock).mockResolvedValue({ id: 'kyc-id' });
      (prisma.kycRecord.update as jest.Mock).mockResolvedValue({
        id: 'kyc-id',
        status: KycStatus.REJECTED,
        riskScore: 0.1,
        pepFlag: false,
        sanctionsFlag: true,
      });

      const response = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validData, nationality: 'IR' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(KycStatus.REJECTED);
    });

    it('should return APPROVED with PEP flag if documentNumber starts with PEP', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.kycRecord.upsert as jest.Mock).mockResolvedValue({ id: 'kyc-id' });
      (prisma.kycRecord.update as jest.Mock).mockResolvedValue({
        id: 'kyc-id',
        status: KycStatus.APPROVED,
        riskScore: 0.7,
        pepFlag: true,
        sanctionsFlag: false,
      });

      const response = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...validData, documentNumber: 'PEP123' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(KycStatus.APPROVED);
      expect(response.body.pepFlag).toBe(true);
      expect(response.body.riskScore).toBe(0.7);
    });
  });

  describe('GET /api/kyc/status', () => {
    it('should return NOT_SUBMITTED if no record exists', async () => {
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('NOT_SUBMITTED');
    });

    it('should return current KYC record', async () => {
      const mockRecord = {
        status: KycStatus.APPROVED,
        riskScore: 0.2,
        pepFlag: false,
        sanctionsFlag: false,
        approvedAt: new Date(),
        expiresAt: new Date(),
        rejectionReason: null,
      };
      (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(mockRecord);

      const response = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(mockRecord.status);
      expect(response.body.riskScore).toBe(mockRecord.riskScore);
    });
  });

  describe('GET /api/kyc/admin/all', () => {
    it('should return 403 if not admin', async () => {
      const response = await request(app)
        .get('/api/kyc/admin/all')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should return all KYC records for admin', async () => {
      const mockRecords = [
        {
          id: '1',
          userId: 'user1',
          status: KycStatus.APPROVED,
          user: { walletAddress: 'wallet1' },
        },
      ];
      (prisma.kycRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);
      (prisma.kycRecord.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/api/kyc/admin/all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].walletAddress).toBe('wallet1');
      expect(response.body.total).toBe(1);
    });
  });
});
