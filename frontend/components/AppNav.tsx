'use client'
import { useStore } from '@/lib/store'
import { useWallet } from '@solana/wallet-adapter-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AppNav() {
  const { token, walletAddress, kycStatus, logout } = useStore()
  const wallet = useWallet()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !token) return null

  const links = [
    { href: '/vault',      label: 'Vault' },
    { href: '/portfolio',  label: 'Portfolio' },
    { href: '/onboarding', label: 'KYC Status' },
  ]

  function handleLogout() {
    logout()
    wallet.disconnect()
    window.location.href = '/'
  }

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 48px',
      height: 56,
      borderBottom: '1px solid #1e2a3a',
      background: '#080c14',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 20, height: 20, background: '#3b82f6',
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        }} />
        <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 15 }}>
          StableHacks Vault
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(link => (
          <Link key={link.href} href={link.href} style={{
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 14,
            textDecoration: 'none',
            color: pathname === link.href ? '#f1f5f9' : '#64748b',
            background: pathname === link.href ? '#1e2a3a' : 'transparent',
            fontWeight: pathname === link.href ? 500 : 400,
          }}>
            {link.label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {kycStatus === 'APPROVED' && (
          <span style={{
            fontSize: 12, color: '#10b981',
            background: '#10b98115', border: '1px solid #10b98130',
            borderRadius: 6, padding: '3px 10px',
          }}>
            KYC VERIFIED
          </span>
        )}
        <span style={{
          fontSize: 12, color: '#64748b', fontFamily: 'monospace',
        }}>
          {walletAddress
            ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
            : ''}
        </span>
        <button onClick={handleLogout} style={{
          background: 'transparent',
          border: '1px solid #1e2a3a',
          borderRadius: 8,
          color: '#64748b',
          fontSize: 13,
          padding: '6px 14px',
          cursor: 'pointer',
        }}>
          Disconnect
        </button>
      </div>
    </nav>
  )
}
