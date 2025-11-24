import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Product, Category, Supplier } from '@/lib/types';

interface ProductState {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchSuppliers: () => Promise<void>;
  createProduct: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  createCategory: (name: string, description?: string) => Promise<Category>;
  createSupplier: (supplier: Omit<Supplier, 'id' | 'created_at'>) => Promise<Supplier>;
  searchProducts: (query: string) => Product[];
  clearError: () => void;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  suppliers: [],
  loading: false,
  error: null,

  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ products: data || [] });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch products' });
    } finally {
      set({ loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ categories: data || [] });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch categories' });
    }
  },

  fetchSuppliers: async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      set({ suppliers: data || [] });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch suppliers' });
    }
  },

  createProduct: async (product) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ products: [...state.products, data] }));
      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create product');
    }
  },

  updateProduct: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      set((state) => ({
        products: state.products.map((p) => (p.id === id ? data : p)),
      }));
      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update product');
    }
  },

  deleteProduct: async (id) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      }));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete product');
    }
  },

  createCategory: async (name, description) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name, description }])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ categories: [...state.categories, data] }));
      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create category');
    }
  },

  createSupplier: async (supplier) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([supplier])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({ suppliers: [...state.suppliers, data] }));
      return data;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create supplier');
    }
  },

  searchProducts: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().products.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery) ||
        p.description?.toLowerCase().includes(lowerQuery)
    );
  },

  clearError: () => set({ error: null }),
}));
