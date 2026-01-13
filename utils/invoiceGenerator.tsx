
import { Reservation } from '../types';
import { formatCurrency, formatGuestName } from './formatters';

export const generateInvoiceHTML = (reservation: Reservation) => {
  const { customer, financials, id, date } = reservation;
  const invoiceDate = new Date().toLocaleDateString('nl-NL');
  const showDate = new Date(date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  
  // Calculate VAT (Rough estimation: 9% for food/ticket, 21% for alcohol/merch. For simplicity we use mixed or flat 9% for ticket)
  // In a real system, line items should carry their own tax rate.
  
  let totalNet = 0;
  let totalVat9 = 0;
  let totalVat21 = 0;

  const rows = (financials.priceBreakdown || []).map(item => {
    const isHighVat = item.category === 'MERCH' || item.category === 'ADDON'; // Simplified rule
    const taxRate = isHighVat ? 0.21 : 0.09;
    
    // Reverse calc: Price is incl VAT
    const net = item.total / (1 + taxRate);
    const vat = item.total - net;
    
    totalNet += net;
    if (isHighVat) totalVat21 += vat; else totalVat9 += vat;

    return `
      <tr class="border-b border-slate-200">
        <td class="py-3 text-left">
          <div class="font-bold text-slate-800">${item.label}</div>
          <div class="text-xs text-slate-500 uppercase tracking-wider">${item.category}</div>
        </td>
        <td class="py-3 text-center">${item.quantity}</td>
        <td class="py-3 text-right font-mono">${formatCurrency(item.unitPrice)}</td>
        <td class="py-3 text-right font-mono text-slate-900">${formatCurrency(item.total)}</td>
      </tr>
    `;
  }).join('');

  const payments = (financials.payments || []).map(p => `
    <div class="flex justify-between text-xs text-slate-600 mb-1">
      <span>${new Date(p.date).toLocaleDateString()} - ${p.method} (${p.type})</span>
      <span class="font-mono">- ${formatCurrency(p.amount)}</span>
    </div>
  `).join('');

  return `
    <div class="invoice-page bg-white text-slate-900 p-8 max-w-4xl mx-auto" style="page-break-after: always; min-height: 297mm; position: relative;">
      
      <div class="flex justify-between items-start mb-12">
        <div>
          <h1 class="text-3xl font-serif font-bold text-amber-600 mb-2">Inspiration Point</h1>
          <p class="text-sm text-slate-500">Dinner Theater & Events</p>
          <div class="mt-4 text-xs text-slate-600 leading-relaxed">
            Dorpstraat 1<br>
            1234 AB Utrecht<br>
            BTW: NL8888.99.000.B01<br>
            KvK: 12345678
          </div>
        </div>
        <div class="text-right">
          <h2 class="text-4xl font-black text-slate-200 uppercase tracking-tighter mb-4">Factuur</h2>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-right">
            <dt class="text-slate-500">Factuurnummer</dt>
            <dd class="font-bold font-mono">${id}</dd>
            <dt class="text-slate-500">Datum</dt>
            <dd>${invoiceDate}</dd>
            <dt class="text-slate-500">Reservering</dt>
            <dd>${showDate}</dd>
          </dl>
        </div>
      </div>

      <div class="mb-12 p-6 bg-slate-50 rounded-xl border border-slate-200">
        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Factuuradres</h3>
        <div class="font-bold text-lg">${formatGuestName(customer.firstName, customer.lastName)}</div>
        ${customer.companyName ? `<div class="text-slate-600">${customer.companyName}</div>` : ''}
        <div class="text-slate-600 mt-1">
          ${customer.street} ${customer.houseNumber}<br>
          ${customer.zip} ${customer.city}<br>
          ${customer.email}
        </div>
      </div>

      <table class="w-full mb-8">
        <thead class="bg-slate-900 text-white text-xs uppercase font-bold">
          <tr>
            <th class="py-3 px-2 text-left rounded-l-lg">Omschrijving</th>
            <th class="py-3 px-2 text-center">Aantal</th>
            <th class="py-3 px-2 text-right">Prijs</th>
            <th class="py-3 px-2 text-right rounded-r-lg">Totaal</th>
          </tr>
        </thead>
        <tbody class="text-sm">
          ${rows}
        </tbody>
      </table>

      <div class="flex justify-end mb-12">
        <div class="w-64 space-y-3">
          <div class="flex justify-between text-sm text-slate-500">
            <span>Subtotaal (excl.)</span>
            <span class="font-mono">${formatCurrency(totalNet)}</span>
          </div>
          <div class="flex justify-between text-sm text-slate-500">
            <span>BTW 9%</span>
            <span class="font-mono">${formatCurrency(totalVat9)}</span>
          </div>
          <div class="flex justify-between text-sm text-slate-500">
            <span>BTW 21%</span>
            <span class="font-mono">${formatCurrency(totalVat21)}</span>
          </div>
          ${financials.discount ? `
          <div class="flex justify-between text-sm text-emerald-600 font-bold">
            <span>Korting</span>
            <span class="font-mono">-${formatCurrency(financials.discount)}</span>
          </div>` : ''}
          
          <div class="flex justify-between items-end pt-4 border-t-2 border-slate-900">
            <span class="font-bold text-lg">Totaal</span>
            <span class="font-black text-2xl font-serif text-slate-900">${formatCurrency(financials.finalTotal)}</span>
          </div>

          ${payments ? `
            <div class="pt-4 mt-4 border-t border-slate-200">
              <p class="text-xs font-bold text-slate-400 uppercase mb-2">Betalingen</p>
              ${payments}
              <div class="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 font-bold ${financials.finalTotal - financials.paid > 0.01 ? 'text-red-600' : 'text-emerald-600'}">
                <span>Openstaand</span>
                <span class="font-mono">${formatCurrency(financials.finalTotal - financials.paid)}</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="text-center text-xs text-slate-400 mt-20 border-t border-slate-100 pt-8">
        <p>Bedankt voor uw vertrouwen in Inspiration Point.</p>
        <p>Gelieve het openstaande bedrag binnen 14 dagen te voldoen onder vermelding van het factuurnummer.</p>
      </div>
    </div>
  `;
};

export const printInvoice = (reservation: Reservation) => {
  // Wrap single invoice in HTML shell
  const content = generateInvoiceHTML(reservation);
  openPrintWindow(content);
};

export const printBatchInvoices = (reservations: Reservation[]) => {
  const content = reservations.map(r => generateInvoiceHTML(r)).join('');
  openPrintWindow(content);
};

const openPrintWindow = (htmlContent: string) => {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(`
      <html>
        <head>
          <title>Facturen Afdrukken</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap');
            body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; margin: 0; background: #f1f5f9; }
            .font-serif { font-family: 'Playfair Display', serif; }
            @media print {
              body { background: white; }
              .no-print { display: none; }
              .invoice-page { break-after: page; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
          <script>
            window.onload = () => { setTimeout(() => window.print(), 500); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
};
