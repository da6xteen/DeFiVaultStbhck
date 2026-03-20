import { prisma } from '../../lib/prisma';
import { getAccountData, getUserVaultPda, getVaultConfigPda, getKycRecordPda } from '../../lib/solana';

export class VaultService {
  async registerKycOnChain(params: {
    walletAddress: string;
    kycHash: string;
    riskScore: number;
    pepFlag: boolean;
    sanctionsFlag: boolean;
    expiresAt: Date;
  }): Promise<{ signature: string; kycPda: string }> {
    // TODO: Replace with real tx once anchor build available locally
    console.log('Mocking on-chain KYC registration for:', params.walletAddress);
    return {
      signature: 'mock_' + Date.now(),
      kycPda: getKycRecordPda(params.walletAddress).toBase58(),
    };
  }

  async getVaultBalance(walletAddress: string): Promise<{
    depositedAmount: string
    withdrawnAmount: string
    availableBalance: string
    userVaultPda: string
  }> {
    try {
      // Calculate balance from DB transactions (reliable for MVP)
      const transactions = await prisma.transaction.findMany({
        where: {
          user: { walletAddress },
          status: { in: ['APPROVED', 'EXECUTED'] },
        },
        include: { user: true },
      })

      let deposited = 0
      let withdrawn = 0

      for (const tx of transactions) {
        const amount = parseFloat(tx.amountUsdc.toString())
        if (tx.type === 'DEPOSIT') deposited += amount
        if (tx.type === 'WITHDRAWAL') withdrawn += amount
      }

      const available = deposited - withdrawn

      return {
        depositedAmount: deposited.toFixed(2) + ' USDC',
        withdrawnAmount: withdrawn.toFixed(2) + ' USDC',
        availableBalance: available.toFixed(2) + ' USDC',
        userVaultPda: getUserVaultPda(walletAddress).toString(),
      }
    } catch (error) {
      return {
        depositedAmount: '0.00 USDC',
        withdrawnAmount: '0.00 USDC',
        availableBalance: '0.00 USDC',
        userVaultPda: '',
      }
    }
  }

  async getVaultStats(): Promise<{ totalDeposited: string, totalWithdrawn: string, tvl: string }> {
    try {
      const deposits = await prisma.transaction.aggregate({
        where: { type: 'DEPOSIT', status: { in: ['APPROVED', 'EXECUTED'] } },
        _sum: { amountUsdc: true },
      })
      const withdrawals = await prisma.transaction.aggregate({
        where: { type: 'WITHDRAWAL', status: { in: ['APPROVED', 'EXECUTED'] } },
        _sum: { amountUsdc: true },
      })

      const totalDeposited = parseFloat(deposits._sum.amountUsdc?.toString() || '0')
      const totalWithdrawn = parseFloat(withdrawals._sum.amountUsdc?.toString() || '0')
      const tvl = totalDeposited - totalWithdrawn

      return {
        totalDeposited: totalDeposited.toFixed(2) + ' USDC',
        totalWithdrawn: totalWithdrawn.toFixed(2) + ' USDC',
        tvl: tvl.toFixed(2) + ' USDC',
      }
    } catch {
      return { totalDeposited: '0.00 USDC', totalWithdrawn: '0.00 USDC', tvl: '0.00 USDC' }
    }
  }
}

export const vaultService = new VaultService();
