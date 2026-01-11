
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, Search, Mail, Phone, Calendar, 
  ChevronRight, Star, AlertCircle, ShoppingBag, 
  ArrowUpRight, Ticket, X, Edit3, Save, MapPin
} from 'lucide-react';
import { Button, Input, Card, Badge } from '../UI';
import { Customer, Reservation, BookingStatus } from '../../types';
import { loadData, saveData, STORAGE_KEYS, customerRepo, bookingRepo } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';

interface CustomerProfile extends Customer {
  totalBookings: number;
  totalSpend: number;
  lastBookingDate: string | null;
  history: Reservation[];
  tags: string[];
}

export const CustomerDatabase = () => {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Customer | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const rawCustomers = customerRepo.getAll();
    const reservations = bookingRepo.getAll();

    // 1. Build Map of Customers (dedup by ID or Email)
    const profileMap = new Map<string, CustomerProfile>();

    // Initial population from Customer list
    rawCustomers.forEach(c => {
      profileMap.set(c.id, {
        ...c,
        totalBookings: 0,
        totalSpend: 0,
        lastBookingDate: null,
        history: [],
        tags: []
      });
    });

    // 2. Aggregate Reservations
    reservations.forEach((r) => {
      const res = r as any; 
      let profile = res.customerId ? profileMap.get(res.customerId) : undefined;
      
      // If customer exists but only in reservation (not in seed list), create entry
      if (!profile && res.customer) {
        // Try finding by email match first to avoid dupes
        const existingByEmail = Array.from(profileMap.values()).find(
          p => p.email.toLowerCase() === res.customer.email.toLowerCase()
        );

        if (existingByEmail) {
          profile = existingByEmail;
        } else {
          profile = {
            id: res.customerId || `CUST-GEN-${res.id}`,
            salutation: res.customer.salutation || 'Dhr.',
            firstName: res.customer.firstName,
            lastName: res.customer.lastName,
            email: res.customer.email,
            phone: res.customer.phone,
            companyName: res.customer.companyName,
            isBusiness: res.customer.isBusiness,
            address: res.customer.address,
            city: res.customer.city,
            street: res.customer.street,
            houseNumber: res.customer.houseNumber,
            zip: res.customer.zip,
            notes: res.customer.notes,
            totalBookings: 0,
            totalSpend: 0,
            lastBookingDate: null,
            history: [],
            tags: []
          };
          profileMap.set(profile.id, profile);
        }
      }

      if (profile) {
        profile.history.push(res);
        if (res.status !== BookingStatus.CANCELLED) {
          profile.totalBookings += 1;
          profile.totalSpend += (res.financials.finalTotal || res.financials.total || 0);
        }
        
        const resDate = new Date(res.date);
        if (!profile.lastBookingDate || resDate > new Date(profile.lastBookingDate)) {
          profile.lastBookingDate = res.date;
        }

        if (res.notes?.dietary && !profile.tags.includes('DIETARY')) profile.tags.push('DIETARY');
        if ((res.voucherCode || res.financials?.voucherCode) && !profile.tags.includes('VOUCHER')) profile.tags.push('VOUCHER');
      }
    });

    // 3. Finalize Tags
    const profiles = Array.from(profileMap.values()).map(p => {
      if (p.totalSpend > 500) p.tags.push('HIGH_VALUE');
      if (p.totalBookings > 3) p.tags.push('VIP');
      p.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return p;
    });

    const sorted = profiles.sort((a, b) => b.totalSpend - a.totalSpend);
    setCustomers(sorted);

    // Deep Linking: Auto Select
    const openId = searchParams.get('open');
    if (openId) {
      const match = sorted.find(c => c.id === openId);
      if (match) setSelectedCustomer(match);
      setSearchParams({});
    }
  };

  const handleSaveCustomer = () => {
    if (!editForm || !selectedCustomer) return;

    // Save to Repo
    customerRepo.update(editForm.id, () => editForm);
    
    // Also update any future reservations linking to this customer ID? 
    // Ideally yes, but for now we just update the CRM record. 
    // Usually reservation snapshots contact info at booking time.
    
    logAuditAction('UPDATE_CUSTOMER', 'CUSTOMER', editForm.id, {
      description: 'Customer details updated',
      after: editForm
    });

    setIsEditing(false);
    refreshData(); // Re-aggregates
    
    // Update selected view immediately
    const updatedProfile = { ...selectedCustomer, ...editForm };
    setSelectedCustomer(updatedProfile);
  };

  const filteredCustomers = customers.filter(c => 
    c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Klantenbestand</h2>
          <p className="text-slate-500 text-sm">CRM en boekingshistorie.</p>
        </div>
      </div>

      {/* Filter */}
      <Card className="p-4 bg-slate-900/50">
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
           <input 
             className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
             placeholder="Zoek op naam, email of bedrijf..."
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
         </div>
      </Card>

      {/* List */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-grow">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold sticky top-0">
              <tr>
                <th className="p-4">Naam / Bedrijf</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-center">Boekingen</th>
                <th className="p-4 text-right">Totaal Besteed</th>
                <th className="p-4">Laatste Bezoek</th>
                <th className="p-4">Labels</th>
                <th className="p-4 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredCustomers.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-slate-500">Geen klanten gevonden.</td></tr> :
              filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-slate-800/50 cursor-pointer group" onClick={() => { setSelectedCustomer(c); setIsEditing(false); }}>
                  <td className="p-4">
                    <div className="font-bold text-white">{c.firstName} {c.lastName}</div>
                    {c.isBusiness && <div className="text-xs text-amber-500 uppercase font-bold">{c.companyName}</div>}
                  </td>
                  <td className="p-4">
                    <div className="text-slate-300 flex items-center text-xs mb-1"><Mail size={12} className="mr-2 opacity-50"/>{c.email}</div>
                    <div className="text-slate-400 flex items-center text-xs"><Phone size={12} className="mr-2 opacity-50"/>{c.phone}</div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="font-bold text-white bg-slate-800 px-2 py-1 rounded-full text-xs">{c.totalBookings}</span>
                  </td>
                  <td className="p-4 text-right text-slate-300 font-mono">
                    €{c.totalSpend.toLocaleString()}
                  </td>
                  <td className="p-4 text-slate-500 text-xs">
                    {c.lastBookingDate ? new Date(c.lastBookingDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {c.tags.includes('VIP') && <span className="w-2 h-2 rounded-full bg-amber-500" title="Frequent Guest"/>}
                      {c.tags.includes('HIGH_VALUE') && <span className="w-2 h-2 rounded-full bg-emerald-500" title="High Spender"/>}
                      {c.tags.includes('DIETARY') && <span className="w-2 h-2 rounded-full bg-purple-500" title="Dietary Notes"/>}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-white"><ChevronRight size={16}/></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedCustomer && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={() => setSelectedCustomer(null)} />
          <div className="fixed top-0 right-0 h-full w-full md:w-[700px] bg-slate-950 border-l border-slate-900 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
             
             {/* Header */}
             <div className="p-6 border-b border-slate-900 bg-slate-900/50 flex justify-between items-start">
               <div>
                 {isEditing ? (
                   <h2 className="text-2xl font-serif text-white">Klant Bewerken</h2>
                 ) : (
                   <>
                     <div className="flex items-center space-x-2 mb-1">
                       <h2 className="text-2xl font-serif text-white">{selectedCustomer.salutation || 'Dhr.'} {selectedCustomer.firstName} {selectedCustomer.lastName}</h2>
                       {selectedCustomer.tags.includes('VIP') && <Star size={16} className="text-amber-500 fill-amber-500" />}
                     </div>
                     <p className="text-slate-500 text-xs font-mono">{selectedCustomer.id}</p>
                   </>
                 )}
               </div>
               <div className="flex items-center space-x-2">
                 {!isEditing ? (
                   <Button onClick={() => { setEditForm(selectedCustomer); setIsEditing(true); }} variant="secondary" className="h-8 text-xs">
                     <Edit3 size={14} className="mr-2"/> Bewerken
                   </Button>
                 ) : (
                   <Button onClick={handleSaveCustomer} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 border-none">
                     <Save size={14} className="mr-2"/> Opslaan
                   </Button>
                 )}
                 <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white"><X size={24}/></button>
               </div>
             </div>

             <div className="p-8 overflow-y-auto space-y-8 flex-grow">
               
               {isEditing && editForm ? (
                 <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                       <Input label="Voornaam" value={editForm.firstName} onChange={(e: any) => setEditForm({...editForm, firstName: e.target.value})} />
                       <Input label="Achternaam" value={editForm.lastName} onChange={(e: any) => setEditForm({...editForm, lastName: e.target.value})} />
                       <Input label="Email" value={editForm.email} onChange={(e: any) => setEditForm({...editForm, email: e.target.value})} />
                       <Input label="Telefoon" value={editForm.phone} onChange={(e: any) => setEditForm({...editForm, phone: e.target.value})} />
                       <Input label="Bedrijfsnaam" value={editForm.companyName} onChange={(e: any) => setEditForm({...editForm, companyName: e.target.value})} />
                    </div>
                    
                    <div className="pt-4 border-t border-slate-900">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Adresgegevens</h4>
                      <div className="grid grid-cols-4 gap-4">
                         <div className="col-span-3"><Input label="Straat" value={editForm.street} onChange={(e: any) => setEditForm({...editForm, street: e.target.value})} /></div>
                         <div className="col-span-1"><Input label="Huisnummer" value={editForm.houseNumber} onChange={(e: any) => setEditForm({...editForm, houseNumber: e.target.value})} /></div>
                         <div className="col-span-1"><Input label="Postcode" value={editForm.zip} onChange={(e: any) => setEditForm({...editForm, zip: e.target.value})} /></div>
                         <div className="col-span-3"><Input label="Stad" value={editForm.city} onChange={(e: any) => setEditForm({...editForm, city: e.target.value})} /></div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-900">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Interne Notities (CRM)</label>
                      <textarea 
                        className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none resize-none"
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        placeholder="Plaats hier notities over voorkeuren, klachten of bijzonderheden..."
                      />
                    </div>
                 </div>
               ) : (
                 <>
                   {/* Quick Stats */}
                   <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Totaal</p>
                        <p className="text-xl font-bold text-white">{selectedCustomer.totalBookings}</p>
                      </div>
                      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Waarde</p>
                        <p className="text-xl font-bold text-emerald-500">€{selectedCustomer.totalSpend.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Laatste</p>
                        <p className="text-sm font-bold text-white mt-1">{selectedCustomer.lastBookingDate ? new Date(selectedCustomer.lastBookingDate).toLocaleDateString() : '-'}</p>
                      </div>
                   </div>

                   {/* Contact Info */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest border-b border-slate-800 pb-2">Gegevens</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3 text-slate-300">
                            <Mail size={14} className="text-slate-500" /> <span>{selectedCustomer.email}</span>
                          </div>
                          <div className="flex items-center space-x-3 text-slate-300">
                            <Phone size={14} className="text-slate-500" /> <span>{selectedCustomer.phone}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="text-slate-300">
                            <p className="text-xs text-slate-500 mb-1 flex items-center"><MapPin size={10} className="mr-1"/> Adres</p>
                            <p>{selectedCustomer.street} {selectedCustomer.houseNumber}</p>
                            <p>{selectedCustomer.zip} {selectedCustomer.city}</p>
                          </div>
                          {selectedCustomer.isBusiness && (
                            <div className="text-slate-300">
                              <p className="text-xs text-slate-500 mb-1">Bedrijf</p>
                              <p className="font-bold text-amber-500">{selectedCustomer.companyName}</p>
                            </div>
                          )}
                        </div>
                     </div>
                   </div>

                   {/* Notes Section */}
                   {selectedCustomer.notes && (
                     <div className="p-4 bg-amber-900/10 border border-amber-900/30 rounded-xl">
                       <h4 className="text-xs font-bold text-amber-500 uppercase mb-2">Interne Notities</h4>
                       <p className="text-sm text-amber-100 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                     </div>
                   )}

                   {/* Actions */}
                   <div className="grid grid-cols-2 gap-4">
                     <Button variant="secondary" className="flex items-center justify-center">
                       <Mail size={16} className="mr-2" /> Stuur Email
                     </Button>
                     <Button variant="primary" className="flex items-center justify-center bg-blue-600 border-blue-500 hover:bg-blue-700">
                       <ArrowUpRight size={16} className="mr-2" /> Nieuwe Boeking
                     </Button>
                   </div>

                   {/* History */}
                   <div className="space-y-4">
                     <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest border-b border-slate-800 pb-2">Historie</h3>
                     {selectedCustomer.history.length === 0 ? (
                       <p className="text-slate-500 text-sm">Geen historie beschikbaar.</p>
                     ) : (
                       <div className="space-y-3">
                         {selectedCustomer.history.map(res => (
                           <div key={res.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-600 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-bold text-white text-sm">{new Date(res.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                  <p className="text-xs text-slate-500">{res.id}</p>
                                </div>
                                <Badge status={res.status} />
                              </div>
                              <div className="flex justify-between items-center text-xs mt-3 pt-3 border-t border-slate-800">
                                 <span className="flex items-center text-slate-300"><Users size={12} className="mr-1"/> {res.partySize} personen</span>
                                 <span className="font-mono text-emerald-500 font-bold">€{(res.financials.finalTotal || res.financials.total).toFixed(2)}</span>
                              </div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 </>
               )}
             </div>
          </div>
        </>
      )}
    </div>
  );
};
