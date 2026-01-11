
import React, { useState, useEffect } from 'react';
import { 
  Printer, Calendar, FileText, ChevronDown, Download, 
  Utensils, DollarSign, Users, ShoppingBag, AlertCircle,
  Ticket
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { MOCK_SHOW_TYPES, MOCK_MERCHANDISE, MOCK_ADDONS } from '../../mock/data';
import { toCSV, downloadCSV } from '../../utils/csvExport';
import { getVoucherOrders } from '../../utils/storage';
import { VoucherOrder } from '../../types';

const DB_KEY = 'grand_stage_reservations';
const EVENT_KEY = 'grand_stage_event_dates';

type ReportType = 'DAY' | 'KITCHEN' | 'WEEK' | 'VOUCHERS';

export const ReportsManager = () => {
  const [reportType, setReportType] = useState<ReportType>('DAY');
  const [selectedDate, setSelectedDate] = useState('2025-05-12');
  const [reservations, setReservations] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [voucherOrders, setVoucherOrders] = useState<VoucherOrder[]>([]);

  // Load Data
  useEffect(() => {
    const loadData = () => {
      const storedRes = localStorage.getItem(DB_KEY);
      const storedEvents = localStorage.getItem(EVENT_KEY);
      
      setReservations(storedRes ? JSON.parse(storedRes) : []);
      setEvents(storedEvents ? JSON.parse(storedEvents) : []);
      setVoucherOrders(getVoucherOrders());
    };
    loadData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // --- CSV GENERATORS ---

  const handleExportCSV = () => {
    const dateStr = selectedDate; // YYYY-MM-DD

    switch (reportType) {
      case 'DAY': {
        const stats = getDailyStats(dateStr);
        const data = stats.reservations.map(r => ({
          reservationNumber: r.id,
          date: r.date,
          customerName: `${r.customer.firstName} ${r.customer.lastName}`,
          email: r.customer.email,
          phone: r.customer.phone,
          partySize: r.partySize,
          package: r.packageType,
          addons: r.addons.map((a: any) => `${a.quantity}x ${a.id}`).join('; '),
          total: (r.financials.finalTotal || r.financials.total).toFixed(2),
          status: r.status
        }));
        const csv = toCSV(data, ['reservationNumber', 'date', 'customerName', 'email', 'phone', 'partySize', 'package', 'addons', 'total', 'status']);
        downloadCSV(`reservations_${dateStr}.csv`, csv);
        break;
      }
      
      case 'KITCHEN': {
        const stats = getDailyStats(dateStr);
        // Combine reservations with dietary/notes
        const data = stats.reservations
          .filter(r => r.notes.dietary || r.notes.isCelebrating)
          .map(r => ({
            date: r.date,
            reservationNumber: r.id,
            partySize: r.partySize,
            dietaryText: r.notes.dietary || '',
            dietaryChips: r.notes.dietary ? r.notes.dietary.split(',').length : 0, // Approx count
            celebration: r.notes.isCelebrating ? r.notes.celebrationText : ''
          }));
        
        const csv = toCSV(data, ['date', 'reservationNumber', 'partySize', 'dietaryText', 'dietaryChips', 'celebration']);
        downloadCSV(`diets_${dateStr}.csv`, csv);
        break;
      }

      case 'WEEK': {
        const range = getWeekRange(dateStr);
        // Aggregate all merch for the week
        const weeklyMerch: Record<string, number> = {};
        
        range.dates.forEach(d => {
          const s = getDailyStats(d);
          Object.entries(s.merchSales).forEach(([id, qty]: any) => {
            weeklyMerch[id] = (weeklyMerch[id] || 0) + qty;
          });
        });

        const data = Object.entries(weeklyMerch).map(([id, qty]) => {
          const item = MOCK_MERCHANDISE.find(m => m.id === id);
          return {
            weekRange: `${range.start} to ${range.end}`,
            itemName: item?.name || id,
            quantityTotal: qty,
            revenueTotal: (item?.price || 0) * qty
          };
        });

        const csv = toCSV(data, ['weekRange', 'itemName', 'quantityTotal', 'revenueTotal']);
        // Also get ISO week number for filename
        const weekNum = getWeekNumber(new Date(dateStr));
        downloadCSV(`merch_week_${new Date(dateStr).getFullYear()}-${weekNum}.csv`, csv);
        break;
      }

      case 'VOUCHERS': {
        const data = voucherOrders.map(v => ({
          orderId: v.id,
          buyerName: `${v.buyer.firstName} ${v.buyer.lastName}`,
          buyerEmail: v.buyer.email,
          deliveryMethod: v.deliveryMethod,
          issuanceMode: v.issuanceMode,
          voucherCount: v.items.reduce((s, i) => s + i.quantity, 0),
          itemsTotal: v.totals.subtotal.toFixed(2),
          deliveryFee: v.totals.shipping.toFixed(2),
          grandTotal: v.totals.grandTotal.toFixed(2),
          status: v.status,
          date: v.createdAt.split('T')[0]
        }));
        
        const csv = toCSV(data, ['orderId', 'buyerName', 'buyerEmail', 'deliveryMethod', 'issuanceMode', 'voucherCount', 'itemsTotal', 'deliveryFee', 'grandTotal', 'status', 'date']);
        downloadCSV(`theaterbon_orders_${new Date().toISOString().split('T')[0]}.csv`, csv);
        break;
      }
    }
  };

  // --- DATA HELPERS ---

  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  };

  const getWeekRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    
    const start = new Date(date.setDate(diff));
    const end = new Date(date.setDate(date.getDate() + 6));
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      dates: Array.from({length: 7}, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      })
    };
  };

  const getDailyStats = (date: string) => {
    const dailyRes = reservations.filter(r => r.date === date && r.status !== 'CANCELLED');
    const event = events.find(e => e.date === date);
    const show = event ? MOCK_SHOW_TYPES[event.showId] : null;

    return {
      date,
      show,
      totalGuests: dailyRes.reduce((sum, r) => sum + r.totalGuests, 0),
      revenue: dailyRes.reduce((sum, r) => sum + (r.financials?.finalTotal || 0), 0),
      packageCounts: {
        standard: dailyRes.filter(r => r.packageType === 'standard').reduce((sum, r) => sum + r.totalGuests, 0),
        premium: dailyRes.filter(r => r.packageType === 'premium').reduce((sum, r) => sum + r.totalGuests, 0),
      },
      dietary: dailyRes.filter(r => r.notes.dietary).map(r => ({
        name: `${r.customer.lastName}, ${r.customer.firstName}`,
        note: r.notes.dietary,
        guests: r.totalGuests
      })),
      celebrations: dailyRes.filter(r => r.notes.isCelebrating).map(r => ({
        name: `${r.customer.lastName}, ${r.customer.firstName}`,
        note: r.notes.celebrationText
      })),
      merchSales: dailyRes.reduce((acc: any, r) => {
        (r.merchandise || []).forEach((m: any) => {
          acc[m.id] = (acc[m.id] || 0) + m.quantity;
        });
        return acc;
      }, {}),
      reservations: dailyRes
    };
  };

  // --- REPORT COMPONENTS ---

  const DayReport = () => {
    const stats = getDailyStats(selectedDate);
    return (
      <div className="space-y-8 print:space-y-4">
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end print:border-black">
          <div>
            <h1 className="text-3xl font-serif text-slate-900 print:text-black font-bold">Dagoverzicht</h1>
            <p className="text-slate-500 print:text-slate-600 capitalize">
              {new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Show</p>
             <p className="text-xl font-bold text-slate-900 print:text-black">{stats.show?.name || 'Geen Show'}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
           <div className="p-4 bg-slate-100 rounded-xl print:border print:border-slate-300">
             <p className="text-[10px] uppercase font-bold text-slate-500">Gasten Totaal</p>
             <p className="text-2xl font-bold text-slate-900">{stats.totalGuests}</p>
           </div>
           <div className="p-4 bg-slate-100 rounded-xl print:border print:border-slate-300">
             <p className="text-[10px] uppercase font-bold text-slate-500">Bezetting</p>
             <p className="text-2xl font-bold text-slate-900">{Math.round((stats.totalGuests / 230) * 100)}%</p>
           </div>
           <div className="p-4 bg-slate-100 rounded-xl print:border print:border-slate-300">
             <p className="text-[10px] uppercase font-bold text-slate-500">Omzet (Est.)</p>
             <p className="text-2xl font-bold text-slate-900">€{stats.revenue.toLocaleString()}</p>
           </div>
           <div className="p-4 bg-slate-100 rounded-xl print:border print:border-slate-300">
             <p className="text-[10px] uppercase font-bold text-slate-500">Vieringen</p>
             <p className="text-2xl font-bold text-slate-900">{stats.celebrations.length}</p>
           </div>
        </div>
      </div>
    );
  };

  const KitchenReport = () => {
    const stats = getDailyStats(selectedDate);
    return (
      <div className="space-y-8 print:space-y-6">
        <div className="border-b-4 border-black pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-black uppercase tracking-tighter">Keukenlijst</h1>
            <p className="text-xl font-bold text-slate-600 capitalize">
              {new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right border-l-4 border-black pl-6">
             <p className="text-4xl font-black">{stats.totalGuests}</p>
             <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Totaal Covers</p>
          </div>
        </div>
        <div className="mt-8 p-6 bg-slate-100 border-l-8 border-slate-400 print:bg-white print:border-black">
           <h4 className="font-bold text-black uppercase mb-2 flex items-center"><AlertCircle size={16} className="mr-2"/> Notities Chef</h4>
           <div className="h-32 border-b border-slate-300 border-dashed"></div>
        </div>
      </div>
    );
  };

  const WeekReport = () => {
    const range = getWeekRange(selectedDate);
    let weeklyGuests = 0;
    let weeklyRevenue = 0;
    let weeklyMerch: Record<string, number> = {};

    return (
      <div className="space-y-8">
        <div className="border-b-2 border-slate-900 pb-4">
          <h1 className="text-3xl font-serif text-slate-900 font-bold">Weekrapport</h1>
          <p className="text-slate-500">
            {new Date(range.start).toLocaleDateString()} t/m {new Date(range.end).toLocaleDateString()}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-900 uppercase font-bold text-xs border-y-2 border-slate-900 print:bg-slate-200">
               <tr>
                 <th className="p-3">Datum</th>
                 <th className="p-3">Show</th>
                 <th className="p-3 text-right">Gasten</th>
                 <th className="p-3 text-right">Omzet</th>
                 <th className="p-3">Dieet / Bijz.</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
               {range.dates.map(dateStr => {
                 const stats = getDailyStats(dateStr);
                 weeklyGuests += stats.totalGuests;
                 weeklyRevenue += stats.revenue;
                 Object.entries(stats.merchSales).forEach(([id, qty]: any) => {
                   weeklyMerch[id] = (weeklyMerch[id] || 0) + qty;
                 });
                 return (
                   <tr key={dateStr} className="print:break-inside-avoid">
                     <td className="p-3 font-bold text-slate-700 whitespace-nowrap">{new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric' })}</td>
                     <td className="p-3">{stats.show ? stats.show.name : '-'}</td>
                     <td className="p-3 text-right font-mono font-bold text-slate-900">{stats.totalGuests > 0 ? stats.totalGuests : '-'}</td>
                     <td className="p-3 text-right font-mono text-slate-600">{stats.revenue > 0 ? `€${stats.revenue.toLocaleString()}` : '-'}</td>
                     <td className="p-3 text-xs text-slate-500">{stats.dietary.length > 0 ? `${stats.dietary.length} dieet` : ''}</td>
                   </tr>
                 );
               })}
               <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900">
                 <td colSpan={2} className="p-3 text-right uppercase tracking-widest text-xs">Week Totaal</td>
                 <td className="p-3 text-right text-lg">{weeklyGuests}</td>
                 <td className="p-3 text-right text-lg">€{weeklyRevenue.toLocaleString()}</td>
                 <td></td>
               </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const VoucherReport = () => {
    return (
      <div className="space-y-8">
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-serif text-slate-900 font-bold">Theaterbon Bestellingen</h1>
            <p className="text-slate-500">Alle bestellingen (Totaal)</p>
          </div>
          <div className="text-right">
             <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Totaal Items</p>
             <p className="text-xl font-bold text-slate-900">{voucherOrders.length}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-900 uppercase font-bold text-xs border-y-2 border-slate-900">
               <tr>
                 <th className="p-3">Order ID</th>
                 <th className="p-3">Datum</th>
                 <th className="p-3">Klant</th>
                 <th className="p-3">Methode</th>
                 <th className="p-3 text-right">Totaal</th>
                 <th className="p-3">Status</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
               {voucherOrders.map(v => (
                 <tr key={v.id} className="print:break-inside-avoid">
                   <td className="p-3 font-mono text-xs">{v.id}</td>
                   <td className="p-3 text-slate-600">{new Date(v.createdAt).toLocaleDateString()}</td>
                   <td className="p-3 font-bold text-slate-900">{v.buyer.firstName} {v.buyer.lastName}</td>
                   <td className="p-3 text-xs uppercase">{v.deliveryMethod}</td>
                   <td className="p-3 text-right font-mono font-bold">€{v.totals.grandTotal.toFixed(2)}</td>
                   <td className="p-3"><span className="text-xs border px-1 rounded border-slate-300">{v.status}</span></td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Controls (Hidden on Print) */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-end bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-4 w-full md:w-auto">
          <h2 className="text-2xl font-serif text-white">Rapporten & Print</h2>
          <div className="flex space-x-4 overflow-x-auto">
             <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 shrink-0">
               <button onClick={() => setReportType('DAY')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'DAY' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Dag</button>
               <button onClick={() => setReportType('KITCHEN')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'KITCHEN' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Keuken</button>
               <button onClick={() => setReportType('WEEK')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'WEEK' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Week</button>
               <button onClick={() => setReportType('VOUCHERS')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'VOUCHERS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Vouchers</button>
             </div>
             {reportType !== 'VOUCHERS' && (
               <Input type="date" value={selectedDate} onChange={(e: any) => setSelectedDate(e.target.value)} className="bg-slate-950 border-slate-800 text-white h-full" />
             )}
          </div>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          <Button variant="secondary" onClick={handleExportCSV} className="flex items-center">
            <Download size={18} className="mr-2"/> Export CSV
          </Button>
          <Button onClick={handlePrint} className="flex items-center"><Printer size={18} className="mr-2"/> Afdrukken</Button>
        </div>
      </div>

      {/* Report Preview */}
      <div className="flex-grow bg-slate-800/50 p-4 md:p-8 overflow-y-auto rounded-2xl print:p-0 print:bg-white print:overflow-visible">
        <div className="bg-white text-slate-900 shadow-2xl mx-auto w-full md:w-[210mm] min-h-[297mm] p-6 md:p-[15mm] print:shadow-none print:m-0 print:w-full print:h-auto print:min-h-0 rounded-sm">
           {reportType === 'DAY' && <DayReport />}
           {reportType === 'KITCHEN' && <KitchenReport />}
           {reportType === 'WEEK' && <WeekReport />}
           {reportType === 'VOUCHERS' && <VoucherReport />}
           <div className="mt-12 pt-4 border-t border-slate-200 text-xs text-slate-400 flex justify-between print:flex hidden">
              <span>Inspiration Point System</span>
              <span>Gegenereerd op {new Date().toLocaleString()}</span>
           </div>
        </div>
      </div>
    </div>
  );
};
