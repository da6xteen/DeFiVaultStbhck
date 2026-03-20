'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense, useState } from 'react'

const WalletMultiButton = dynamic(
  async () => {
    const { WalletMultiButton } = await import(
      '@solana/wallet-adapter-react-ui'
    )
    return { default: WalletMultiButton }
  },
  { ssr: false, loading: () => (
    <button style={{
      background: '#3b82f6', color: '#fff', border: 'none',
      borderRadius: 8, padding: '10px 20px', fontSize: 14,
      cursor: 'wait', fontFamily: 'inherit',
    }}>
      Loading...
    </button>
  )}
)
import { useStore } from '@/lib/store'

export default function LandingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LandingPageContent />
    </Suspense>
  )
}

function LandingPageContent() {
  const { token, kycStatus, hasHydrated, setToken, setUser, setKycStatus }
    = useStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authLoading, setAuthLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (!hasHydrated) return
    if (token) {
      router.replace(kycStatus === 'APPROVED' ? '/vault' : '/onboarding')
    }
  }, [hasHydrated, token, kycStatus, router])

  const isDemo = searchParams.get('demo') === 'true'

  return <InnerLandingPage
    mounted={mounted}
    token={token}
    hasHydrated={hasHydrated}
    kycStatus={kycStatus}
    authLoading={authLoading}
    setAuthLoading={setAuthLoading}
    setToken={setToken}
    setUser={setUser}
    setKycStatus={setKycStatus}
    API={API}
    router={router}
    isDemo={isDemo}
  />
}

