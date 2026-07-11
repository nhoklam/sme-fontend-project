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

  // [NEW] Promotion
  promotionCode: string;
  promotionDiscount: number; // số tiền giảm thực tế (sau khi validate từ API)

  // Saved cart (F2 hold)
  savedCart: CartItem[] | null;

  // Cart actions
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  updateUnitPrice: (productId: string, unitPrice: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setPointsToUse: (pts: number) => void;
  setNote: (note: string) => void;

  // [NEW] Promotion actions
  setPromotion: (code: string, discount: number) => void;
  clearPromotion: () => void;

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
      // [NEW]
      promotionCode: '',
      promotionDiscount: 0,
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
        if (quantity <= 0) { get().removeItem(productId); return; }
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

      updateUnitPrice: (productId, unitPrice) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId
              ? { ...i, unitPrice, subtotal: unitPrice * i.quantity }
              : i
          ),
        }));
      },

      setCustomer: (customer) => set({ customer, pointsToUse: 0 }),
      setPointsToUse: (pts) => set({ pointsToUse: pts }),
      setNote: (note) => set({ note }),

      // [NEW] Promotion
      setPromotion: (code, discount) => set({ promotionCode: code, promotionDiscount: discount }),
      clearPromotion: () => set({ promotionCode: '', promotionDiscount: 0 }),

      clearCart: () => set({
        items: [], customer: null, pointsToUse: 0, note: '',
        // [NEW] clear promotion on checkout success
        promotionCode: '', promotionDiscount: 0,
      }),

      holdCart: () => {
        const { items } = get();
        if (items.length > 0) {
          set({
            savedCart: [...items], items: [], customer: null,
            pointsToUse: 0, note: '',
            promotionCode: '', promotionDiscount: 0,
          });
        }
      },

      recallCart: () => {
        const { savedCart } = get();
        if (savedCart) set({ items: savedCart, savedCart: null });
      },

      totalAmount: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

      // [UPDATED] discount = promotionDiscount + loyaltyDiscount (điểm * 100)
      discountAmount: () => {
        const loyaltyDisc = get().pointsToUse * 100; // 100đ/điểm theo config mặc định
        return get().promotionDiscount + loyaltyDisc;
      },

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
        // Không persist promotion — yêu cầu nhập lại mỗi phiên
      }),
    }
  )
);
