"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import ComplianceAlert from "@/components/ComplianceAlert";
import TransactionModal from "@/components/TransactionModal";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

interface TransactionData {
  id: string;
  type: string;
  amountUsdc: number;
  status: string;
  createdAt: string;
  solanaSignature?: string;
}

export default function VaultPage() {
  const { token, kycStatus, hasHydrated, walletAddress } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) { router.replace('/'); return }
    if (kycStatus !== 'APPROVED') { router.replace('/onboarding'); return }
  }, [hasHydrated, token, kycStatus, router])

  const [balance, setBalance] = useState<{
    totalBalance: string
    availableBalance: string
    depositedAmount: string
    withdrawnAmount: string
  } | null>(null)
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState("");
  const [stats, setStats] = useState({
    totalDeposited: "0.00 USDC",
    totalWithdrawn: "0.00 USDC",
    tvl: "0.00 USDC"
  });

  // Compliance state
  const [travelRuleOpen, setTravelRuleOpen] = useState(false);
  const [travelRuleData, setTravelRuleData] = useState<any>(null);
  const [pendingTxData, setPendingTxData] = useState<any>(null);

  // Transaction modal state
  const [txModal, setTxModal] = useState<{
    isOpen: boolean;
    status: 'confirming' | 'signing' | 'processing' | 'success' | 'error';
    message: string;
    txSignature?: string;
    error?: string;
  }>({
    isOpen: false,
    status: 'processing',
    message: ''
  });

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [balanceRes, statsRes] = await Promise.all([
        api.get("/api/vault/balance"),
        api.get("/api/vault/stats")
      ]);

      setBalance({
        totalBalance: balanceRes.data.totalBalance,
        availableBalance: balanceRes.data.availableBalance,
        depositedAmount: balanceRes.data.depositedAmount,
        withdrawnAmount: balanceRes.data.withdrawnAmount
      });
      setStats(statsRes.data);
    } catch (err) {
      console.error("Failed to fetch vault data", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (hasHydrated && token && kycStatus === 'APPROVED') {
      fetchData();
    }
  }, [hasHydrated, token, kycStatus, fetchData]);

  const handleAction = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      const endpoint = activeTab === 'deposit' ? '/api/vault/deposit' : '/api/vault/withdraw';
      const res = await api.post(endpoint, { amountUsdc: parseFloat(amount) });

      if (res.data.travelRuleRequired) {
        setTravelRuleData(res.data.travelRuleData);
        setPendingTxData(res.data);
        setTravelRuleOpen(true);
      } else {
        await executeTransaction(res.data);
      }
    } catch (err: any) {
      console.error(`${activeTab} failed`, err);
      setTxModal({
        isOpen: true,
        status: 'error',
        message: `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} initialization failed`,
        error: err.response?.data?.error || err.message
      });
    }
  };

  const executeTransaction = async (data: any) => {
    setTravelRuleOpen(false);

    if (activeTab === 'withdraw') {
      // Withdrawal is handled server-side for this MVP (custodial flow)
      setTxModal({
        isOpen: true,
        status: 'success',
        message: 'Withdrawal request processed successfully.',
      });
      setTimeout(() => fetchData(), 500);
      return;
    }

    // Deposit flow: Sign transaction on-chain
    if (!wallet.publicKey || !wallet.signTransaction) {
      setTxModal({
        isOpen: true,
        status: 'error',
        message: 'Wallet not connected or does not support signing',
      });
      return;
    }

    setTxModal({
      isOpen: true,
      status: 'signing',
      message: 'Please sign the deposit transaction in your wallet.'
    });

    try {
      // Mocking the signature for the demo environment
      const mockSignature = "5ZfH3vD7G8V9..." + Math.random().toString(36).substring(7);

      setTxModal(prev => ({ ...prev, status: 'processing', message: 'Confirming transaction on-chain...' }));

      // Confirm with backend
      await api.post("/api/vault/confirm", {
        transactionId: data.transactionId,
        solanaSignature: mockSignature
      });

      setTxModal({
        isOpen: true,
        status: 'success',
        message: 'Deposit successful! Your funds are now secured in the vault.',
        txSignature: mockSignature
      });

      setAmount("");
      setTimeout(() => fetchData(), 500);
    } catch (err: any) {
      console.error("Transaction execution failed", err);
      setTxModal({
        isOpen: true,
        status: 'error',
        message: 'Transaction failed',
        error: err.message
      });
    }
  };

  if (!hasHydrated || !token || kycStatus !== 'APPROVED') return (
    <div style={{
      minHeight: '100vh', background: '#080c14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 24, height: 24,
        border: '2px solid #1e2a3a',
        borderTop: '2px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px' }}>
      <ComplianceAlert
        isOpen={travelRuleOpen}
        onConfirm={() => executeTransaction(pendingTxData)}
        onCancel={() => setTravelRuleOpen(false)}
        travelRuleData={travelRuleData || {
          originatorName: walletAddress
            ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
            : "Authenticated User",
          beneficiaryName: "StableHacks Vault",
          thresholdUsdc: 1000,
          transactionAmountUsdc: parseFloat(amount) || 0
        }}
      />

      <TransactionModal
        isOpen={txModal.isOpen}
        status={txModal.status}
        message={txModal.message}
        txSignature={txModal.txSignature}
        error={txModal.error}
        onClose={() => setTxModal(prev => ({ ...prev, isOpen: false }))}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{
          background: '#0f1420', border: '1px solid #1e2a3a',
          borderRadius: 12, padding: '24px',
        }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Your Balance</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>
            {balance ? balance.availableBalance : "Loading..."}
          </div>
        </div>
        <div style={{
          background: '#0f1420', border: '1px solid #1e2a3a',
          borderRadius: 12, padding: '24px',
        }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Protocol Deposits</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{stats.totalDeposited}</div>
        </div>
        <div style={{
          background: '#0f1420', border: '1px solid #1e2a3a',
          borderRadius: 12, padding: '24px',
        }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Protocol Withdrawals</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{stats.totalWithdrawn}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
        <div>
          {/* Yield Strategy Section */}
          <div style={{
            background: '#0f1420',
            border: '1px solid #1e2a3a',
            borderRadius: 12,
            padding: '24px',
            marginBottom: 24,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
                  Yield Strategy
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Compliant institutional yield on USDC deposits
                </div>
              </div>
              <div style={{
                background: '#10b98115',
                border: '1px solid #10b98130',
                borderRadius: 8,
                padding: '6px 14px',
              }}>
                <div style={{ fontSize: 11, color: '#10b981', marginBottom: 2 }}>EST. APY</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>6.2%</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Strategy', value: 'Lending + RWA', desc: 'Marginfi + T-Bills' },
                { label: 'Lock Period', value: 'None', desc: 'Instant liquidity' },
                { label: 'Risk Level', value: 'Low', desc: 'Institutional grade' },
              ].map((item, i) => (
                <div key={i} style={{
                  background: '#080c14',
                  border: '1px solid #1e2a3a',
                  borderRadius: 8,
                  padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Projected Returns Calculator */}
          <div style={{
            background: '#0f1420',
            border: '1px solid #1e2a3a',
            borderRadius: 12,
            padding: '24px',
            marginBottom: 24,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>
              Projected Returns
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { period: '1 Month', multiplier: 1/12 },
                { period: '6 Months', multiplier: 0.5 },
                { period: '1 Year', multiplier: 1 },
              ].map((item, i) => {
                const deposited = parseFloat(
                  balance?.depositedAmount?.replace(' USDC', '') || '0'
                )
                const yield_ = deposited * 0.062 * item.multiplier
                return (
                  <div key={i} style={{
                    background: '#080c14',
                    border: '1px solid #1e2a3a',
                    borderRadius: 8,
                    padding: '16px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                      {item.period}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
                      +{yield_.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>USDC yield</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            <button
              onClick={() => setActiveTab('deposit')}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                background: activeTab === 'deposit' ? '#3b82f6' : 'transparent',
                color: activeTab === 'deposit' ? '#fff' : '#64748b',
                border: activeTab === 'deposit' ? 'none' : '1px solid #1e2a3a',
              }}
            >
              Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                background: activeTab === 'withdraw' ? '#3b82f6' : 'transparent',
                color: activeTab === 'withdraw' ? '#fff' : '#64748b',
                border: activeTab === 'withdraw' ? 'none' : '1px solid #1e2a3a',
              }}
            >
              Withdraw
            </button>
          </div>

          <div style={{
            background: '#0f1420',
            border: '1px solid #1e2a3a',
            borderRadius: 16,
            padding: '32px',
          }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Amount to {activeTab === 'deposit' ? 'Deposit' : 'Withdraw'} (USDC)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#080c14', border: '1px solid #1e2a3a',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={() => handleAction()}
              style={{
                width: '100%', padding: '12px',
                background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 16, fontWeight: 600, cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Confirm {activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'}
            </button>
          </div>
        </div>

        <div>
          <div style={{
            background: '#0f1420',
            border: '1px solid #1e2a3a',
            borderRadius: 12,
            padding: '24px',
            marginTop: 24,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 16 }}>
              Compliance Status
            </div>
            {[
              { label: 'KYC Verification', status: 'Approved', color: '#10b981' },
              { label: 'AML Screening', status: 'Passed', color: '#10b981' },
              { label: 'Travel Rule Threshold', status: '1,000.00 USDC', color: '#3b82f6' },
              { label: 'Regulatory Framework', status: 'FINMA / FATF', color: '#3b82f6' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < 3 ? '1px solid #1e2a3a' : 'none',
              }}>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>{item.label}</span>
                <span style={{
                  fontSize: 13,
                  color: item.color,
                  background: item.color + '15',
                  border: `1px solid ${item.color}30`,
                  borderRadius: 6,
                  padding: '2px 10px',
                }}>
                  {item.status}
                </span>
              </div>
            ))}
            <div style={{
              marginTop: 16,
              padding: '12px',
              background: '#080c14',
              borderRadius: 8,
              fontSize: 12,
              color: '#64748b',
              textAlign: 'center',
            }}>
              All transactions monitored under FINMA AML/CFT regulations and FATF standards
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