function InnerLandingPage({
  mounted, token, hasHydrated, kycStatus, authLoading, setAuthLoading,
  setToken, setUser, setKycStatus, API, router, isDemo
}: any) {
  const [wallet, setWallet] = useState<any>(null)
  const walletContext = useWallet()

  useEffect(() => {
    if (mounted) {
      setWallet(walletContext)
    }
  }, [mounted, walletContext])

  // Run auth when wallet connects
  useEffect(() => {
    if (!mounted || !wallet || !wallet.connected || !wallet.publicKey || token || authLoading) return

    async function authenticate() {
      setAuthLoading(true)
      try {
        const walletAddress = wallet.publicKey!.toString()

        // Get nonce
        const nonceRes = await fetch(`${API}/api/auth/nonce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        })
        const { message } = await nonceRes.json()

        // Sign message
        const encoded = new TextEncoder().encode(message)
        const signature = await wallet.signMessage!(encoded)
        const sigBase58 = Buffer.from(signature).toString('base64')

        // Verify and get JWT
        const verifyRes = await fetch(`${API}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, signature: sigBase58 }),
        })
        const data = await verifyRes.json()

        if (data.token) {
          setToken(data.token)
          setUser(data.userId, walletAddress)

          // Fetch KYC status
          const kycRes = await fetch(`${API}/api/kyc/status`, {
            headers: { Authorization: `Bearer ${data.token}` },
          })
          const kyc = await kycRes.json()
          setKycStatus(kyc.status || 'NOT_SUBMITTED')

          router.replace(
            kyc.status === 'APPROVED' ? '/vault' : '/onboarding'
          )
        }
      } catch (err) {
        console.error('Auth failed:', err)
      } finally {
        setAuthLoading(false)
      }
    }

    authenticate()
  }, [mounted, wallet, token, authLoading, API, setToken, setUser, setKycStatus, router])

  if (!mounted || (hasHydrated && token)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080c14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 32, height: 32, border: '2px solid #1e2a3a',
          borderTop: '2px solid #3b82f6', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <span style={{ color: '#64748b', fontSize: 14 }}>Loading...</span>
      </div>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#080c14',
      color: '#f1f5f9',
      fontFamily: "'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Nav */}
      <nav style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 48px',
        borderBottom: '1px solid #1e2a3a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32, background: '#3b82f6',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          }} />
          <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' }}>
            StableHacks Vault
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 12, color: '#10b981', background: '#10b98115',
            border: '1px solid #10b98130', borderRadius: 6,
            padding: '4px 10px', letterSpacing: '0.05em',
          }}>
            DEVNET
          </span>
          <WalletMultiButton style={{
            background: '#3b82f6',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            padding: '10px 20px',
            height: 'auto',
            fontFamily: 'inherit',
          }} />
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px',
        gap: 32,
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#3b82f610', border: '1px solid #3b82f630',
          borderRadius: 20, padding: '6px 16px',
          fontSize: 13, color: '#93c5fd',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
          StableHacks 2026 — Institutional Permissioned DeFi Vaults
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          maxWidth: 800,
          margin: 0,
        }}>
          Institutional DeFi<br />
          <span style={{ color: '#3b82f6' }}>on Solana</span>
        </h1>

        <p style={{
          fontSize: 18, color: '#94a3b8', maxWidth: 560,
          lineHeight: 1.7, margin: 0,
        }}>
          The first permissioned liquidity vault with built-in KYC, AML screening,
          and FATF Travel Rule compliance — built for regulated institutions.
        </p>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <WalletMultiButton style={{
            background: '#3b82f6',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            padding: '14px 32px',
            height: 'auto',
            fontFamily: 'inherit',
            letterSpacing: '-0.01em',
          }} />
          <a href="https://github.com" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: '1px solid #1e2a3a',
            borderRadius: 10, padding: '14px 32px',
            color: '#94a3b8', fontSize: 16, textDecoration: 'none',
            fontWeight: 500,
          }}>
            View on GitHub
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 0,
        borderTop: '1px solid #1e2a3a',
        borderBottom: '1px solid #1e2a3a',
      }}>
        {[
          { label: 'Compliance Layers', value: '4' },
          { label: 'Travel Rule Threshold', value: '$1,000' },
          { label: 'Network', value: 'Solana' },
          { label: 'Settlement', value: 'USDC' },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1, maxWidth: 200,
            padding: '28px 24px',
            textAlign: 'center',
            borderRight: i < 3 ? '1px solid #1e2a3a' : 'none',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <section style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 20,
        padding: '64px 48px',
        flexWrap: 'wrap',
      }}>
        {[
          {
            icon: '◈',
            title: 'Full Compliance',
            desc: 'Integrated AML/KYC and FATF Travel Rule reporting for every transaction.',
            color: '#3b82f6',
          },
          {
            icon: '◉',
            title: 'Institutional Security',
            desc: 'Non-custodial smart contracts with rigorous on-chain permissioning via KYC PDA.',
            color: '#10b981',
          },
          {
            icon: '◆',
            title: 'Solana Speed',
            desc: 'High-throughput, low-latency settlement with USDC on Solana Devnet.',
            color: '#f59e0b',
          },
        ].map((f, i) => (
          <div key={i} style={{
            background: '#0f1420',
            border: '1px solid #1e2a3a',
            borderRadius: 16,
            padding: '32px',
            maxWidth: 320,
            flex: '1 1 280px',
          }}>
            <div style={{
              fontSize: 28, color: f.color,
              marginBottom: 16, lineHeight: 1,
            }}>
              {f.icon}
            </div>
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 10 }}>
              {f.title}
            </div>
            <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>
              {f.desc}
            </div>
          </div>
        ))}
      </section>

      {/* Judges Section */}
      {isDemo && (
        <section style={{
          padding: '64px 48px',
          borderTop: '1px solid #1e2a3a',
          background: '#0f172a50',
        }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#3b82f6' }}>
              For Judges: Test Environment
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
              {/* Credentials */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#94a3b8' }}>
                  Test Credentials
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #1e2a3a' }}>
                      <th style={{ padding: '12px 0', color: '#64748b', fontWeight: 500 }}>Scenario</th>
                      <th style={{ padding: '12px 0', color: '#64748b', fontWeight: 500 }}>Input</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1e2a3a' }}>
                      <td style={{ padding: '12px 0' }}>Approved KYC</td>
                      <td style={{ padding: '12px 0', fontFamily: 'monospace', color: '#10b981' }}>doc: VALID123, nat: DE</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e2a3a' }}>
                      <td style={{ padding: '12px 0' }}>Rejected (Sanctions)</td>
                      <td style={{ padding: '12px 0', fontFamily: 'monospace', color: '#ef4444' }}>nat: IR</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e2a3a' }}>
                      <td style={{ padding: '12px 0' }}>Rejected (High Risk)</td>
                      <td style={{ padding: '12px 0', fontFamily: 'monospace', color: '#ef4444' }}>doc: REJECT999</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e2a3a' }}>
                      <td style={{ padding: '12px 0' }}>Blocked Wallet</td>
                      <td style={{ padding: '12px 0', fontFamily: 'monospace', color: '#ef4444' }}>"DIRTY..." prefix</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Quick Links & Health */}
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#94a3b8' }}>
                  Demo Flows
                </h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
                  {['Onboarding', 'Vault', 'Portfolio', 'Admin'].map(flow => (flow === 'Admin' ? (
                    <button
                      key={flow}
                      onClick={() => router.push('/admin')}
                      style={{
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 6, padding: '8px 16px', color: '#f1f5f9',
                        fontSize: 13, cursor: 'pointer'
                      }}
                    >
                      {flow}
                    </button>
                  ) : (
                    <button
                      key={flow}
                      onClick={() => router.push(`/${flow.toLowerCase()}`)}
                      style={{
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 6, padding: '8px 16px', color: '#f1f5f9',
                        fontSize: 13, cursor: 'pointer'
                      }}
                    >
                      {flow}
                    </button>
                  )))}
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#94a3b8' }}>
                  System Health
                </h3>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API}/health`);
                      const data = await res.json();
                      alert(JSON.stringify(data, null, 2));
                    } catch (e) {
                      alert('Error fetching health: ' + e);
                    }
                  }}
                  style={{
                    background: '#3b82f6', border: 'none',
                    borderRadius: 6, padding: '10px 20px', color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Run Compliance Health Check
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '24px',
        borderTop: '1px solid #1e2a3a',
        color: '#334155',
        fontSize: 12,
        letterSpacing: '0.08em',
      }}>
        © 2026 STABLEHACKS VAULT PROTOCOL • FINMA COMPLIANT STABLECOIN INFRASTRUCTURE
      </footer>
    </main>
  )
}
