
import { Invoice, InvoiceItem } from '../types';
import { formatCurrency } from './formatters';

const LOGO_URL = "https://irp.cdn-website.com/e8046ea7/dms3rep/multi/logo-ip+%281%29.png";

// Helper to group split items back into a single display row
const groupInvoiceItems = (items: InvoiceItem[]) => {
  const groups: Record<string, InvoiceItem & { isMixed?: boolean }> = {};
  const orderedKeys: string[] = [];

  items.forEach(item => {
    const key = item.originalReservationItemId || item.id;
    
    if (!groups[key]) {
      groups[key] = { ...item };
      orderedKeys.push(key);
      // Clean up the description for display
      groups[key].description = groups[key].description
        .replace(' (Diner & Show)', '')
        .replace(' (Drankenarrangement)', '')
        .replace(' (Arrangement)', '');
    } else {
      groups[key].total += item.total;
      // Recalculate unit price based on combined total
      groups[key].unitPrice = groups[key].total / groups[key].quantity; 
      groups[key].isMixed = true; 
    }
  });

  return orderedKeys.map(k => groups[k]);
};

export const generateInvoiceHTML = (invoice: Invoice) => {
  const { customerSnapshot, items, totals, id, dates } = invoice;
  const invoiceDate = new Date(dates.issued || dates.created).toLocaleDateString('nl-NL');
  const dueDate = new Date(dates.due).toLocaleDateString('nl-NL');
  const displayItems = groupInvoiceItems(items);

  const rows = displayItems.map(item => {
    return `
      <tr class="border-b border-gray-200 text-sm">
        <td class="py-4 text-left">
          <div class="font-bold text-gray-900">${item.description}</div>
          ${item.category !== 'OTHER' && !item.isMixed ? `<div class="text-xs text-gray-500 uppercase tracking-wider">${item.category}</div>` : ''}
        </td>
        <td class="py-4 text-center font-medium">${item.quantity}</td>
        <td class="py-4 text-right text-gray-600">Incl.</td>
        <td class="py-4 text-right font-mono text-gray-700">${formatCurrency(item.unitPrice)}</td>
        <td class="py-4 text-right font-mono font-bold text-gray-900">${formatCurrency(item.total)}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="invoice-page bg-white text-gray-900 p-12 max-w-[210mm] mx-auto font-sans leading-relaxed" style="min-height: 297mm; position: relative;">
      
      <!-- HEADER -->
      <div class="flex justify-between items-start mb-16 border-b-2 border-black pb-8">
        <div>
          <img src="${LOGO_URL}" alt="Inspiration Point" style="height: 80px; object-fit: contain; display: block; margin-bottom: 10px;">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] pl-1">Dinner Theater & Events</div>
        </div>
        <div class="text-right">
          <h2 class="text-6xl font-black text-gray-100 uppercase tracking-tighter absolute top-10 right-12 z-0 pointer-events-none select-none">FACTUUR</h2>
          <div class="relative z-10 bg-white pl-4">
             <dl class="text-sm grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                <dt class="font-bold text-gray-500 uppercase text-xs pt-1">Factuurnr.</dt>
                <dd class="font-mono font-bold text-lg">${id}</dd>
                <dt class="font-bold text-gray-500 uppercase text-xs pt-1">Datum</dt>
                <dd>${invoiceDate}</dd>
                <dt class="font-bold text-gray-500 uppercase text-xs pt-1">Vervaldatum</dt>
                <dd>${dueDate}</dd>
             </dl>
          </div>
        </div>
      </div>

      <!-- ADDRESS BLOCK -->
      <div class="flex justify-between mb-16">
         <div class="w-1/2">
            <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Factuuradres</h3>
            <div class="text-lg font-bold text-gray-900 leading-tight">${customerSnapshot.companyName || customerSnapshot.name}</div>
            ${customerSnapshot.companyName ? `<div class="text-gray-600 mb-1">${customerSnapshot.name}</div>` : ''}
            <div class="text-gray-600 leading-snug">
              ${customerSnapshot.address}<br>
              ${customerSnapshot.zip} ${customerSnapshot.city}
            </div>
            ${customerSnapshot.vatNumber ? `<div class="mt-4 text-sm font-mono text-gray-500">BTW: ${customerSnapshot.vatNumber}</div>` : ''}
         </div>
         
         <div class="w-1/3 text-right text-sm text-gray-500 space-y-1">
            <p><strong>Inspiration Point BV</strong></p>
            <p>Dorpstraat 1</p>
            <p>1234 AB Utrecht</p>
            <p class="pt-2">KvK: 12345678</p>
            <p>BTW: NL8888.99.000.B01</p>
            <p>IBAN: NL01 RABO 0123 4567 89</p>
         </div>
      </div>

      <!-- ITEMS TABLE -->
      <table class="w-full mb-8 border-collapse">
        <thead class="text-xs uppercase font-bold text-gray-500 border-b-2 border-black">
          <tr>
            <th class="py-3 text-left">Omschrijving</th>
            <th class="py-3 text-center w-20">Aantal</th>
            <th class="py-3 text-right w-20">BTW</th>
            <th class="py-3 text-right w-32">Prijs (Incl.)</th>
            <th class="py-3 text-right w-32">Totaal (Incl.)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <!-- TOTALS BLOCK -->
      <div class="flex justify-end mb-20">
        <div class="w-80 bg-gray-50 p-6 rounded-lg">
          <div class="flex justify-between items-end pb-4 border-b-2 border-black mb-4">
            <span class="font-bold text-lg uppercase tracking-wide">Totaal</span>
            <span class="font-black text-3xl font-serif text-amber-600">${formatCurrency(totals.totalIncl)}</span>
          </div>

          <div class="space-y-1 pt-1">
             <div class="flex justify-between text-xs text-gray-500">
                <span>Waarvan BTW 9%</span>
                <span class="font-mono">${formatCurrency(totals.vat9)}</span>
             </div>
             <div class="flex justify-between text-xs text-gray-500">
                <span>Waarvan BTW 21%</span>
                <span class="font-mono">${formatCurrency(totals.vat21)}</span>
             </div>
             <div class="flex justify-between text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200">
                <span>Totaal Excl. BTW</span>
                <span class="font-mono">${formatCurrency(totals.subtotalExcl)}</span>
             </div>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="absolute bottom-12 left-12 right-12 text-center border-t border-gray-200 pt-8">
        <p class="text-sm text-gray-600 font-medium mb-1">
            Wij verzoeken u vriendelijk het totaalbedrag binnen 14 dagen over te maken.
        </p>
        <p class="text-xs text-gray-400">
            Vermeld bij betaling altijd het factuurnummer: <strong>${id}</strong>
        </p>
        <p class="text-[10px] text-gray-400 mt-2">
            De getoonde prijzen zijn inclusief 9% en 21% BTW. De specificatie hiervan vindt u in het totaalblok.
        </p>
      </div>
    </div>
  `;
};

export const printInvoice = (invoice: Invoice) => {
  const content = generateInvoiceHTML(invoice);
  openPrintWindow(content);
};

export const printBatchInvoices = (invoices: Invoice[]) => {
  const content = invoices.map(i => generateInvoiceHTML(i)).join('<div style="page-break-after: always;"></div>');
  openPrintWindow(content);
};

const openPrintWindow = (htmlContent: string) => {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(`
      <html>
        <head>
          <title>Factuur Printen</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
            body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; margin: 0; background: #525252; }
            .font-serif { font-family: 'Playfair Display', serif; }
            @media print {
              body { background: white; margin: 0; }
              @page { margin: 0; }
              .invoice-page { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; min-height: 100vh !important; }
            }
          </style>
        </head>
        <body class="py-10">
          ${htmlContent}
          <script>
            window.onload = () => { setTimeout(() => window.print(), 800); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
};
