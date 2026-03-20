"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import { handleWalletAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic'

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

export default function WalletConnect() {
  const wallet = useWallet();
  const { walletAddress, token, logout } = useStore();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (wallet.connected && !token && !loading) {
      setLoading(true);
      handleWalletAuth(wallet)
        .catch((err) => {
          console.error("Auth failed", err);
          wallet.disconnect();
        })
        .finally(() => setLoading(false));
    }
  }, [wallet.connected, token, loading, wallet]);

  // Handle logout if wallet disconnects
  useEffect(() => {
    if (!wallet.connected && token) {
      logout();
      router.push("/");
    }
  }, [wallet.connected, token, logout, router]);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!wallet.connected) {
    return (
      <WalletMultiButton className="!bg-primary hover:!bg-blue-600 !transition-colors !rounded-md !px-6 !py-2 !h-auto !font-medium" />
    );
  }

  if (loading) {
    return (
      <button disabled className="bg-card border border-border px-6 py-2 rounded-md text-sm font-mono animate-pulse">
        AUTHENTICATING...
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {walletAddress && (
        <span className="font-mono text-sm text-gray-400 bg-card px-3 py-1 rounded border border-border">
          {truncateAddress(walletAddress)}
        </span>
      )}
      <button
        onClick={() => wallet.disconnect()}
        className="text-sm text-danger hover:underline font-medium"
      >
        Disconnect
      </button>
    </div>
  );
}
