import { Router, Request, Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../config';

const router = Router();

// In-memory store for nonces: Map<walletAddress, {nonce, message, expiresAt}>
const nonceStore = new Map<string, { nonce: string; message: string; expiresAt: Date }>();

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /auth/nonce
 * Body: { walletAddress: string }
 */
router.post('/nonce', async (req: Request, res: Response) => {
  const { walletAddress } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ message: 'Wallet address is required' });
  }

  try {
    // Validate Solana public key
    new PublicKey(walletAddress);
  } catch (error) {
    return res.status(400).json({ message: 'Invalid Solana wallet address' });
  }

  try {
    // Upsert User record
    await prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });

    const nonce = uuidv4();
    const timestamp = new Date().toISOString();
    const message = `Sign this message to authenticate with StableHacks Vault.\nNonce: ${nonce}\nWallet: ${walletAddress}\nTimestamp: ${timestamp}`;

    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
    nonceStore.set(walletAddress, { nonce, message, expiresAt });

    return res.status(200).json({ nonce, message });
  } catch (error) {
    console.error('Error in /nonce:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /auth/verify
 * Body: { walletAddress: string, signature: string }
 */
router.post('/verify', async (req: Request, res: Response) => {
  const { walletAddress, signature } = req.body;

  if (!walletAddress || !signature) {
    return res.status(400).json({ message: 'Wallet address and signature are required' });
  }

  const storedData = nonceStore.get(walletAddress);

  if (!storedData) {
    return res.status(400).json({ message: 'Nonce not found or expired' });
  }

  if (storedData.expiresAt < new Date()) {
    nonceStore.delete(walletAddress);
    return res.status(400).json({ message: 'Nonce expired' });
  }

  try {
    const publicKey = new PublicKey(walletAddress);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(storedData.message);

    const verified = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (!verified) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    // Success
    nonceStore.delete(walletAddress);

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = jwt.sign(
      { userId: user.id, walletAddress: user.walletAddress },
      config.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AUTH_SUCCESS',
        actor: walletAddress,
        ipAddress: req.ip,
      },
    });

    return res.status(200).json({
      token,
      userId: user.id,
      walletAddress: user.walletAddress,
    });
  } catch (error) {
    console.error('Error in /verify:', error);
    return res.status(401).json({ message: 'Invalid signature or request' });
  }
});

export default router;
