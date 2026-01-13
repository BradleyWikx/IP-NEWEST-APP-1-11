
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, Search, Mail, Phone, Calendar, 
  ChevronRight, Star, AlertCircle, ShoppingBag, 
  ArrowUpRight, Ticket, X, Edit3, Save, MapPin, 
  Merge, RefreshCw, AlertTriangle, CheckCircle2, Trash2,
  Clock, MessageSquare, DollarSign
} from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { Customer, Reservation, BookingStatus } from '../../types';
import { loadData, saveData, STORAGE_KEYS, customerRepo, bookingRepo, getAuditLogs, getEmailLogs } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { calculateCustomerMetrics, getCustomerSegments, getSegmentStyle, getSegmentLabel, CustomerSegment } from '../../utils/customerLogic';
import { undoManager } from '../../utils/undoManager';
import { formatGuestName } from '../../utils/formatters';

// --- TIMELINE COMPONENT ---

const CustomerTimeline = ({ customerId, emails }: { customerId: string, emails: string[] }) => {
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        const bookings = bookingRepo.getAll(true).filter(r => r.customerId === customerId);
        const audits = getAuditLogs().filter(l => l.entityId === customerId || (l.entityType === 'RESERVATION' && bookings.some(b => b.id === l.entityId)));
        const emailLogs = getEmailLogs().filter(l => emails.includes(l.to));
        
        // Normalize
        const timeline = [
            ...bookings.map(b => ({
                id: b.id,
                date: b.createdAt,
                type: 'BOOKING',
                title: `Boeking: ${new Date(b.date).toLocaleDateString()}`,
                desc: `${b.partySize}p - ${b.status}`,
                icon: Ticket,
                color: 'blue'
            })),
            ...audits.map(a => ({
                id: a.id,
                date: a.timestamp,
                type: 'SYSTEM',
                title: `Systeem: ${a.action}`,
                desc: a.changes?.description || 'Geen details',
                icon: a.action.includes('DELETE') ? Trash2 : Edit3,
                color: 'slate'
            })),
            ...emailLogs.map(e => ({
                id: e.id,
                date: e.createdAt,
                type: 'EMAIL',
                title: `Email: ${e.subject}`,
                desc: `Status: ${e.status}`,
                icon: Mail,
                color: 'purple'
            }))
        ];

        setEvents(timeline.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, [customerId, emails]);

    return (
        <div className="space-y-6 pl-4 border-l border-slate-800 ml-2">
            {events.map(ev => {
                const Icon = ev.icon;
                return (
                    <div key={ev.id} className="relative pl-6">
                        <div className={`absolute -left-[25px] p-1 rounded-full bg-slate-900 border-2 border-${ev.color}-500 text-${ev.color}-500`}>
                            <Icon size={12} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-mono mb-0.5">
                                {new Date(ev.date).toLocaleString()}
                            </span>
                            <span className="text-sm font-bold text-white">{ev.title}</span>
                            <span className="text-xs text-slate-400">{ev.desc}</span>
                        </div>
                    </div>
                );
            })}
            {events.length === 0 && <p className="text-slate-500 italic text-xs">Geen historie beschikbaar.</p>}
        </div>
    );
};

interface CustomerProfile extends Customer {
  totalBookings: number;
  totalSpend: number;
  lastBookingDate: string | null;
  history: Reservation[];
  segments: CustomerSegment[]; // Replaced raw tags with computed segments
  rawTags: string[]; // Keep legacy tags
}

