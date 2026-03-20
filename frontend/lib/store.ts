import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreState {
  token: string | null
  userId: string | null
  walletAddress: string | null
  kycStatus: string | null
  hasHydrated: boolean
  setToken: (token: string | null) => void
  setKycStatus: (status: string | null) => void
  setUser: (userId: string | null, walletAddress: string | null) => void
  setHasHydrated: (val: boolean) => void
  logout: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      walletAddress: null,
      kycStatus: null,
      hasHydrated: false,
      setToken: (token) => {
        if (token) {
          localStorage.setItem('vault_token', token);
        } else {
          localStorage.removeItem('vault_token');
        }
        set({ token });
      },
      setKycStatus: (kycStatus) => set({ kycStatus }),
      setUser: (userId, walletAddress) => set({ userId, walletAddress }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      logout: () => {
        localStorage.removeItem('vault_token');
        set({
          token: null,
          userId: null,
          walletAddress: null,
          kycStatus: null,
        });
      },
    }),
    {
      name: 'stablehacks-auth',
      partialize: (state) => ({
        token: state.token,
        userId: state.userId,
        walletAddress: state.walletAddress,
        kycStatus: state.kycStatus,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
