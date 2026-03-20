"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import AuditLogTable from "@/components/AuditLogTable";
import Link from "next/link";

export default function PortfolioPage() {
  const { token, hasHydrated, kycStatus } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) router.replace('/')
  }, [hasHydrated, token, router])

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'transactions' | 'compliance'>('transactions');

  useEffect(() => {
    if (hasHydrated && token) {
      const fetchData = async () => {
        try {
          const [vaultRes, logsRes] = await Promise.all([
            api.get("/api/vault/balance"),
            api.get("/api/compliance/audit-log")
          ]);
          setTransactions(vaultRes.data.transactions || []);
          setAuditLogs(logsRes.data.data || []);
        } catch (err) {
          console.error("Failed to fetch portfolio data", err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [hasHydrated, token]);

  const truncateTx = (tx: string) => `${tx.slice(0, 8)}...${tx.slice(-8)}`;

  if (!hasHydrated || !token) return (
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
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f1f5f9' }}>
          Account History
        </h1>
        <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
          Review your transactions and compliance audit logs
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24,
        background: '#0f1420', padding: 4, borderRadius: 10,
        width: 'fit-content' }}>
        <button
          onClick={() => setActiveView('transactions')}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
            background: activeView === 'transactions' ? '#1e2a3a' : 'transparent',
            color: activeView === 'transactions' ? '#f1f5f9' : '#64748b',
            border: 'none',
          }}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveView('compliance')}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
            background: activeView === 'compliance' ? '#1e2a3a' : 'transparent',
            color: activeView === 'compliance' ? '#f1f5f9' : '#64748b',
            border: 'none',
          }}
        >
          Compliance Logs
        </button>
      </div>

      <div style={{
        background: '#0f1420', border: '1px solid #1e2a3a',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {activeView === 'transactions' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e2a3a', background: '#080c14' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left',
                  fontSize: 12, color: '#64748b', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Date
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left',
                  fontSize: 12, color: '#64748b', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Type
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left',
                  fontSize: 12, color: '#64748b', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Amount
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left',
                  fontSize: 12, color: '#64748b', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left',
                  fontSize: 12, color: '#64748b', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Signature / ID
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #1e2a3a' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#94a3b8' }}>
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: tx.type === 'DEPOSIT' ? '#10b981' : '#ef4444' }}>
                    {tx.type}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>
                    {tx.amountUsdc.toFixed(2)} USDC
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: tx.status === 'EXECUTED' ? '#10b98120' : '#f59e0b20',
                      color: tx.status === 'EXECUTED' ? '#10b981' : '#f59e0b',
                      border: `1px solid ${tx.status === 'EXECUTED' ? '#10b98140' : '#f59e0b40'}`
                    }}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
                    {truncateTx(tx.solanaSignature || tx.id)}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td style={{ padding: '48px 16px', fontSize: 14, color: '#94a3b8',
                    textAlign: 'center' }} colSpan={5}>
                    No transactions recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <AuditLogTable logs={auditLogs} />
        )}
      </div>
    </div>
  );
}
