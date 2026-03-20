import { WalletContextState } from '@solana/wallet-adapter-react';
import api from './api';
import { useStore } from './store';
import bs58 from 'bs58';

export const handleWalletAuth = async (wallet: WalletContextState) => {
  if (!wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected or does not support signing');
  }

  const walletAddress = wallet.publicKey.toBase58();

  try {
    // 1. Get nonce
    const nonceRes = await api.post('/auth/nonce', { walletAddress });
    const { message } = nonceRes.data;

    // 2. Sign message
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await wallet.signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    // 3. Verify signature
    const verifyRes = await api.post('/auth/verify', {
      walletAddress,
      signature,
    });

    const { token, userId } = verifyRes.data;

    // 4. Update store
    const store = useStore.getState();
    store.setToken(token);
    store.setUser(userId, walletAddress);

    // 5. Fetch KYC status
    const kycRes = await api.get('/api/kyc/status');
    store.setKycStatus(kycRes.data.status);

    return { token, userId, walletAddress, kycStatus: kycRes.data.status };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};
