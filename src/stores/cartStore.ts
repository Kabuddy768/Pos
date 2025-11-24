import { create } from 'zustand';
import { CartItem } from '@/lib/types';

interface CartState {
  items: CartItem[];
  discountPercentage: number;
  taxPercentage: number;
  addItem: (item: CartItem) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  setDiscount: (percentage: number) => void;
  setTax: (percentage: number) => void;
  clear: () => void;
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discountPercentage: 0,
  taxPercentage: 0,

  addItem: (item: CartItem) => {
    set((state) => {
      const existingItem = state.items.find((i) => i.product_id === item.product_id);
      if (existingItem) {
        return {
          items: state.items.map((i) =>
            i.product_id === item.product_id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          ),
        };
      }
      return { items: [...state.items, item] };
    });
  },

  updateItemQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.product_id === productId ? { ...item, quantity } : item
      ),
    }));
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product_id !== productId),
    }));
  },

  setDiscount: (percentage: number) => {
    set({ discountPercentage: Math.min(100, Math.max(0, percentage)) });
  },

  setTax: (percentage: number) => {
    set({ taxPercentage: Math.max(0, percentage) });
  },

  clear: () => {
    set({
      items: [],
      discountPercentage: 0,
      taxPercentage: 0,
    });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    return (subtotal * get().discountPercentage) / 100;
  },

  getTaxAmount: () => {
    const subtotal = get().getSubtotal();
    const afterDiscount = subtotal - get().getDiscountAmount();
    return (afterDiscount * get().taxPercentage) / 100;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    const tax = get().getTaxAmount();
    return subtotal - discount + tax;
  },
}));
