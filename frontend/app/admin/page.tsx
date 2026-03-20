"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import AuditLogTable from "@/components/AuditLogTable";
import Link from "next/link";

export default function AdminPage() {
  const { token, hasHydrated, walletAddress } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) router.replace('/')
  }, [hasHydrated, token, router])

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [filterAction, setFilterAction] = useState("");

  const ADMIN_WALLET = process.env.NEXT_PUBLIC_ADMIN_WALLET;

  useEffect(() => {
    if (hasHydrated && token) {
      if (walletAddress !== ADMIN_WALLET) {
        router.push("/");
        return;
      }
      fetchLogs();
    }
  }, [hasHydrated, token, walletAddress, ADMIN_WALLET, router]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const url = filterAction
        ? `/api/compliance/admin/audit-log?action=${filterAction}`
        : "/api/compliance/admin/audit-log";
      const res = await api.get(url);
      setLogs(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch admin logs", err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (logs.length === 0) return;

    const headers = ["Timestamp", "Action", "Actor", "Details"];
    const rows = logs.map(log => [
      new Date(log.createdAt).toISOString(),
      log.action,
      log.user?.walletAddress || log.actor,
      JSON.stringify(log.details).replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_log_export_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  if (!walletAddress || walletAddress !== ADMIN_WALLET) {
    return null;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f1f5f9' }}>
            Audit Log Explorer
          </h1>
          <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
            Monitor all protocol activity and compliance events
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={exportCSV}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
              background: '#0f1420', color: '#f1f5f9', border: '1px solid #1e2a3a'
            }}
          >
            Export CSV
          </button>
          <button
            onClick={fetchLogs}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
              background: '#3b82f6', color: '#fff', border: 'none'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{
        background: '#0f1420', border: '1px solid #1e2a3a',
        borderRadius: 12, padding: '20px', marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
          Filter by:
        </span>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          style={{
            background: '#080c14', border: '1px solid #1e2a3a',
            borderRadius: 6, padding: '6px 12px', color: '#f1f5f9', fontSize: 14,
            outline: 'none'
          }}
        >
          <option value="">All Actions</option>
          <option value="KYC_SUBMITTED">KYC Submitted</option>
          <option value="DEPOSIT_APPROVED">Deposit Approved</option>
          <option value="TRANSACTION_CONFIRMED">Transaction Confirmed</option>
          <option value="AUTH_SUCCESS">Auth Success</option>
        </select>
        <button
          onClick={fetchLogs}
          style={{
            padding: '6px 16px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
            background: '#1e2a3a', color: '#f1f5f9', border: 'none'
          }}
        >
          Apply
        </button>
      </div>

      <div style={{
        background: '#0f1420', border: '1px solid #1e2a3a',
        borderRadius: 12, overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
            Fetching secure logs...
          </div>
        ) : (
          <AuditLogTable logs={logs} />
        )}
      </div>
    </div>
  );
}
