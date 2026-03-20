import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import WalletProviderWrapper from '@/components/WalletProviderWrapper'
import AppNav from '@/components/AppNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'StableHacks Vault',
  description: 'Institutional Permissioned DeFi Vault on Solana',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ margin: 0, background: '#080c14' }}>
        <WalletProviderWrapper>
          <AppNav />
          {children}
        </WalletProviderWrapper>
      </body>
    </html>
  )
}
