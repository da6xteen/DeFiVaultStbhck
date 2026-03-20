import request from 'supertest';
import express from 'express';
import { requireKyc } from '../requireKyc';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    kycRecord: {
      findUnique: jest.fn(),
    },
  },
}));

const app = express();
app.use(express.json());
// Mock auth middleware for testing requireKyc
app.use((req: any, res, next) => {
  if (req.headers['user-id']) {
    req.user = {
      userId: req.headers['user-id'],
      walletAddress: req.headers['wallet-address'],
    };
  }
  next();
});
app.get('/test-kyc', requireKyc, (req, res) => {
  res.status(200).json({ message: 'Success' });
});

describe('requireKyc Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    const response = await request(app).get('/test-kyc');
    expect(response.status).toBe(401);
  });

  it('should return 403 if KYC record does not exist', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .get('/test-kyc')
      .set('user-id', 'user-123');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('KYC verification required');
  });

  it('should return 403 if KYC is not APPROVED', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue({
      status: 'PENDING',
    });

    const response = await request(app)
      .get('/test-kyc')
      .set('user-id', 'user-123');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('KYC verification required');
  });

  it('should return 403 if KYC is expired', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue({
      status: 'APPROVED',
      expiresAt: new Date(Date.now() - 10000), // 10 seconds ago
    });

    const response = await request(app)
      .get('/test-kyc')
      .set('user-id', 'user-123');

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('KYC expired');
  });

  it('should call next() if KYC is APPROVED and not expired', async () => {
    (prisma.kycRecord.findUnique as jest.Mock).mockResolvedValue({
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 10000), // 10 seconds from now
    });

    const response = await request(app)
      .get('/test-kyc')
      .set('user-id', 'user-123');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Success');
  });
});
