
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Printer, Calendar, FileText, ChevronDown, Download, 
  Utensils, DollarSign, Users, ShoppingBag, AlertCircle,
  Ticket, PartyPopper, CheckCircle2, Clock, BarChart3, PieChart as PieIcon, TrendingUp,
  FileDown
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { MOCK_SHOW_TYPES, MOCK_MERCHANDISE, MOCK_ADDONS } from '../../mock/data';
import { toCSV, downloadCSV } from '../../utils/csvExport';
import { getVoucherOrders, bookingRepo, calendarRepo } from '../../utils/storage';
import { VoucherOrder, Reservation } from '../../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#f43f5e', '#8b5cf6'];

const DB_KEY = 'grand_stage_reservations';
const EVENT_KEY = 'grand_stage_event_dates';

type ReportType = 'DAY' | 'KITCHEN' | 'WEEK' | 'ANALYTICS';

export const ReportsManager = () => {
  const location = useLocation();
  const [reportType, setReportType] = useState<ReportType>('ANALYTICS');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [voucherOrders, setVoucherOrders] = useState<VoucherOrder[]>([]);

  // Load Data & Initial State
  useEffect(() => {
    if (location.state && location.state.date) {
      setSelectedDate(location.state.date);
      setReportType('DAY');
    }

    const loadData = () => {
      setReservations(bookingRepo.getAll());
      setEvents(calendarRepo.getAll());
      setVoucherOrders(getVoucherOrders());
    };
    loadData();
  }, [location.state]);

  const handlePrint = () => window.print();

  // --- PDF GENERATION ---
  const handleDownloadPDF = () => {
    const stats = getDailyStats(selectedDate);
    const doc = new jsPDF();

    // 1. Header
    doc.setFontSize(18);
    doc.text('Dagrapportage - Inspiration Point', 14, 20);
    doc.setFontSize(12);
    doc.text(`Datum: ${new Date(selectedDate).toLocaleDateString('nl-NL')}`, 14, 30);
    doc.text(`Show: ${stats.show?.name || 'Geen Show'}`, 14, 36);

    // 2. Summary
    const summaryData = [
        ['Totaal Gasten', String(stats.totalGuests)],
        ['Verwachte Omzet', `€${stats.revenue.toFixed(2)}`],
        ['Standard Arrangement', String(stats.packageCounts.standard)],
        ['Premium Arrangement', String(stats.packageCounts.premium)]
    ];

    autoTable(doc, {
        startY: 45,
        head: [['Metric', 'Waarde']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] }, // Amber
    });

    // 3. Reservations List
    const tableRows = stats.reservations.map(r => [
        r.customer.lastName + ', ' + r.customer.firstName,
        r.partySize,
        r.packageType,
        r.tableId ? r.tableId.replace('TAB-', '') : '-',
        r.notes.dietary || '-',
        r.financials.isPaid ? 'Betaald' : 'Open'
    ]);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Naam', 'Pax', 'Type', 'Tafel', 'Dieet', 'Status']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [30, 41, 59] }, // Slate-900
    });

    doc.save(`dagrapport_${selectedDate}.pdf`);
  };

  // --- ANALYTICS DATA PREP ---

  const analyticsData = useMemo(() => {
    // 1. Monthly Revenue
    const revenueByMonth: Record<string, number> = {};
    const guestsByMonth: Record<string, number> = {};
    
    reservations.forEach(r => {
        if (r.status === 'CANCELLED') return;
        const date = new Date(r.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
        
        revenueByMonth[key] = (revenueByMonth[key] || 0) + (r.financials.finalTotal || 0);
        guestsByMonth[key] = (guestsByMonth[key] || 0) + r.partySize;
    });

    const revenueChartData = Object.keys(revenueByMonth).sort().map(key => ({
        name: key,
        omzet: revenueByMonth[key],
        gasten: guestsByMonth[key]
    })).slice(-6); // Last 6 months

    // 2. Package Ratio
    let premiumCount = 0;
    let standardCount = 0;
    reservations.forEach(r => {
        if (r.status === 'CANCELLED') return;
        if (r.packageType === 'premium') premiumCount += r.partySize;
        else standardCount += r.partySize;
    });
    
    const packageChartData = [
        { name: 'Standard', value: standardCount },
        { name: 'Premium', value: premiumCount },
    ];

    // 3. Pacing (Cumulative Revenue Current Month vs Last Month)
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;

    const getCumulativeData = (monthKey: string) => {
        const dailyRevenue: number[] = new Array(32).fill(0); // Index 1-31
        
        reservations.forEach(r => {
            if (r.status === 'CANCELLED') return;
            const rDate = new Date(r.createdAt); // Use booking creation date for sales pacing
            const rKey = `${rDate.getFullYear()}-${String(rDate.getMonth()+1).padStart(2,'0')}`;
            
            if (rKey === monthKey) {
                const day = rDate.getDate();
                dailyRevenue[day] += r.financials.finalTotal;
            }
        });

        // Accumulate
        let sum = 0;
        return dailyRevenue.map(val => {
            sum += val;
            return sum;
        });
    };

    const currentPacing = getCumulativeData(currentMonthKey);
    const lastPacing = getCumulativeData(lastMonthKey);

    const pacingChartData = Array.from({length: 31}, (_, i) => ({
        day: i + 1,
        thisMonth: currentPacing[i+1],
        lastMonth: lastPacing[i+1]
    }));

    return { revenueChartData, packageChartData, pacingChartData };
  }, [reservations]);

  // --- DAY STATS (Legacy) ---
  const getDailyStats = (date: string) => {
    const dailyRes = reservations.filter(r => r.date === date && r.status !== 'CANCELLED');
    const event = events.find(e => e.date === date);
    const show = event ? MOCK_SHOW_TYPES[(event as any).showId] : null;

    return {
      date,
      show,
      totalGuests: dailyRes.reduce((sum, r) => sum + r.partySize, 0),
      revenue: dailyRes.reduce((sum, r) => sum + (r.financials.finalTotal || 0), 0),
      packageCounts: {
        standard: dailyRes.filter(r => r.packageType === 'standard').reduce((sum, r) => sum + r.partySize, 0),
        premium: dailyRes.filter(r => r.packageType === 'premium').reduce((sum, r) => sum + r.partySize, 0),
      },
      dietary: dailyRes.filter(r => r.notes.dietary).map(r => ({
        name: `${r.customer.lastName}, ${r.customer.firstName}`,
        note: r.notes.dietary,
        guests: r.partySize
      })),
      celebrations: dailyRes.filter(r => r.notes.isCelebrating).map(r => ({
        name: `${r.customer.lastName}, ${r.customer.firstName}`,
        note: r.notes.celebrationText
      })),
      reservations: dailyRes
    };
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header & Controls */}
      <div className="print:hidden flex flex-col md:flex-row justify-between items-end bg-slate-900 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-4 w-full md:w-auto">
          <h2 className="text-2xl font-serif text-white">Rapporten & Analyse</h2>
          <div className="flex space-x-4 overflow-x-auto">
             <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 shrink-0">
               <button onClick={() => setReportType('ANALYTICS')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'ANALYTICS' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Visuals</button>
               <button onClick={() => setReportType('DAY')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'DAY' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Daglijst</button>
               <button onClick={() => setReportType('KITCHEN')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'KITCHEN' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>Keuken</button>
             </div>
             {reportType !== 'ANALYTICS' && (
               <Input type="date" value={selectedDate} onChange={(e: any) => setSelectedDate(e.target.value)} className="bg-slate-950 border-slate-800 text-white h-full" />
             )}
          </div>
        </div>
        <div className="flex space-x-3 mt-4 md:mt-0">
          {reportType === 'DAY' && (
              <Button onClick={handleDownloadPDF} variant="secondary" className="flex items-center">
                  <FileDown size={18} className="mr-2"/> Download PDF
              </Button>
          )}
          <Button onClick={handlePrint} className="flex items-center"><Printer size={18} className="mr-2"/> Afdrukken</Button>
        </div>
      </div>

      {/* --- ANALYTICS DASHBOARD --- */}
      {reportType === 'ANALYTICS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
            {/* Chart 1: Revenue Bar */}
            <Card className="p-6 bg-slate-900 border-slate-800 lg:col-span-2">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center"><BarChart3 className="mr-2 text-emerald-500" /> Omzet per Maand</h3>
                </div>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.revenueChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                                itemStyle={{ color: '#10b981' }}
                                formatter={(value: number) => `€${value.toLocaleString()}`}
                            />
                            <Legend />
                            <Bar dataKey="omzet" name="Omzet (€)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Chart 2: Package Pie */}
            <Card className="p-6 bg-slate-900 border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center"><PieIcon className="mr-2 text-amber-500" /> Arrangementen Mix</h3>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={analyticsData.packageChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {analyticsData.packageChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Chart 3: Pacing Line */}
            <Card className="p-6 bg-slate-900 border-slate-800">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center"><TrendingUp className="mr-2 text-blue-500" /> Sales Pacing (Cumulatief)</h3>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.pacingChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }} />
                            <Legend />
                            <Line type="monotone" dataKey="thisMonth" name="Deze Maand" stroke="#3b82f6" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="lastMonth" name="Vorige Maand" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
      )}

      {/* --- STANDARD REPORTS (Day/Kitchen) --- */}
      {(reportType === 'DAY' || reportType === 'KITCHEN') && (
        <div className="flex-grow bg-slate-800/50 p-4 md:p-8 overflow-y-auto rounded-2xl print:p-0 print:bg-white print:overflow-visible">
            <div className="bg-white text-slate-900 shadow-2xl mx-auto w-full md:w-[210mm] min-h-[297mm] p-6 md:p-[15mm] print:shadow-none print:m-0 print:w-full print:h-auto print:min-h-0 rounded-sm">
                {/* Re-using logic from original file for rendering tables */}
                {(() => {
                    const stats = getDailyStats(selectedDate);
                    if (reportType === 'DAY') {
                        return (
                            <div className="space-y-8">
                                <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
                                    <div>
                                        <h1 className="text-3xl font-serif font-bold">Dagrapportage</h1>
                                        <p className="text-slate-500 capitalize">{new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">{stats.show?.name || 'Geen Show'}</p>
                                        <p className="text-sm">Totaal Gasten: {stats.totalGuests}</p>
                                    </div>
                                </div>
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-slate-100 uppercase text-xs font-bold">
                                        <tr><th className="p-2">Naam</th><th className="p-2">Pers.</th><th className="p-2">Arrangement</th><th className="p-2">Dieet</th></tr>
                                    </thead>
                                    <tbody>
                                        {stats.reservations.map(r => (
                                            <tr key={r.id} className="border-b border-slate-200">
                                                <td className="p-2">{r.customer.lastName}, {r.customer.firstName}</td>
                                                <td className="p-2">{r.partySize}</td>
                                                <td className="p-2 capitalize">{r.packageType}</td>
                                                <td className="p-2 text-red-600 font-bold">{r.notes.dietary}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    }
                    if (reportType === 'KITCHEN') {
                        return (
                            <div className="space-y-8">
                                <h1 className="text-4xl font-black uppercase border-b-4 border-black pb-4">Keukenlijst</h1>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="p-6 bg-slate-100 border border-slate-300">
                                        <h3 className="font-bold text-xl mb-4">Totaal: {stats.totalGuests}</h3>
                                        <div className="flex justify-between text-lg"><span>Standard:</span> <strong>{stats.packageCounts.standard}</strong></div>
                                        <div className="flex justify-between text-lg"><span>Premium:</span> <strong>{stats.packageCounts.premium}</strong></div>
                                    </div>
                                    <div className="p-6 bg-red-50 border border-red-200">
                                        <h3 className="font-bold text-xl text-red-700 mb-4">Dieetwensen</h3>
                                        <ul className="space-y-2">
                                            {stats.dietary.map((d, i) => (
                                                <li key={i} className="flex justify-between font-bold"><span>{d.note}</span> <span className="font-normal">{d.name} ({d.guests})</span></li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        );
                    }
                })()}
            </div>
        </div>
      )}
    </div>
  );
};
