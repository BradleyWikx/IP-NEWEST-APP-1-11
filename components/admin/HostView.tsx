
import React, { useState, useEffect } from 'react';
import { 
  Printer, Users, Utensils, PartyPopper, AlertCircle, CheckCircle2, 
  Search
} from 'lucide-react';
import { Button, Card, Input } from '../UI';
import { BookingStatus } from '../../types';
import { MOCK_SHOW_TYPES as SHOW_TYPES_DATA } from '../../mock/data';
import { bookingRepo } from '../../utils/storage';

interface HostReservation {
  id: string;
  customerName: string;
  partySize: number;
  time: string; 
  status: BookingStatus;
  tableNumber?: number;
  notes: {
    dietary: string;
    isCelebrating: boolean;
    celebrationText?: string;
  };
  createdAt: string;
  showId: string;
}

export const HostView = () => {
  const [selectedDate, setSelectedDate] = useState('2025-05-12');
  const [reservations, setReservations] = useState<any[]>([]);
  const [hostList, setHostList] = useState<HostReservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load Data via Repository
  useEffect(() => {
    const loadData = () => {
      const stored = bookingRepo.getAll();
      setReservations(stored);
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Process & Number Reservations
  useEffect(() => {
    const daily = reservations.filter(r => r.date === selectedDate);
    const activeStatuses = ['CONFIRMED', 'INVITED', 'OPTION'];
    const sorted = daily.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let tableCounter = 1;

    const processed = sorted.map((res: any) => {
      const isEligibleForTable = activeStatuses.includes(res.status);
      const show = SHOW_TYPES_DATA[res.showId];
      
      return {
        id: res.id,
        customerName: `${res.customer.lastName}, ${res.customer.firstName}`,
        partySize: res.partySize, // Use strict field
        time: res.startTime || show?.startTime || '19:30',
        status: res.status,
        tableNumber: isEligibleForTable ? tableCounter++ : undefined,
        notes: res.notes,
        createdAt: res.createdAt,
        showId: res.showId
      };
    });
    
    const other = daily
      .filter(r => !activeStatuses.includes(r.status))
      .map((res: any) => ({
        id: res.id,
        customerName: `${res.customer.lastName}, ${res.customer.firstName}`,
        partySize: res.partySize, // Use strict field
        time: SHOW_TYPES_DATA[res.showId]?.startTime || '19:30',
        status: res.status,
        tableNumber: undefined,
        notes: res.notes,
        createdAt: res.createdAt,
        showId: res.showId
      }));

    const final = [...processed, ...other].sort((a, b) => {
      if (a.tableNumber && b.tableNumber) return a.tableNumber - b.tableNumber;
      if (a.tableNumber) return -1;
      if (b.tableNumber) return 1;
      return 0;
    });

    setHostList(final);
  }, [reservations, selectedDate]);

  const filteredList = hostList.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalGuests: hostList.filter(r => r.tableNumber).reduce((sum, r) => sum + r.partySize, 0),
    tablesAssigned: hostList.filter(r => r.tableNumber).length,
    dietaryCount: hostList.filter(r => r.notes.dietary).length
  };

  const handlePrint = () => { window.print(); };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end print:hidden">
        <div>
          <h2 className="text-3xl font-serif text-white">Host Dashboard</h2>
          <p className="text-slate-500 text-sm">Deurmanagement & Placering</p>
        </div>
        <div className="flex items-center space-x-4">
          <Input 
            type="date" 
            value={selectedDate} 
            onChange={(e: any) => setSelectedDate(e.target.value)}
            className="bg-slate-900 border-slate-800 text-white"
          />
          <Button onClick={handlePrint} variant="secondary" className="flex items-center">
            <Printer size={18} className="mr-2" /> Print Gastenlijst
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
         <Card className="p-4 bg-slate-900/50 border-slate-800 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-emerald-900/20 text-emerald-500 flex items-center justify-center"><Users size={20} /></div>
            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gasten</p><p className="text-xl text-white font-bold">{stats.totalGuests}</p></div>
         </Card>
         <Card className="p-4 bg-slate-900/50 border-slate-800 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-blue-900/20 text-blue-500 flex items-center justify-center"><Utensils size={20} /></div>
            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Tafels</p><p className="text-xl text-white font-bold">{stats.tablesAssigned}</p></div>
         </Card>
         <Card className="p-4 bg-slate-900/50 border-slate-800 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-amber-900/20 text-amber-500 flex items-center justify-center"><AlertCircle size={20} /></div>
            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Dieet</p><p className="text-xl text-white font-bold">{stats.dietaryCount}</p></div>
         </Card>
      </div>

      <div className="print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500"
            placeholder="Zoek gast op naam of nummer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="flex-grow bg-slate-900 border-slate-800 overflow-hidden print:border-0 print:bg-white print:text-black print:shadow-none">
         <div className="hidden print:block p-8 pb-0">
            <h1 className="text-4xl font-serif font-bold mb-2">Gastenlijst</h1>
            <div className="flex justify-between items-end border-b-2 border-black pb-4">
               <p className="text-lg">Datum: {new Date(selectedDate).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
               <div className="text-right text-sm"><p>Gasten: {stats.totalGuests}</p><p>Tafels: {stats.tablesAssigned}</p></div>
            </div>
         </div>

         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
             <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold print:bg-slate-100 print:text-black">
               <tr>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-24 text-center">Tafel</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-24">Tijd</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300">Naam / Groep</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-24 text-center">Pers.</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-32">Status</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300">Bijzonderheden</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-20 text-center print:hidden">Check</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-sm">
               {filteredList.length === 0 ? (
                 <tr><td colSpan={7} className="p-8 text-center text-slate-500">Geen reserveringen voor deze datum.</td></tr>
               ) : (
                 filteredList.map((res) => (
                   <tr key={res.id} className="hover:bg-slate-800/50 print:hover:bg-transparent group">
                     <td className="p-4 text-center">
                       {res.tableNumber ? (
                         <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-serif text-xl font-bold text-white print:bg-white print:border-2 print:border-black print:text-black">
                           {res.tableNumber}
                         </div>
                       ) : (
                         <span className="text-slate-600">-</span>
                       )}
                     </td>
                     <td className="p-4 font-mono text-slate-400 print:text-black">{res.time}</td>
                     <td className="p-4">
                       <div className="font-bold text-white print:text-black text-lg">{res.customerName}</div>
                       <div className="text-xs text-slate-500 print:text-slate-600">{res.id}</div>
                     </td>
                     <td className="p-4 text-center font-bold text-white print:text-black text-lg">{res.partySize}</td>
                     <td className="p-4">
                       <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${res.status === 'CONFIRMED' ? 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50 print:border-black print:text-black print:bg-transparent' : res.status === 'INVITED' ? 'bg-purple-900/20 text-purple-500 border-purple-900/50 print:border-black print:text-black print:bg-transparent' : 'bg-slate-800 text-slate-500 border-slate-700 print:border-slate-400'}`}>
                         {res.status}
                       </span>
                     </td>
                     <td className="p-4">
                       <div className="flex flex-wrap gap-2">
                         {res.notes.dietary && (
                           <div className="flex items-center space-x-1 px-2 py-1 rounded bg-amber-900/20 border border-amber-900/50 text-amber-500 print:border-black print:text-black print:bg-transparent"><Utensils size={12} /><span className="text-xs font-bold">{res.notes.dietary}</span></div>
                         )}
                         {res.notes.isCelebrating && (
                           <div className="flex items-center space-x-1 px-2 py-1 rounded bg-red-900/20 border border-red-900/50 text-red-500 print:border-black print:text-black print:bg-transparent"><PartyPopper size={12} /><span className="text-xs font-bold">{res.notes.celebrationText || 'Viering'}</span></div>
                         )}
                       </div>
                     </td>
                     <td className="p-4 text-center print:hidden">
                        <button className="w-8 h-8 rounded-full border border-slate-700 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white text-slate-600 transition-colors flex items-center justify-center"><CheckCircle2 size={16} /></button>
                     </td>
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         </div>
      </Card>
    </div>
  );
};
