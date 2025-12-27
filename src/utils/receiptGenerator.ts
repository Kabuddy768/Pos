import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, SaleItem, Profile } from '@/lib/types';
import { COMPANY_INFO, RECEIPT_CONFIG,  } from '@/config/company';
import { formatCurrency, formatDateTime } from '@/utils/formatters';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

interface ReceiptData {
  sale: Sale;
  items: SaleItem[];
  seller?: Profile;
}

/**
 * Generate a PDF receipt for a completed sale
 */
export function generateReceipt(data: ReceiptData): jsPDF {
  const { sale, items, seller } = data;
  
  // Initialize PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: RECEIPT_CONFIG.format,
  });

  const pageWidth = doc.internal.pageSize.width;
  const margins = RECEIPT_CONFIG.margins;
  let yPosition = margins.top;

  // Helper: Add centered text
  const addCenteredText = (text: string, y: number, fontSize: number = 10, style: 'normal' | 'bold' = 'normal') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);
    const textWidth = doc.getTextWidth(text);
    const x = (pageWidth - textWidth) / 2;
    doc.text(text, x, y);
  };

  // Helper: Add right-aligned text
  const addRightText = (text: string, y: number, fontSize: number = 10) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    const textWidth = doc.getTextWidth(text);
    doc.text(text, pageWidth - margins.right - textWidth, y);
  };

  // ==================
  // 1. COMPANY HEADER
  // ==================
  addCenteredText(COMPANY_INFO.name, yPosition, RECEIPT_CONFIG.fonts.header, 'bold');
  yPosition += 6;

  if (COMPANY_INFO.tagline) {
    doc.setFontSize(RECEIPT_CONFIG.fonts.small);
    doc.setFont('helvetica', 'italic');
    addCenteredText(COMPANY_INFO.tagline, yPosition, RECEIPT_CONFIG.fonts.small);
    yPosition += 5;
  }

  // Company contact info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(RECEIPT_CONFIG.fonts.small);
  addCenteredText(`${COMPANY_INFO.address}, ${COMPANY_INFO.city}, ${COMPANY_INFO.country}`, yPosition, RECEIPT_CONFIG.fonts.small);
  yPosition += 4;
  addCenteredText(`Tel: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`, yPosition, RECEIPT_CONFIG.fonts.small);
  yPosition += 4;

  if (COMPANY_INFO.taxId) {
    addCenteredText(COMPANY_INFO.taxId, yPosition, RECEIPT_CONFIG.fonts.small);
    yPosition += 4;
  }

  // Divider line
  yPosition += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(margins.left, yPosition, pageWidth - margins.right, yPosition);
  yPosition += 7;

  // ==================
  // 2. RECEIPT TITLE
  // ==================
  addCenteredText('SALES RECEIPT', yPosition, RECEIPT_CONFIG.fonts.subheader, 'bold');
  yPosition += 8;

  // ==================
  // 3. TRANSACTION DETAILS
  // ==================
  doc.setFontSize(RECEIPT_CONFIG.fonts.body);
  doc.setFont('helvetica', 'normal');

  const detailsStartX = margins.left;
  const detailsLabelWidth = 40;

  // Transaction Number
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction #:', detailsStartX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(sale.transaction_number, detailsStartX + detailsLabelWidth, yPosition);
  yPosition += 5;

  // Date & Time
  doc.setFont('helvetica', 'bold');
  doc.text('Date & Time:', detailsStartX, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateTime(sale.created_at), detailsStartX + detailsLabelWidth, yPosition);
  yPosition += 5;

  // Cashier/Seller
  if (RECEIPT_CONFIG.includeCashierName && seller) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cashier:', detailsStartX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(seller.full_name, detailsStartX + detailsLabelWidth, yPosition);
    yPosition += 5;
  }

  // Customer (if provided)
  if (sale.customer_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', detailsStartX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(sale.customer_name, detailsStartX + detailsLabelWidth, yPosition);
    yPosition += 5;
  }

  if (sale.customer_phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', detailsStartX, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(sale.customer_phone, detailsStartX + detailsLabelWidth, yPosition);
    yPosition += 5;
  }

  yPosition += 3;

  // ==================
  // 4. ITEMS TABLE
  // ==================
  const tableData = items.map((item) => [
    item.product_name,
    item.product_sku,
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.line_total),
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Item', 'SKU', 'Qty', 'Price', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // Blue
      textColor: 255,
      fontSize: RECEIPT_CONFIG.fonts.body,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: RECEIPT_CONFIG.fonts.body,
    },
    columnStyles: {
      0: { cellWidth: 60 }, // Item name
      1: { cellWidth: 30 }, // SKU
      2: { cellWidth: 15, halign: 'center' }, // Quantity
      3: { cellWidth: 30, halign: 'right' }, // Price
      4: { cellWidth: 30, halign: 'right' }, // Total
    },
    margin: { left: margins.left, right: margins.right },
  });

  // Get Y position after table
  yPosition = (doc as any).lastAutoTable.finalY + 5;

  // ==================
  // 5. TOTALS SECTION
  // ==================
  const totalsStartX = pageWidth - margins.right - 70;
