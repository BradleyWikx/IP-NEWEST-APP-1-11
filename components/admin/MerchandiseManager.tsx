
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Filter, Trash2, Edit3, Save, X, 
  ShoppingBag, Check, Eye, Tag, DollarSign, Image as ImageIcon,
  MoreHorizontal, AlertCircle, ToggleLeft, ToggleRight, List,
  ClipboardList, Package, User, Calendar, Printer, ChevronLeft, ChevronRight, BarChart3
} from 'lucide-react';
import { Button, Input, Card, Badge } from '../UI';
import { MerchandiseItem, Reservation } from '../../types';
import { getMerchandise, saveData, STORAGE_KEYS, bookingRepo } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { MerchandiseItemCard } from '../MerchandisePicker';

const CATEGORIES = ['Souvenir', 'Home', 'Apparel', 'Art', 'Food & Bev'];

export const MerchandiseManager = () => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'DAILY' | 'WEEKLY'>('CATALOG');
  const [items, setItems] = useState<MerchandiseItem[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // Catalog State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MerchandiseItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState('');

  // Report State
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Load Data
  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setItems(getMerchandise());
    setReservations(bookingRepo.getAll());
  };

  // --- REPORT LOGIC ---

  const getDailyData = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    
    // Filter valid reservations with merchandise
    const relevantRes = reservations.filter(r => 
        r.date === dateStr && 
        r.status !== 'CANCELLED' && 
        r.status !== 'ARCHIVED' &&
        r.merchandise && r.merchandise.length > 0
    );

    // 1. Aggregated Production List
    const productionMap = new Map<string, { count: number, category: string }>();
    
    // 2. Per Reservation Distribution List
    const distributionList = relevantRes.map(r => {
        const orderItems = r.merchandise.map(m => {
            const def = items.find(i => i.id === m.id);
            if (def) {
                const current = productionMap.get(def.name) || { count: 0, category: def.category };
                productionMap.set(def.name, { count: current.count + m.quantity, category: def.category });
            }
            return {
                name: def ? def.name : 'Unknown',
                quantity: m.quantity,
                category: def ? def.category : '-'
            };
        });

        return {
            id: r.id,
            guestName: `${r.customer.firstName} ${r.customer.lastName}`,
            table: (r as any).tableId ? (r as any).tableId.replace('TAB-', '') : '-',
            items: orderItems
        };
    });

    return {
        productionList: Array.from(productionMap.entries()).map(([name, data]) => ({ name, ...data })),
        distributionList
    };
  };

  const getWeeklyForecast = (startDate: Date) => {
    const forecast: Record<string, number[]> = {}; // ItemName -> [Day1Count, Day2Count...]
    const days: Date[] = [];
    const itemNames = items.map(i => i.name);

    // Initialize
    itemNames.forEach(name => forecast[name] = [0,0,0,0,0,0,0]);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        days.push(d);
        const dStr = d.toISOString().split('T')[0];

        const dayRes = reservations.filter(r => 
            r.date === dStr && 
            r.status !== 'CANCELLED' && 
            r.status !== 'ARCHIVED' &&
            r.merchandise && r.merchandise.length > 0
        );

        dayRes.forEach(r => {
            r.merchandise.forEach(m => {
                const def = items.find(it => it.id === m.id);
                if (def && forecast[def.name]) {
                    forecast[def.name][i] += m.quantity;
                }
            });
        });
    }

    return { days, forecast };
  };

  const handlePrint = () => window.print();

  // --- CATALOG ACTIONS ---

  const handleSave = () => {
    if (!editingItem) return;
    setFormError(null);

    // Validation
    if (!editingItem.name.trim()) {
      setFormError("Productnaam is verplicht.");
      return;
    }
    if (editingItem.price <= 0) {
      setFormError("Prijs moet hoger zijn dan 0.");
      return;
    }
    if (!editingItem.category) {
      setFormError("Selecteer een categorie.");
      return;
    }

    const isNew = !items.find(i => i.id === editingItem.id);
    let newItems;

    if (isNew) {
      newItems = [...items, editingItem];
    } else {
      newItems = items.map(i => i.id === editingItem.id ? editingItem : i);
    }

    saveData(STORAGE_KEYS.MERCHANDISE, newItems);
    setItems(newItems);
    setIsDrawerOpen(false);
    
    logAuditAction(isNew ? 'CREATE_ITEM' : 'UPDATE_ITEM', 'SYSTEM', editingItem.id, {
      description: `Saved merchandise: ${editingItem.name}`,
      after: editingItem
    });
  };

  const toggleStatus = (id: string) => {
    const updated = items.map(i => i.id === id ? { ...i, active: !i.active } : i);
    saveData(STORAGE_KEYS.MERCHANDISE, updated);
    setItems(updated);
  };

  // --- BULK ACTIONS ---

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleBulkStatus = (active: boolean) => {
    const updated = items.map(i => selectedIds.has(i.id) ? { ...i, active } : i);
    saveData(STORAGE_KEYS.MERCHANDISE, updated);
    setItems(updated);
    setSelectedIds(new Set()); // Clear selection
    logAuditAction('BULK_UPDATE', 'SYSTEM', 'MULTIPLE', { description: `Set ${selectedIds.size} items to ${active ? 'active' : 'inactive'}` });
  };

  const handleBulkCategoryChange = () => {
    if (!bulkCategory) return;
    const updated = items.map(i => selectedIds.has(i.id) ? { ...i, category: bulkCategory } : i);
    saveData(STORAGE_KEYS.MERCHANDISE, updated);
    setItems(updated);
    setSelectedIds(new Set());
    setBulkCategory('');
    logAuditAction('BULK_UPDATE', 'SYSTEM', 'MULTIPLE', { description: `Moved ${selectedIds.size} items to ${bulkCategory}` });
  };

  // --- DERIVED STATE ---

  const filteredItems = useMemo(() => {
    return items.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // --- RENDERERS ---

  const openEditor = (item?: MerchandiseItem) => {
    if (item) {
      setEditingItem({ ...item });
    } else {
      setEditingItem({
        id: `MERCH-${Date.now()}`,
        name: '',
        price: 0,
        category: CATEGORIES[0],
        stock: 100,
        description: '',
        active: true,
        image: ''
      });
    }
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const dailyData = useMemo(() => getDailyData(selectedDate), [selectedDate, reservations, items]);
  const weeklyData = useMemo(() => getWeeklyForecast(selectedDate), [selectedDate, reservations, items]);

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end print:hidden">
        <div>
          <h2 className="text-3xl font-serif text-white">Merchandise</h2>
          <p className="text-slate-500 text-sm">Beheer catalogus en productierapporten.</p>
        </div>
        <div className="flex space-x-2">
            {activeTab === 'CATALOG' ? (
                <Button onClick={() => openEditor()} className="flex items-center">
                <Plus size={18} className="mr-2" /> Nieuw Item
                </Button>
            ) : (
                <Button variant="secondary" onClick={handlePrint} className="flex items-center bg-white text-black hover:bg-slate-200 border-none">
                    <Printer size={18} className="mr-2"/> Print Rapport
                </Button>
            )}
        </div>
      </div>

      <div className="flex space-x-1 border-b border-slate-800 print:hidden">
        <button onClick={() => setActiveTab('CATALOG')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'CATALOG' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Catalogus</button>
        <button onClick={() => setActiveTab('DAILY')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'DAILY' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Dagproductie</button>
        <button onClick={() => setActiveTab('WEEKLY')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'WEEKLY' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Weekoverzicht</button>
      </div>

      {activeTab === 'DAILY' && (
          <div className="flex-grow flex flex-col space-y-6">
              {/* Date Control */}
              <div className="print:hidden flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><Calendar size={20}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Selecteer Datum</p>
                        <input 
                            type="date" 
                            value={selectedDate.toISOString().split('T')[0]} 
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="bg-transparent text-white font-bold outline-none"
                        />
                    </div>
                 </div>
                 <div className="flex space-x-2">
                    <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n; })} className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white"><ChevronLeft size={16}/></button>
                    <button onClick={() => setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n; })} className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white"><ChevronRight size={16}/></button>
                 </div>
              </div>

              {/* REPORT CONTENT */}
              <div className="bg-white text-slate-900 p-8 rounded-sm shadow-2xl min-h-[297mm] print:shadow-none print:w-full print:m-0">
                 
                 <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-black uppercase">Merchandise Productie</h1>
                        <p className="text-xl mt-2">{selectedDate.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold uppercase tracking-widest text-slate-500">Totaal Items</div>
                        <div className="text-4xl font-black">{dailyData.productionList.reduce((s,i)=>s+i.count,0)}</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-12">
                    
                    {/* LEFT: SUMMARY */}
                    <div>
                        <h3 className="text-lg font-bold uppercase mb-4 flex items-center border-b-2 border-slate-200 pb-2">
                            <ClipboardList size={20} className="mr-2"/> Te Maken / Verzamelen
                        </h3>
                        {dailyData.productionList.length === 0 ? (
                            <p className="text-slate-400 italic">Geen items.</p>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="text-xs uppercase bg-slate-100 text-slate-600">
                                    <tr><th className="p-2">Aantal</th><th className="p-2">Item</th><th className="p-2">Categorie</th></tr>
                                </thead>
                                <tbody>
                                    {dailyData.productionList.map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="p-3 font-black text-xl">{item.count}x</td>
                                            <td className="p-3 font-bold">{item.name}</td>
                                            <td className="p-3 text-sm text-slate-500">{item.category}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* RIGHT: DISTRIBUTION */}
                    <div>
                        <h3 className="text-lg font-bold uppercase mb-4 flex items-center border-b-2 border-slate-200 pb-2">
                            <Package size={20} className="mr-2"/> Uitgifte Per Gast
                        </h3>
                        {dailyData.distributionList.length === 0 ? (
                            <p className="text-slate-400 italic">Geen reserveringen met merchandise.</p>
                        ) : (
                            <div className="space-y-4">
                                {dailyData.distributionList.map((dist, idx) => (
                                    <div key={idx} className="border border-slate-200 p-4 rounded-lg bg-slate-50 break-inside-avoid">
                                        <div className="flex justify-between font-bold mb-2">
                                            <span>{dist.guestName}</span>
                                            <span className="bg-black text-white px-2 rounded text-sm">Tafel {dist.table}</span>
                                        </div>
                                        <ul className="text-sm space-y-1">
                                            {dist.items.map((item: any, i: number) => (
                                                <li key={i} className="flex justify-between">
                                                    <span>{item.name}</span>
                                                    <span className="font-bold">{item.quantity}x</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                 </div>
              </div>
          </div>
      )}

      {activeTab === 'WEEKLY' && (
          <div className="flex-grow flex flex-col space-y-6">
              {/* Date Control */}
              <div className="print:hidden flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                 <div className="flex items-center space-x-4">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400"><BarChart3 size={20}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Start Datum Week</p>
                        <input 
                            type="date" 
                            value={selectedDate.toISOString().split('T')[0]} 
                            onChange={(e) => setSelectedDate(new Date(e.target.value))}
                            className="bg-transparent text-white font-bold outline-none"
                        />
                    </div>
                 </div>
              </div>

              {/* REPORT CONTENT */}
              <div className="bg-white text-slate-900 p-8 rounded-sm shadow-2xl min-h-[297mm] print:shadow-none print:w-full print:m-0 print:landscape">
                 <div className="border-b-4 border-black pb-6 mb-8">
                    <h1 className="text-4xl font-black uppercase">Weekplanning Merchandise</h1>
                    <p className="text-xl mt-2">Week van {selectedDate.toLocaleDateString('nl-NL')}</p>
                 </div>

                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-black text-white text-xs uppercase">
                            <tr>
                                <th className="p-4 border-r border-white/20">Item</th>
                                {weeklyData.days.map(d => (
                                    <th key={d.toISOString()} className="p-4 text-center border-r border-white/20 w-24">
                                        <div className="font-bold">{d.toLocaleDateString('nl-NL', { weekday: 'short' })}</div>
                                        <div className="font-normal">{d.getDate()}</div>
                                    </th>
                                ))}
                                <th className="p-4 text-center w-24 bg-slate-800">Totaal</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {Object.entries(weeklyData.forecast).map(([name, counts], idx) => {
                                const total = (counts as number[]).reduce((a,b)=>a+b,0);
                                if (total === 0) return null; // Skip empty rows

                                return (
                                    <tr key={name} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                        <td className="p-4 font-bold border-r border-slate-200">{name}</td>
                                        {(counts as number[]).map((c, i) => (
                                            <td key={i} className="p-4 text-center border-r border-slate-200">
                                                {c > 0 ? <span className="font-bold">{c}</span> : <span className="text-slate-300">-</span>}
                                            </td>
                                        ))}
                                        <td className="p-4 text-center font-black bg-slate-100">{total}</td>
                                    </tr>
                                );
                            })}
                            {Object.keys(weeklyData.forecast).every(key => (weeklyData.forecast[key] as number[]).reduce((a,b)=>a+b,0) === 0) && (
                                <tr><td colSpan={9} className="p-12 text-center text-slate-400 italic">Geen merchandise gepland voor deze week.</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
              </div>
          </div>
      )}

      {activeTab === 'CATALOG' && (
        <>
            {/* Toolbar / Search */}
            <Card className="p-4 bg-slate-900/50">
                {selectedIds.size > 0 ? (
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-amber-900/20 border border-amber-900/50 p-2 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center space-x-4 pl-2">
                    <span className="text-amber-500 font-bold text-sm">{selectedIds.size} geselecteerd</span>
                    <div className="h-4 w-px bg-amber-900/50" />
                    <button onClick={() => handleBulkStatus(true)} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">Activeer</button>
                    <button onClick={() => handleBulkStatus(false)} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">Deactiveer</button>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                    <select 
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                        value={bulkCategory}
                        onChange={(e) => setBulkCategory(e.target.value)}
                    >
                        <option value="">Verplaats naar...</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <Button variant="secondary" onClick={handleBulkCategoryChange} disabled={!bulkCategory} className="py-1.5 h-auto text-xs">Toepassen</Button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-2 text-slate-500 hover:text-white"><X size={16}/></button>
                    </div>
                </div>
                ) : (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="Zoek op naam of categorie..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                )}
            </Card>

            {/* Data Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex-grow flex flex-col">
                <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-800">
                    <tr>
                        <th className="p-4 w-12">
                        <input 
                            type="checkbox" 
                            className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500"
                            checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                            onChange={toggleAll}
                        />
                        </th>
                        <th className="p-4 w-20">Preview</th>
                        <th className="p-4">Item</th>
                        <th className="p-4">Categorie</th>
                        <th className="p-4 text-right">Prijs</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-right">Acties</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                    {filteredItems.length === 0 ? (
                        <tr><td colSpan={7} className="p-12 text-center text-slate-500">Geen items gevonden.</td></tr>
                    ) : (
                        filteredItems.map(item => (
                        <tr key={item.id} className="group hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">
                            <input 
                                type="checkbox" 
                                className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500"
                                checked={selectedIds.has(item.id)}
                                onChange={() => toggleSelection(item.id)}
                            />
                            </td>
                            <td className="p-4">
                            <div className="w-12 h-12 bg-black rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
                                {item.image ? (
                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                <ImageIcon size={16} className="text-slate-700" />
                                )}
                            </div>
                            </td>
                            <td className="p-4">
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{item.description || 'Geen beschrijving'}</p>
                            </td>
                            <td className="p-4">
                            <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-bold text-slate-400">
                                {item.category}
                            </span>
                            </td>
                            <td className="p-4 text-right font-mono text-slate-300">
                            €{item.price.toFixed(2)}
                            </td>
                            <td className="p-4 text-center">
                            <button onClick={() => toggleStatus(item.id)}>
                                {item.active ? (
                                <Badge status="CONFIRMED" className="bg-emerald-900/20 text-emerald-500 border-emerald-900/50 cursor-pointer">Actief</Badge>
                                ) : (
                                <Badge status="ARCHIVED" className="bg-slate-800 text-slate-500 border-slate-700 cursor-pointer">Inactief</Badge>
                                )}
                            </button>
                            </td>
                            <td className="p-4 text-right">
                            <Button variant="ghost" onClick={() => openEditor(item)} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                                <Edit3 size={16} />
                            </Button>
                            </td>
                        </tr>
                        ))
                    )}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}

      {/* Editor Drawer */}
      {isDrawerOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full md:w-[600px] bg-slate-950 border-l border-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            <div className="p-6 border-b border-slate-900 flex justify-between items-center bg-slate-900/50">
              <div>
                <h3 className="text-xl font-serif text-white">{editingItem.id.includes('MERCH-') && !items.find(i => i.id === editingItem.id) ? 'Nieuw Product' : 'Bewerk Product'}</h3>
                <p className="text-slate-500 text-sm">Product details en weergave.</p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-500 hover:text-white"><X size={24}/></button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 space-y-8">
              
              {/* Customer Preview */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-500 uppercase tracking-widest">
                  <Eye size={14} /> <span>Live Preview</span>
                </div>
                <div className="max-w-xs mx-auto">
                  <MerchandiseItemCard 
                    item={editingItem} 
                    quantity={0} 
                    onUpdate={() => {}} // No-op for preview
                    onSet={() => {}} // No-op for preview
                    totalGuests={2} // Dummy value for preview
                  />
                </div>
              </div>

              {/* Form */}
              <div className="space-y-6 pt-6 border-t border-slate-900">
                {formError && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center text-red-400 text-sm font-bold">
                    <AlertCircle size={16} className="mr-2" /> {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Input 
                      label="Product Naam *" 
                      value={editingItem.name} 
                      onChange={(e: any) => setEditingItem({...editingItem, name: e.target.value})} 
                    />
                  </div>
                  
                  <Input 
                    label="Prijs (€) *" 
                    type="number" 
                    min="0.01"
                    step="0.01"
                    value={editingItem.price} 
                    onChange={(e: any) => setEditingItem({...editingItem, price: parseFloat(e.target.value)})} 
                  />

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Categorie *</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 outline-none focus:border-amber-500"
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Input 
                      label="Afbeelding URL" 
                      placeholder="https://..."
                      value={editingItem.image || ''} 
                      onChange={(e: any) => setEditingItem({...editingItem, image: e.target.value})} 
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1.5 block">Beschrijving</label>
                    <textarea 
                      className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white focus:border-amber-500 outline-none"
                      value={editingItem.description || ''}
                      onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                  <div>
                    <p className="text-white font-bold text-sm">Status</p>
                    <p className="text-xs text-slate-500">{editingItem.active ? 'Zichtbaar voor klanten' : 'Verborgen in wizard'}</p>
                  </div>
                  <div 
                     onClick={() => setEditingItem({...editingItem, active: !editingItem.active})}
                     className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${editingItem.active ? 'bg-emerald-500' : 'bg-slate-800'}`}
                  >
                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingItem.active ? 'left-7' : 'left-1'}`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-900 bg-slate-900/50 flex justify-end space-x-3">
              <Button variant="ghost" onClick={() => setIsDrawerOpen(false)}>Annuleren</Button>
              <Button onClick={handleSave} className="flex items-center"><Save size={18} className="mr-2"/> Opslaan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
