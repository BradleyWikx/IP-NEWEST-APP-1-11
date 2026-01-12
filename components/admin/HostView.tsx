
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, Users, Utensils, PartyPopper, AlertCircle, CheckCircle2, 
  Search, Package, Star, XCircle, Clock, Scan, UserX
} from 'lucide-react';
import { Button, Card, Input, Badge } from '../UI';
import { BookingStatus, Reservation } from '../../types';
import { MOCK_SHOW_TYPES as SHOW_TYPES_DATA, MOCK_ADDONS } from '../../mock/data';
import { bookingRepo, customerRepo } from '../../utils/storage';
import { ScannerModal } from './ScannerModal';
import { undoManager } from '../../utils/undoManager';

interface HostReservation {
  id: string;
  customerId: string; // Needed for risk lookup
  customerName: string;
  partySize: number;
  time: string; 
  status: BookingStatus;
  tableNumber?: number;
  packageType: string;
  addons: any[];
  notes: {
    dietary: string;
    isCelebrating: boolean;
    celebrationText?: string;
  };
  tags: string[];
  createdAt: string;
  showId: string;
  riskLevel: number; // 0 = none, >0 = count of no-shows
}

export const HostView = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'CANCELLED'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Scanner State
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const loadData = () => {
      setReservations(bookingRepo.getAll());
      setCustomers(customerRepo.getAll());
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleScanCheckIn = (res: Reservation) => {
    // In a real app, this would likely toggle a specific "arrived" boolean
    // For now, we'll visually acknowledge (or could update a local arrived state)
    undoManager.showSuccess(`${res.customer.firstName} is ingecheckt!`);
    setShowScanner(false);
  };

  const handleNoShow = (resId: string, customerId: string) => {
    if (!confirm("Markeer als No-Show? Dit wordt geregistreerd bij de klant.")) return;

    // 1. Update Reservation
    const res = bookingRepo.getById(resId);
    if (res) {
        bookingRepo.update(resId, r => ({ ...r, status: BookingStatus.NOSHOW }));
    }

    // 2. Update Customer Counter
    const cust = customerRepo.getById(customerId);
    if (cust) {
        const newCount = (cust.noShowCount || 0) + 1;
        customerRepo.update(customerId, c => ({ ...c, noShowCount: newCount }));
    }

    undoManager.showSuccess("No-Show geregistreerd.");
    // Data refresh happens via polling or could force it here
    const updatedRes = bookingRepo.getAll();
    setReservations(updatedRes);
    setCustomers(customerRepo.getAll());
  };

  // --- LOGIC: Dynamic Table Numbering ---
  const { activeList, cancelledList, stats } = useMemo(() => {
    const daily = reservations.filter(r => r.date === selectedDate);
    
    // 1. Separate Active vs Cancelled/NoShow
    const activeRaw = daily.filter(r => 
      r.status !== BookingStatus.CANCELLED && 
      r.status !== BookingStatus.ARCHIVED && 
      r.status !== BookingStatus.WAITLIST &&
      r.status !== BookingStatus.NOSHOW
    );
    
    const cancelledRaw = daily.filter(r => 
      r.status === BookingStatus.CANCELLED || 
      r.status === BookingStatus.ARCHIVED ||
      r.status === BookingStatus.NOSHOW
    );

    // 2. Sort Active by creation date (First come = Table 1)
    const sortedActive = activeRaw.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // 3. Map to View Model & Assign Dynamic Table Numbers
    const mapToHostModel = (res: any, index: number, isActive: boolean): HostReservation => {
      const show = SHOW_TYPES_DATA[res.showId];
      const customer = customers.find(c => c.id === res.customerId);
      const riskLevel = customer?.noShowCount || 0;
      
      const computedTags = [...(res.tags || [])];
      if (res.packageType === 'premium') computedTags.push('PREMIUM');
      if (res.addons?.some((a:any) => a.id.includes('after'))) computedTags.push('AFTERPARTY');

      return {
        id: res.id,
        customerId: res.customerId,
        customerName: `${res.customer.lastName}, ${res.customer.firstName}`,
        partySize: res.partySize, 
        time: res.startTime || show?.startTime || '19:30',
        status: res.status,
        packageType: res.packageType,
        addons: res.addons || [],
        // DYNAMIC TABLE LOGIC: Only active reservations get a number based on sorted index
        tableNumber: isActive ? index + 1 : undefined,
        notes: res.notes,
        tags: computedTags,
        createdAt: res.createdAt,
        showId: res.showId,
        riskLevel
      };
    };

    const activeList = sortedActive.map((r, i) => mapToHostModel(r, i, true));
    const cancelledList = cancelledRaw.map((r, i) => mapToHostModel(r, i, false));

    // Stats calculation
    const stats = {
      totalGuests: activeList.reduce((sum, r) => sum + r.partySize, 0),
      premiumCount: activeList.filter(r => r.packageType === 'premium').reduce((sum, r) => sum + r.partySize, 0),
      dietaryCount: activeList.filter(r => r.notes.dietary).length
    };

    return { activeList, cancelledList, stats };
  }, [reservations, customers, selectedDate]);

  const displayList = activeTab === 'ACTIVE' ? activeList : cancelledList;

  const filteredList = displayList.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <Button onClick={() => setShowScanner(true)} className="flex items-center bg-amber-600 hover:bg-amber-700 text-black border-none">
            <Scan size={18} className="mr-2" /> Scanner
          </Button>
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
            <div className="w-10 h-10 rounded-full bg-amber-900/20 text-amber-500 flex items-center justify-center"><Package size={20} /></div>
            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Premium</p><p className="text-xl text-white font-bold">{stats.premiumCount}</p></div>
         </Card>
         <Card className="p-4 bg-slate-900/50 border-slate-800 flex items-center space-x-4">
            <div className="w-10 h-10 rounded-full bg-red-900/20 text-red-500 flex items-center justify-center"><AlertCircle size={20} /></div>
            <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Dieet</p><p className="text-xl text-white font-bold">{stats.dietaryCount}</p></div>
         </Card>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
           <button 
             onClick={() => setActiveTab('ACTIVE')}
             className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center ${activeTab === 'ACTIVE' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <CheckCircle2 size={14} className="mr-2"/> Gastenlijst ({activeList.length})
           </button>
           <button 
             onClick={() => setActiveTab('CANCELLED')}
             className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center ${activeTab === 'CANCELLED' ? 'bg-red-900/20 text-red-400 border border-red-900/50 shadow' : 'text-slate-500 hover:text-slate-300'}`}
           >
             <XCircle size={14} className="mr-2"/> Geannuleerd / No-Show ({cancelledList.length})
           </button>
        </div>

        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
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
               <div className="text-right text-sm"><p>Gasten: {stats.totalGuests}</p><p>Premium: {stats.premiumCount}</p></div>
            </div>
         </div>

         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
             <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold print:bg-slate-100 print:text-black">
               <tr>
                 {activeTab === 'ACTIVE' && <th className="p-4 border-b border-slate-800 print:border-slate-300 w-20 text-center">Tafel</th>}
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-20">Tijd</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300">Naam / Groep</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-16 text-center">Pers.</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-40">Labels</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300">Bijzonderheden</th>
                 <th className="p-4 border-b border-slate-800 print:border-slate-300 w-20 text-center print:hidden">Status</th>
                 {activeTab === 'ACTIVE' && <th className="p-4 border-b border-slate-800 print:hidden w-16">Actie</th>}
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-800 print:divide-slate-300 text-sm">
               {filteredList.length === 0 ? (
                 <tr><td colSpan={8} className="p-8 text-center text-slate-500">Geen reserveringen gevonden in deze lijst.</td></tr>
               ) : (
                 filteredList.map((res) => (
                   <tr key={res.id} className={`group ${res.status === BookingStatus.CANCELLED || res.status === BookingStatus.NOSHOW ? 'opacity-50 hover:opacity-100 bg-red-900/5' : 'hover:bg-slate-800/50 print:hover:bg-transparent'}`}>
                     
                     {/* Dynamic Table Number - Only for Active */}
                     {activeTab === 'ACTIVE' && (
                       <td className="p-4 text-center align-top">
                         <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-serif text-xl font-bold text-white print:bg-white print:border-2 print:border-black print:text-black">
                           {res.tableNumber}
                         </div>
                       </td>
                     )}

                     <td className="p-4 font-mono text-slate-400 print:text-black align-top pt-5">{res.time}</td>
                     <td className="p-4 align-top pt-4">
                       <div className="flex items-center">
                         <div className="font-bold text-white print:text-black text-base">{res.customerName}</div>
                         {res.riskLevel > 1 && (
                           <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold uppercase rounded flex items-center animate-pulse">
                             <AlertCircle size={10} className="mr-1" /> Risico ({res.riskLevel})
                           </span>
                         )}
                       </div>
                       <div className="text-[10px] text-slate-500 print:text-slate-600 font-mono flex items-center gap-2">
                         {res.id}
                         <span className="print:hidden">• geboekt {new Date(res.createdAt).toLocaleDateString()}</span>
                       </div>
                     </td>
                     <td className="p-4 text-center font-bold text-white print:text-black text-lg align-top pt-4">{res.partySize}</td>
                     <td className="p-4 align-top pt-4">
                       <div className="flex flex-wrap gap-1">
                         {res.tags.map(tag => {
                            let style = 'bg-slate-800 text-slate-400 border-slate-700';
                            if (tag === 'PREMIUM') style = 'bg-amber-900/20 text-amber-500 border-amber-900/50 font-bold';
                            if (tag.includes('Mooie')) style = 'bg-pink-900/20 text-pink-400 border-pink-900/50 font-bold';
                            if (tag.includes('VIP')) style = 'bg-purple-900/20 text-purple-400 border-purple-900/50 font-bold';
                            
                            return (
                              <span key={tag} className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-wider border ${style} print:text-black print:border-black print:bg-transparent`}>
                                {tag}
                              </span>
                            );
                         })}
                       </div>
                     </td>
                     <td className="p-4 align-top pt-4">
                       <div className="flex flex-col gap-1">
                         {res.notes.dietary && (
                           <div className="flex items-start text-xs font-bold text-red-400 print:text-black"><Utensils size={12} className="mr-1 mt-0.5 shrink-0" /> {res.notes.dietary}</div>
                         )}
                         {res.notes.isCelebrating && (
                           <div className="flex items-start text-xs font-bold text-blue-400 print:text-black"><PartyPopper size={12} className="mr-1 mt-0.5 shrink-0" /> {res.notes.celebrationText || 'Viering'}</div>
                         )}
                         {res.addons.length > 0 && (
                           <div className="text-[10px] text-slate-400 print:text-black leading-tight">
                             {res.addons.map(a => `${a.quantity}x ${MOCK_ADDONS.find(ma => ma.id === a.id)?.name || a.id}`).join(', ')}
                           </div>
                         )}
                       </div>
                     </td>
                     <td className="p-4 text-center print:hidden align-top pt-4">
                        {res.status === BookingStatus.CANCELLED ? (
                          <Badge status="CANCELLED">Geannuleerd</Badge>
                        ) : res.status === BookingStatus.NOSHOW ? (
                          <Badge status="NOSHOW">No Show</Badge>
                        ) : (
                          <Badge status={res.status === BookingStatus.CONFIRMED ? 'CONFIRMED' : 'OPTION'}>{res.status === 'CONFIRMED' ? 'OK' : 'Optie'}</Badge>
                        )}
                     </td>
                     
                     {activeTab === 'ACTIVE' && (
                       <td className="p-4 align-top pt-4 print:hidden">
                         <Button 
                           variant="ghost" 
                           onClick={() => handleNoShow(res.id, res.customerId)} 
                           className="h-8 w-8 p-0 text-slate-500 hover:text-red-500 hover:bg-red-900/20"
                           title="Markeer als No-Show"
                         >
                           <UserX size={16} />
                         </Button>
                       </td>
                     )}
                   </tr>
                 ))
               )}
             </tbody>
           </table>
         </div>
      </Card>

      {/* SCANNER OVERLAY */}
      {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onCheckIn={handleScanCheckIn} />}
    </div>
  );
};