//   const totalsValueX = pageWidth - margins.right;

  doc.setFontSize(RECEIPT_CONFIG.fonts.body);

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsStartX, yPosition);
  addRightText(formatCurrency(sale.subtotal), yPosition);
  yPosition += 5;

  // Discount (if any)
  if (sale.discount_amount > 0) {
    doc.setTextColor(220, 38, 38); // Red for discount
    doc.text(`Discount (${sale.discount_percentage}%):`, totalsStartX, yPosition);
    addRightText(`-${formatCurrency(sale.discount_amount)}`, yPosition);
    doc.setTextColor(0, 0, 0); // Reset to black
    yPosition += 5;
  }

  // Tax (if any)
  if (RECEIPT_CONFIG.showTaxBreakdown && sale.tax_amount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Tax:', totalsStartX, yPosition);
    addRightText(formatCurrency(sale.tax_amount), yPosition);
    yPosition += 5;
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsStartX, yPosition, pageWidth - margins.right, yPosition);
  yPosition += 5;

  // TOTAL (bold and larger)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(RECEIPT_CONFIG.fonts.subheader);
  doc.text('TOTAL:', totalsStartX, yPosition);
  addRightText(formatCurrency(sale.total_amount), yPosition, RECEIPT_CONFIG.fonts.subheader);
  yPosition += 8;

  doc.setFontSize(RECEIPT_CONFIG.fonts.body);

  // ==================
  // 6. PAYMENT INFO
  // ==================
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Method:', detailsStartX, yPosition);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.payment_method.toUpperCase(), detailsStartX + detailsLabelWidth, yPosition);
  yPosition += 5;

  if (sale.payment_reference) {
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Ref:', detailsStartX, yPosition);
    doc.setFont('helvetica', 'bold');
    doc.text(sale.payment_reference, detailsStartX + detailsLabelWidth, yPosition);
    yPosition += 5;
  }

  yPosition += 5;

  // ==================
  // 7. FOOTER
  // ==================
  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(margins.left, yPosition, pageWidth - margins.right, yPosition);
  yPosition += 7;

  // Thank you message
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(RECEIPT_CONFIG.fonts.body);
  addCenteredText(COMPANY_INFO.receiptFooter, yPosition);
  yPosition += 6;

  // Return policy
  if (COMPANY_INFO.returnPolicy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(RECEIPT_CONFIG.fonts.small);
    const policyLines = doc.splitTextToSize(COMPANY_INFO.returnPolicy, pageWidth - margins.left - margins.right);
    policyLines.forEach((line: string) => {
      addCenteredText(line, yPosition, RECEIPT_CONFIG.fonts.small);
      yPosition += 4;
    });
  }

  yPosition += 3;

  // Website
  if (COMPANY_INFO.website) {
    doc.setFont('helvetica', 'italic');
    addCenteredText(COMPANY_INFO.website, yPosition, RECEIPT_CONFIG.fonts.small);
  }

  // Add page number if multiple pages
  const pageCount = doc.getNumberOfPages();
  if (pageCount > 1) {
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
  }

  return doc;
}

/**
 * Generate and download receipt
 */
export function downloadReceipt(data: ReceiptData): void {
  const doc = generateReceipt(data);
  const filename = `Receipt-${data.sale.transaction_number}.pdf`;
  doc.save(filename);
}

/**
 * Generate and open receipt in new tab (for printing)
 */
export function printReceipt(data: ReceiptData): void {
  const doc = generateReceipt(data);
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, '_blank');
}

/**
 * Generate receipt as base64 string (for emailing)
 */
export function getReceiptBase64(data: ReceiptData): string {
  const doc = generateReceipt(data);
  return doc.output('dataurlstring');
}