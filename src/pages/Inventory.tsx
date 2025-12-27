import { useEffect, useState } from 'react';
import { useProductStore } from '@/stores/productStore';
import { useAuthStore } from '@/stores/authStore';
import { Product } from '@/lib/types';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { SearchBar } from '@/components/common/SearchBar';
import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { AddCategoryModal, AddSupplierModal } from '@/components/inventory/CategorySupplierModals';

export const Inventory = () => {
  const { profile } = useAuthStore();
  const {
    products,
    categories,
    suppliers,
    loading,
    fetchProducts,
    fetchCategories,
    fetchSuppliers,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
  } = useProductStore();

  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    purchase_price: 0,
    selling_price: 0,
    quantity: 0,
    reorder_point: 10,
  });

const [showCategoryModal, setShowCategoryModal] = useState(false);
const [showSupplierModal, setShowSupplierModal] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setFilteredProducts(searchProducts(searchQuery));
    } else {
      setFilteredProducts(products);
    }
  }, [products, searchQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        category_id: product.category_id || '',
        supplier_id: product.supplier_id || '',
        purchase_price: product.purchase_price,
        selling_price: product.selling_price,
        quantity: product.quantity,
        reorder_point: product.reorder_point,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: '',
        name: '',
        description: '',
        category_id: '',
        supplier_id: '',
        purchase_price: 0,
        selling_price: 0,
        quantity: 0,
        reorder_point: 10,
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct({
          ...formData,
          is_active: true,
        });
      }
      setShowForm(false);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const lowStockItems = filteredProducts.filter((p) => p.quantity <= p.reorder_point);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          {profile?.role === 'admin' && (
            <Button onClick={() => handleOpenForm()} variant="primary">
              <Plus size={20} className="mr-2" />
              Add Product
            </Button>
          )}
        </div>

        {lowStockItems.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-900">Low Stock Alert</p>
              <p className="text-yellow-800 text-sm">
                {lowStockItems.length} item(s) below reorder point
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search by product name, SKU, or description..."
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin">
              <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">SKU</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Purchase Price</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Selling Price</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    {profile?.role === 'admin' && (
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isLowStock = product.quantity <= product.reorder_point;
                    return (
                      <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-900 font-medium">{product.sku}</td>
                        <td className="px-6 py-3 text-sm">
                          <div>
                            <p className="text-gray-900 font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-gray-600 text-xs">{product.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          <span className={`font-semibold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{formatCurrency(product.purchase_price)}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{formatCurrency(product.selling_price)}</td>
                        <td className="px-6 py-3 text-sm">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              In Stock
                            </span>
                          )}
                        </td>
                        {profile?.role === 'admin' && (
                          <td className="px-6 py-3 text-sm flex gap-2">
                            <Button
                              onClick={() => handleOpenForm(product)}
                              variant="secondary"
                              size="sm"
                            >
                              <Edit2 size={16} />
                            </Button>
                            <Button
                              onClick={() => handleDelete(product.id)}
                              variant="danger"
                              size="sm"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No products found</p>
              </div>
            )}
          </div>
        )}

        <Modal
          isOpen={showForm}
          title={editingProduct ? 'Edit Product' : 'Add New Product'}
          onClose={() => setShowForm(false)}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="SKU"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />
              <Input
                label="Product Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <Input
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => setShowCategoryModal(true)}
                  variant="secondary"
                  size="md"
                  type="button"
                >
                  <Plus size={18} />
                </Button>
                <AddCategoryModal
                  isOpen={showCategoryModal}
                  onClose={() => setShowCategoryModal(false)}
                  onSuccess={() => {
                    fetchCategories(); // Refresh categories list
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => setShowSupplierModal(true)}
                  variant="secondary"
                  size="md"
                  type="button"
                >
                  <Plus size={18} />
                </Button>
                <AddSupplierModal
                  isOpen={showSupplierModal}
                  onClose={() => setShowSupplierModal(false)}
                  onSuccess={() => {
                    fetchSuppliers(); // Refresh suppliers list
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Purchase Price"
                type="number"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
                step="0.01"
                required
              />
              <Input
                label="Selling Price"
                type="number"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) })}
                step="0.01"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Initial Quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                required
              />
              <Input
                label="Reorder Point"
                type="number"
                value={formData.reorder_point}
                onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="primary" className="flex-1">
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
};
