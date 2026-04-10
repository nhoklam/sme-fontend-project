import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, CartPayment, Customer, ShiftResponse } from '@/types';

interface POSState {
  // Active shift
  currentShift: ShiftResponse | null;
  setCurrentShift: (shift: ShiftResponse | null) => void;

  // Cart
  items: CartItem[];
  customer: Customer | null;
  pointsToUse: number;
  note: string;

  // Saved cart (F2 hold)
  savedCart: CartItem[] | null;

  // Cart actions
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setPointsToUse: (pts: number) => void;
  setNote: (note: string) => void;
  clearCart: () => void;
  holdCart: () => void;
  recallCart: () => void;

  // Computed
  totalAmount: () => number;
  discountAmount: () => number;
  finalAmount: () => number;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      currentShift: null,
      items: [],
      customer: null,
      pointsToUse: 0,
      note: '',
      savedCart: null,

      setCurrentShift: (shift) => set({ currentShift: shift }),

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === newItem.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === newItem.productId
                  ? { ...i, quantity: i.quantity + 1, subtotal: i.unitPrice * (i.quantity + 1) }
                  : i
              ),
            };
          }
          return { items: [...state.items, newItem] };
        });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId
              ? { ...i, quantity, subtotal: i.unitPrice * quantity }
              : i
          ),
        }));
      },

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),

      setCustomer: (customer) => set({ customer, pointsToUse: 0 }),

      setPointsToUse: (pts) => set({ pointsToUse: pts }),

      setNote: (note) => set({ note }),

      clearCart: () => set({ items: [], customer: null, pointsToUse: 0, note: '' }),

      holdCart: () => {
        const { items } = get();
        if (items.length > 0) {
          set({ savedCart: [...items], items: [], customer: null, pointsToUse: 0, note: '' });
        }
      },

      recallCart: () => {
        const { savedCart } = get();
        if (savedCart) {
          set({ items: savedCart, savedCart: null });
        }
      },

      totalAmount: () =>
        get().items.reduce((sum, i) => sum + i.subtotal, 0),

      discountAmount: () => get().pointsToUse * 100,

      finalAmount: () => {
        const total = get().totalAmount();
        const discount = get().discountAmount();
        return Math.max(0, total - discount);
      },
    }),
    {
      name: 'sme-pos-cart',
      partialize: (state) => ({
        currentShift: state.currentShift,
        items: state.items,
        savedCart: state.savedCart,
        customer: state.customer,
        pointsToUse: state.pointsToUse,
        note: state.note,
      }),
    }
  )
);
