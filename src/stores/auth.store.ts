import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserResponse, UserRole } from '@/types';

interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  setAuth: (user: UserResponse, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<UserResponse>) => void;

  // Computed helpers
  isAdmin: () => boolean;
  isManager: () => boolean;
  isCashier: () => boolean;
  warehouseId: () => string | undefined;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      clearAuth: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      updateUser: (partial) =>
        set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),

      isAdmin:   () => get().user?.role === 'ROLE_ADMIN',
      isManager: () => get().user?.role === 'ROLE_MANAGER',
      isCashier: () => get().user?.role === 'ROLE_CASHIER',
      warehouseId: () => get().user?.warehouseId,
    }),
    {
      name: 'sme-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
