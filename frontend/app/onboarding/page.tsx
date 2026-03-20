"use client";

import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Link from "next/link";

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'SG', name: 'Singapore' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'JP', name: 'Japan' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'VG', name: 'British Virgin Islands' },
];

export default function Onboarding() {
  const { token, hasHydrated, kycStatus, setKycStatus } = useStore()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) router.replace('/')
  }, [hasHydrated, token, router])

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    nationality: "CH",
    documentType: "PASSPORT",
    documentNumber: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post("/api/kyc/submit", formData);
      setKycStatus(res.data.status);
      if (res.data.status === 'APPROVED') {
        setSuccess(true);
      } else {
        setError(`KYC Rejected: ${res.data.rejectionReason || 'Compliance criteria not met'}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit KYC");
    } finally {
      setSubmitting(false);
    }
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

  const status = kycStatus || 'NOT STARTED';

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 48px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: '#f1f5f9' }}>
          Identity Verification
        </h1>
        <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
          Required for institutional access under AML/KYC regulations
        </p>
      </div>

      <div style={{
        display: 'inline-block',
        padding: '4px 12px', borderRadius: 6, fontSize: 13,
        background: status === 'APPROVED' ? '#10b98120' : '#f59e0b20',
        color: status === 'APPROVED' ? '#10b981' : '#f59e0b',
        border: `1px solid ${status === 'APPROVED' ? '#10b98140' : '#f59e0b40'}`,
        marginBottom: 24,
      }}>
        {status}
      </div>

      {success || status === 'APPROVED' ? (
        <div style={{
          background: '#0f1420',
          border: '1px solid #1e2a3a',
          borderRadius: 16,
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>
            Verification Successful
          </div>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 24 }}>
            Your identity has been verified and your account is now authorized for institutional transactions.
          </p>
          <Link href="/vault" style={{
            display: 'block', width: '100%', padding: '12px',
            background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
            textAlign: 'center', textDecoration: 'none'
          }}>
            Proceed to Vault
          </Link>
        </div>
      ) : (
        <div style={{
          background: '#0f1420',
          border: '1px solid #1e2a3a',
          borderRadius: 16,
          padding: '32px',
        }}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                background: '#ef444420', border: '1px solid #ef444440',
                padding: '12px', borderRadius: 8, color: '#ef4444',
                fontSize: 14, marginBottom: 20
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Full Legal Name
              </label>
              <input
                required
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#080c14', border: '1px solid #1e2a3a',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="John Doe"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Date of Birth
              </label>
              <input
                required
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#080c14', border: '1px solid #1e2a3a',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Nationality
              </label>
              <select
                required
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#080c14', border: '1px solid #1e2a3a',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Document Type
              </label>
              <select
                required
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#080c14', border: '1px solid #1e2a3a',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                }}
              >
                <option value="PASSPORT">Passport</option>
                <option value="ID_CARD">National ID Card</option>
                <option value="DRIVERS_LICENSE">Driver's License</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
                Document Number
              </label>
              <input
                required
                type="text"
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px',
                  background: '#080c14', border: '1px solid #1e2a3a',
                  borderRadius: 8, color: '#f1f5f9', fontSize: 15,
                  outline: 'none', boxSizing: 'border-box',
                }}
                placeholder="E.g. X1234567"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px',
                background: '#3b82f6', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 16, fontWeight: 600, cursor: 'pointer',
                marginTop: 8,
              }}
            >
              {submitting ? "Verifying..." : "Submit Verification"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
