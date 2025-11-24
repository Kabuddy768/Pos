# Quick Start Guide - POS System

## Initial Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Verify Environment
Check that `.env` has these values:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Database Setup
The database schema has already been deployed to your Supabase project via migrations.

### Step 4: Create Admin User
In Supabase Auth dashboard, create a test admin account:
- Email: `admin@pos.local`
- Password: `admin123`

Then manually add their profile:
```sql
INSERT INTO profiles (id, full_name, email, role, is_active)
VALUES (
  'USER_ID_FROM_AUTH',
  'Admin User',
  'admin@pos.local',
  'admin',
  true
);
```

### Step 5: Create Seller User
Create a seller test account:
- Email: `seller@pos.local`
- Password: `seller123`

And their profile:
```sql
INSERT INTO profiles (id, full_name, email, role, is_active)
VALUES (
  'USER_ID_FROM_AUTH',
  'Seller User',
  'seller@pos.local',
  'seller',
  true
);
```

### Step 6: Add Sample Data

#### Sample Categories
```sql
INSERT INTO categories (name, description) VALUES
('Tools', 'Hand and power tools'),
('Hardware', 'Bolts, nails, fasteners'),
('Electronics', 'Electrical components');
```

#### Sample Suppliers
```sql
INSERT INTO suppliers (name, contact_person, email, phone) VALUES
('Supplier Co', 'John Doe', 'john@supplier.com', '+254 712 345 678'),
('Hardware Store', 'Jane Smith', 'jane@hardware.com', '+254 723 456 789');
```

#### Sample Products
```sql
INSERT INTO products (sku, name, description, category_id, supplier_id, purchase_price, selling_price, quantity, reorder_point) VALUES
('SKU001', 'Hammer', 'Claw hammer 16oz', 'CATEGORY_ID', 'SUPPLIER_ID', 250, 399, 50, 10),
('SKU002', 'Wrench', 'Adjustable wrench', 'CATEGORY_ID', 'SUPPLIER_ID', 150, 299, 30, 5),
('SKU003', 'Drill', 'Electric cordless drill', 'CATEGORY_ID', 'SUPPLIER_ID', 2500, 3999, 10, 3);
```

## Development Workflow

### Start Dev Server
```bash
npm run dev
```
Opens at `http://localhost:5173`

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

## Using the System

### As Admin

1. **Login**: admin@pos.local / admin123
2. **Dashboard**: Overview of sales and inventory
3. **Inventory Management** (`/inventory`):
   - Click "Add Product" button
   - Fill in product details
   - Set purchase price, selling price, quantity
   - Click "Add Product"
4. **Reports** (`/reports`):
   - Select date range
   - View sales analytics
   - See top products and profit margins

### As Seller

1. **Login**: seller@pos.local / seller123
2. **Dashboard**: Quick links to POS and inventory view
3. **Point of Sale** (`/pos`):
   - Search for products in the search bar
   - Click product to add to cart
   - Adjust quantity with +/- buttons
   - Apply discount % if needed
   - Add tax if required
   - Click "Complete Sale"
   - Enter customer info (optional)
   - Select payment method
   - Click "Process Payment"
   - Transaction ID auto-generated
   - Stock auto-decreases

## File Organization

```
src/
├── components/        # Reusable UI components
├── lib/             # Configuration & types
├── stores/          # Zustand state management
├── utils/           # Helper functions
└── pages/           # Full page components
```

## Common Tasks

### Add New Product
Admin → Inventory → "Add Product" button

### Process Sale
Seller → Dashboard → "New Sale" → POS Interface

### View Reports
Admin → Reports → Select date range

### Search Products
Any page with search bar → Type SKU or name

## Troubleshooting

### Can't Login
- Check email/password are correct
- Verify profile exists in database
- Check user role is set correctly

### Products Not Showing
- Verify products are marked `is_active = true`
- Check seller can only see products (read-only)
- Admin can see all products

### Stock Not Decreasing
- Check sale transaction was created
- Verify sale_items were added
- Database triggers should auto-update

### Reports Not Loading
- Ensure dates are in correct range
- Check there are transactions in date range
- Verify database views exist

## Database Views Query Examples

### Check Low Stock
```sql
SELECT * FROM low_stock_items;
```

### View Inventory Value
```sql
SELECT * FROM stock_valuation;
```

### Product Performance
```sql
SELECT * FROM product_performance ORDER BY total_revenue DESC;
```

## Performance Tips

- Search is debounced at 300ms for responsiveness
- Use date ranges in reports to limit data
- Close unused browser tabs
- Clear browser cache if UI updates slowly

## Deploy to Production

### Build
```bash
npm run build
```

### Output
- Files in `dist/` folder
- Deploy to Vercel, Netlify, or your hosting

### Environment
Update `.env` with production Supabase URL and keys

## Monitoring

### Check User Activity
```sql
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100;
```

### Sales Statistics
```sql
SELECT DATE(created_at), COUNT(*), SUM(total_amount)
FROM sales
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;
```

### Inventory Issues
```sql
SELECT * FROM low_stock_items;
```

## Next Steps

1. Add more sample products
2. Create multiple seller accounts
3. Simulate transactions
4. Review profit reports
5. Monitor system performance
6. Plan deployment strategy

---

For detailed technical documentation, see `SYSTEM_OVERVIEW.md`