export const CustomerDatabase = () => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'MAINTENANCE'>('LIST');
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
        segments: [],
        rawTags: []
      });
    });

    // 2. Aggregate Reservations
    reservations.forEach((r) => {
      const res = r as any; 
      let profile = res.customerId ? profileMap.get(res.customerId) : undefined;
      
      // If customer exists but only in reservation (not in seed list), create entry
      if (!profile && res.customer) {
        // Try finding by email match first to avoid dupes in this transient map
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
            segments: [],
            rawTags: []
          };
          profileMap.set(profile.id, profile);
        }
      }

      if (profile) {
        profile.history.push(res);
        // Tag aggregation
        if (res.notes?.dietary && !profile.rawTags.includes('DIETARY')) profile.rawTags.push('DIETARY');
        if ((res.voucherCode || res.financials?.voucherCode) && !profile.rawTags.includes('VOUCHER')) profile.rawTags.push('VOUCHER');
      }
    });

    // 3. Compute Metrics & Segments
    const profiles = Array.from(profileMap.values()).map(p => {
      // Sort history
      p.history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      // Calculate Metrics
      const metrics = calculateCustomerMetrics(p.history);
      p.totalBookings = metrics.bookingCount;
      p.totalSpend = metrics.totalSpend;
      p.lastBookingDate = metrics.lastBookingDate ? metrics.lastBookingDate.toISOString() : null;
      
      // Assign Segments
      p.segments = getCustomerSegments(metrics);
      if(p.notes?.includes('VIP')) p.segments.push('VIP'); // Legacy manual override check

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
    customerRepo.update(editForm.id, () => editForm);
    
    logAuditAction('UPDATE_CUSTOMER', 'CUSTOMER', editForm.id, {
      description: 'Customer details updated',
      after: editForm
    });

    setIsEditing(false);
    refreshData();
    const updatedProfile = { ...selectedCustomer, ...editForm };
    setSelectedCustomer(updatedProfile);
    undoManager.showSuccess("Klantgegevens bijgewerkt.");
  };

  const handleDeleteCustomer = () => {
    if (!selectedCustomer) return;
    
    if (confirm(`Weet je zeker dat je ${selectedCustomer.firstName} ${selectedCustomer.lastName} wilt verwijderen?`)) {
      customerRepo.delete(selectedCustomer.id);
      
      logAuditAction('DELETE_CUSTOMER', 'CUSTOMER', selectedCustomer.id, {
        description: 'Customer soft deleted'
      });
      
      undoManager.showSuccess("Klant verwijderd.");
      setSelectedCustomer(null);
      refreshData();
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- DUPLICATE LOGIC ---
  const potentialDuplicates = useMemo(() => {
    const grouped = new Map<string, CustomerProfile[]>();
    customers.forEach(c => {
        const key = c.email.toLowerCase().trim();
        if (!key) return;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(c);
    });

    return Array.from(grouped.entries())
      .filter(([_, group]) => group.length > 1)
      .map(([email, group]) => ({ email, group }));
  }, [customers]);

  const handleMerge = (targetId: string, sourceId: string) => {
    if (!confirm("Weet je zeker dat je deze klanten wilt samenvoegen? Dit kan niet ongedaan worden gemaakt.")) return;

    const sourceCustomer = customers.find(c => c.id === sourceId);
    const targetCustomer = customers.find(c => c.id === targetId);
    if (!sourceCustomer || !targetCustomer) return;

    // 1. Move Reservations
    const sourceReservations = bookingRepo.getAll().filter(r => r.customerId === sourceId);
    
    sourceReservations.forEach(res => {
        bookingRepo.update(res.id, (r) => ({
            ...r,
            customerId: targetId,
            customer: { ...targetCustomer } // Update embedded snapshot
        }));
    });

    // 2. Delete Source Customer
    customerRepo.delete(sourceId);

    // 3. Log & Undo
    logAuditAction('MERGE_CUSTOMERS', 'CUSTOMER', targetId, {
        description: `Merged ${sourceId} into ${targetId}. Moved ${sourceReservations.length} bookings.`
    });

    undoManager.showSuccess(`${sourceReservations.length} boekingen overgezet. ${sourceCustomer.lastName} verwijderd.`);
    refreshData();
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Klantenbestand</h2>
          <p className="text-slate-500 text-sm">CRM en boekingshistorie.</p>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-slate-800">
        <button onClick={() => setActiveTab('LIST')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'LIST' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Lijst</button>
        <button onClick={() => setActiveTab('MAINTENANCE')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'MAINTENANCE' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            Onderhoud
            {potentialDuplicates.length > 0 && <span className="ml-2 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px]">{potentialDuplicates.length}</span>}
        </button>
      </div>

      {activeTab === 'LIST' && (
        <>
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

            <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold sticky top-0">
                    <tr>
                        <th className="p-4">Naam / Bedrijf</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4 text-center">Boekingen</th>
                        <th className="p-4 text-right">Totaal Besteed</th>
                        <th className="p-4">Segmenten</th>
                        <th className="p-4 text-right">Actie</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                    {filteredCustomers.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Geen klanten gevonden.</td></tr> :
                    filteredCustomers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-800/50 cursor-pointer group" onClick={() => { setSelectedCustomer(c); setIsEditing(false); }}>
                        <td className="p-4">
                            <div className="font-bold text-white">{formatGuestName(c.firstName, c.lastName)}</div>
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
                        <td className="p-4">
                            <div className="flex gap-1 flex-wrap">
                            {c.segments.map(seg => (
                                <span key={seg} className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${getSegmentStyle(seg)}`}>
                                    {getSegmentLabel(seg)}
                                </span>
                            ))}
                            {c.rawTags.includes('DIETARY') && <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5" title="Heeft Dieetwensen"/>}
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
        </>
      )}

      {/* ... Maintenance Tab ... */}
      {activeTab === 'MAINTENANCE' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center space-x-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="p-3 bg-blue-900/20 text-blue-500 rounded-full">
                      <Merge size={24} />
                  </div>
                  <div>
                      <h3 className="text-lg font-bold text-white">Duplicaten Detectie</h3>
                      <p className="text-sm text-slate-400">Er zijn <strong>{potentialDuplicates.length}</strong> groepen met mogelijke dubbele accounts gevonden op basis van e-mailadres.</p>
                  </div>
              </div>

              {potentialDuplicates.length === 0 ? (
                  <div className="text-center p-12 bg-slate-900/50 rounded-xl border border-dashed border-slate-800 text-slate-500">
                      <CheckCircle2 size={32} className="mx-auto mb-2 opacity-50 text-emerald-500" />
                      <p>Geen duplicaten gevonden.</p>
                  </div>
              ) : (
                  <div className="grid gap-6">
                      {potentialDuplicates.map((group, idx) => (
                          <Card key={idx} className="p-6 bg-slate-900 border-slate-800">
                              <h4 className="font-bold text-white mb-4 flex items-center">
                                  <AlertTriangle size={16} className="text-amber-500 mr-2" />
                                  {group.email} <span className="ml-2 text-xs font-normal text-slate-500">({group.group.length} records)</span>
                              </h4>
                              <div className="space-y-3">
                                  {group.group.map(cust => (
                                      <div key={cust.id} className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-slate-800">
                                          <div>
                                              <p className="text-sm font-bold text-slate-200">{formatGuestName(cust.firstName, cust.lastName)}</p>
                                              <p className="text-xs text-slate-500 font-mono">{cust.id} • {cust.totalBookings} boekingen</p>
                                          </div>
                                          
                                          {/* Merge Action: Merge INTO this customer */}
                                          <div className="flex space-x-2">
                                              {group.group.filter(c => c.id !== cust.id).map(source => (
                                                  <Button 
                                                    key={source.id} 
                                                    onClick={() => handleMerge(cust.id, source.id)}
                                                    variant="secondary"
                                                    className="text-[10px] h-7 px-2"
                                                  >
                                                      Voeg {source.firstName} ({source.id.slice(-4)}) hieraan toe
                                                  </Button>
                                              ))}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </Card>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* Detail Drawer */}
      <ResponsiveDrawer
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={isEditing ? "Klant Bewerken" : "Klant Details"}
        widthClass="md:w-[800px]"
      >
        {selectedCustomer && (
          <div className="space-y-8 pb-12">
            
            {/* Action Header inside Drawer */}
            {!isEditing && (
                <div className="flex justify-between items-start border-b border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <h2 className="text-2xl font-serif text-white">{selectedCustomer.salutation || 'Dhr.'} {formatGuestName(selectedCustomer.firstName, selectedCustomer.lastName)}</h2>
                            {selectedCustomer.segments.includes('VIP') && <Star size={16} className="text-amber-500 fill-amber-500" />}
                        </div>
                        <div className="flex gap-2 mt-2">
                            {selectedCustomer.segments.map(seg => (
                                <span key={seg} className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${getSegmentStyle(seg)}`}>
                                    {getSegmentLabel(seg)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => { setEditForm(selectedCustomer); setIsEditing(true); }} variant="secondary" className="h-8 text-xs">
                            <Edit3 size={14} className="mr-2"/> Bewerken
                        </Button>
                        <Button onClick={handleDeleteCustomer} variant="ghost" className="h-8 text-xs text-red-500 hover:bg-red-900/20 px-2">
                            <Trash2 size={14} />
                        </Button>
                    </div>
                </div>
            )}

            {isEditing && editForm ? (
                 <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                       <Input label="Voornaam" value={editForm.firstName} onChange={(e: any) => setEditForm({...editForm, firstName: e.target.value})} />
                       <Input label="Achternaam" value={editForm.lastName} onChange={(e: any) => setEditForm({...editForm, lastName: e.target.value})} />
                       <Input label="Email" value={editForm.email} onChange={(e: any) => setEditForm({...editForm, email: e.target.value})} className="col-span-2" />
                       <Input label="Telefoon" value={editForm.phone} onChange={(e: any) => setEditForm({...editForm, phone: e.target.value})} className="col-span-2" />
                       <Input label="Bedrijfsnaam" value={editForm.companyName} onChange={(e: any) => setEditForm({...editForm, companyName: e.target.value})} className="col-span-2" />
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
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setIsEditing(false)} variant="ghost" className="mr-2">Annuleren</Button>
                        <Button onClick={handleSaveCustomer} className="bg-emerald-600 hover:bg-emerald-700">Opslaan</Button>
                    </div>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Left: Info */}
                    <div className="space-y-6">
                       {/* Quick Stats */}
                       <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Boekingen</p>
                            <p className="text-lg font-bold text-white">{selectedCustomer.totalBookings}</p>
                          </div>
                          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Omzet</p>
                            <p className="text-lg font-bold text-emerald-500">€{selectedCustomer.totalSpend.toLocaleString()}</p>
                          </div>
                          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-center">
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Laatste</p>
                            <p className="text-xs font-bold text-white mt-1">{selectedCustomer.lastBookingDate ? new Date(selectedCustomer.lastBookingDate).toLocaleDateString() : '-'}</p>
                          </div>
                       </div>

                       <div className="space-y-4 text-sm">
                           <div className="flex items-center space-x-3 text-slate-300">
                                <Mail size={16} className="text-slate-500" /> <span>{selectedCustomer.email}</span>
                           </div>
                           <div className="flex items-center space-x-3 text-slate-300">
                                <Phone size={16} className="text-slate-500" /> <span>{selectedCustomer.phone}</span>
                           </div>
                           <div className="flex items-center space-x-3 text-slate-300">
                                <MapPin size={16} className="text-slate-500" /> 
                                <span>{selectedCustomer.street} {selectedCustomer.houseNumber}, {selectedCustomer.city}</span>
                           </div>
                       </div>

                       {selectedCustomer.notes && (
                         <div className="p-4 bg-amber-900/10 border border-amber-900/30 rounded-xl">
                           <h4 className="text-xs font-bold text-amber-500 uppercase mb-2">Interne Notities</h4>
                           <p className="text-sm text-amber-100 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                         </div>
                       )}
                    </div>

                    {/* Right: Interactive Timeline */}
                    <div className="border-l border-slate-800 pl-6 -ml-6 md:pl-0 md:ml-0 md:border-l-0">
                       <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Tijdlijn Interacties</h3>
                       <CustomerTimeline customerId={selectedCustomer.id} emails={[selectedCustomer.email]} />
                    </div>
                </div>
            )}
          </div>
        )}
      </ResponsiveDrawer>

    </div>
  );
};
