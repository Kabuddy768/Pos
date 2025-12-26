import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useProductStore } from '@/stores/productStore';
import { useCartStore } from '@/stores/cartStore';
import { supabase } from '@/lib/supabase';
import { CartItem, Product } from '@/lib/types';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { SearchBar } from '@/components/common/SearchBar';
import { Plus, Minus, Trash2, Check } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';

export const POS = () => {
  const { profile } = useAuthStore();
  const { products, fetchProducts } = useProductStore();
  const {
    items,
    discountPercentage,
    taxPercentage,
    addItem,
    updateItemQuantity,
    removeItem,
    setDiscount,
    setTax,
    clear,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
  } = useCartStore();

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedCategory, _setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = products.filter((p) => p.is_active && p.quantity > 0);

    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, searchQuery, selectedCategory]);

  const handleAddToCart = (product: Product) => {
    if (product.quantity > 0) {
      const cartItem: CartItem = {
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        quantity: 1,
        unit_price: product.selling_price,
        cost_price: product.purchase_price,
      };
      addItem(cartItem);
    }
  };

  const handleProcessPayment = async () => {
    if (items.length === 0) {
      alert('Cart is empty');
      return;
    }

    setProcessingPayment(true);
    try {
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            seller_id: profile?.id,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            subtotal: getSubtotal(),
            discount_amount: getDiscountAmount(),
            discount_percentage: discountPercentage,
            // tax_amount: getTaxAmount(),
            // tax_percentage: taxPercentage,
            total_amount: getTotal(),
            payment_method: paymentMethod,
            payment_reference: paymentReference || null,
          },
        ])
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = items.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.unit_price * item.quantity,
        cost_price: item.cost_price,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      alert(`Sale #${sale.transaction_number} completed successfully!`);

      clear();
      setPaymentMethod('cash');
      setPaymentReference('');
      setCustomerName('');
      setCustomerPhone('');
      setDiscount(0);
      setTax(0);
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Payment error:', error);
      alert('Failed to process payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-4">
          <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
        </div>

        <div className="flex-1 overflow-hidden flex gap-4 p-4">
          <div className="flex-1 flex flex-col overflow-hidden">
            <SearchBar
              onSearch={(q) => setSearchQuery(q)}
              placeholder="Search products..."
            />

            <div className="mt-4 overflow-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddToCart(product)}
                    disabled={product.quantity === 0}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-gray-600">{product.sku}</p>
                    <p className="text-lg font-bold text-blue-600 mt-2">
                      {formatCurrency(product.selling_price)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Stock: {product.quantity}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="w-96 bg-white rounded-lg shadow p-4 flex flex-col overflow-hidden">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Shopping Cart</h2>

            <div className="flex-1 overflow-auto mb-4 border border-gray-200 rounded-lg p-3">
              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Cart is empty</p>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.product_id} className="border border-gray-200 rounded p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{item.product_name}</p>
                          <p className="text-xs text-gray-600">{item.product_sku}</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateItemQuantity(item.product_id, item.quantity - 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateItemQuantity(item.product_id, item.quantity + 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold">{formatCurrency(getSubtotal())}</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 flex-1">Discount %:</label>
                <input
                  type="number"
                  value={discountPercentage}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  min="0"
                  max="100"
                />
              </div>

              {discountPercentage > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(getDiscountAmount())}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 flex-1">Tax %:</label>
                <input
                  type="number"
                  value={taxPercentage}
                  onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  min="0"
                />
              </div>

              {taxPercentage > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-semibold">{formatCurrency(getTaxAmount())}</span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold bg-blue-50 p-2 rounded">
                <span>Total:</span>
                <span className="text-blue-600">{formatCurrency(getTotal())}</span>
              </div>
            </div>

            <Button
              onClick={() => setShowPaymentModal(true)}
              variant="success"
              size="lg"
              className="w-full mb-2"
              disabled={items.length === 0}
            >
              <Check size={20} className="mr-2" />
              Complete Sale
            </Button>

            <Button
              onClick={() => {
                clear();
                setDiscount(0);
                setTax(0);
              }}
              variant="secondary"
              size="lg"
              className="w-full"
            >
              Clear Cart
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showPaymentModal}
        title="Complete Payment"
        onClose={() => setShowPaymentModal(false)}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Customer Name (Optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="John Doe"
          />

          <Input
            label="Customer Phone (Optional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+254 712 345 678"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="card">Card</option>
            </select>
          </div>

          <Input
            label="Payment Reference"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g., M-Pesa code or Card reference"
          />

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Amount:</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(getTotal())}</p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleProcessPayment}
              variant="success"
              size="lg"
              isLoading={processingPayment}
              className="flex-1"
            >
              Process Payment
            </Button>
            <Button
              onClick={() => setShowPaymentModal(false)}
              variant="secondary"
              size="lg"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
