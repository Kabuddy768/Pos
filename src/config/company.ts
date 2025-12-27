/**
 * Company Information Configuration
 * 
 * Update these details with your actual business information.
 * This data will appear on all receipts.
 */

export const COMPANY_INFO = {
  // Business Details
  name: 'Your Business Name',
  tagline: 'Quality Products & Services',
  
  // Contact Information
  address: '123 Main Street',
  city: 'Nairobi',
  country: 'Kenya',
  phone: '+254 712 345 678',
  email: 'info@yourbusiness.com',
  website: 'www.yourbusiness.com',
  
  // Legal Information
  taxId: 'PIN: A000000000X', // Kenya PIN/Tax ID
  registrationNumber: 'Registration No: PVT-123456',
  
  // Receipt Settings
  receiptFooter: 'Thank you for your business!',
  returnPolicy: 'Returns accepted within 30 days with receipt.',
  
  // Branding (optional - for future logo support)
  primaryColor: '#2563eb', // Blue
  accentColor: '#1e40af', // Dark blue
};

// Receipt Configuration
export const RECEIPT_CONFIG = {
  // Paper size
  format: 'a4' as const, // 'a4' | 'letter' | [width, height]
  
  // Margins (in mm)
  margins: {
    top: 15,
    right: 15,
    bottom: 15,
    left: 15,
  },
  
  // Font settings
  fonts: {
    header: 18,
    subheader: 14,
    body: 10,
    small: 8,
  },
  
  // Auto-download after generation
  autoDownload: true,
  
  // Show tax breakdown
  showTaxBreakdown: true,
  
  // Include seller/cashier name
  includeCashierName: true,
};

// Currency formatting
export const CURRENCY = {
  code: 'KES',
  symbol: 'KSh',
  locale: 'en-KE',
};