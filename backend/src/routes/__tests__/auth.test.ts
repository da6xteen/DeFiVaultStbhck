import request from 'supertest';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import app from '../../index';
import { prisma } from '../../lib/prisma';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    kycRecord: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Auth System', () => {
  const keypair = Keypair.generate();
  const walletAddress = keypair.publicKey.toBase58();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/nonce', () => {
    it('should return 200 and a nonce for a valid wallet address', async () => {
      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-id',
        walletAddress,
      });

      const response = await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain(walletAddress);
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });
    });

    it('should return 400 for an invalid wallet address', async () => {
      const response = await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress: 'invalid-address' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid Solana wallet address');
    });
  });

  describe('POST /api/auth/verify', () => {
    it('should verify signature and return a JWT', async () => {
      // 1. Get nonce
      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-id',
        walletAddress,
      });

      const nonceResponse = await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress });

      const { message } = nonceResponse.body;

      // 2. Sign message
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
      const signature = bs58.encode(signatureBytes);

      // 3. Verify
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        walletAddress,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({ walletAddress, signature });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('token');
      expect(verifyResponse.body.userId).toBe('user-id');
      expect(verifyResponse.body.walletAddress).toBe(walletAddress);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should return 401 for an invalid signature', async () => {
      // 1. Get nonce
      (prisma.user.upsert as jest.Mock).mockResolvedValue({
        id: 'user-id',
        walletAddress,
      });

      await request(app)
        .post('/api/auth/nonce')
        .send({ walletAddress });

      // 2. Use a fake signature
      const signature = bs58.encode(Buffer.alloc(64));

      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({ walletAddress, signature });

      expect(verifyResponse.status).toBe(401);
      expect(verifyResponse.body.message).toBe('Invalid signature');
    });

    it('should return 400 if nonce is missing', async () => {
      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({ walletAddress: 'someOtherWallet', signature: 'someSignature' });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.message).toBe('Nonce not found or expired');
    });
  });
});
