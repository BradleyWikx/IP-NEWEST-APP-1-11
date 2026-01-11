
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Plus, Filter, Trash2, Edit3, Save, X, 
  ShoppingBag, Check, Eye, Tag, DollarSign, Image as ImageIcon,
  MoreHorizontal, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button, Input, Card, Badge } from '../UI';
import { MerchandiseItem } from '../../types';
import { getMerchandise, saveData, STORAGE_KEYS } from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { MerchandiseItemCard } from '../MerchandisePicker';

const CATEGORIES = ['Souvenir', 'Home', 'Apparel', 'Art', 'Food & Bev'];

export const MerchandiseManager = () => {
  const [items, setItems] = useState<MerchandiseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Drawer / Editor State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MerchandiseItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Bulk Action State
  const [bulkCategory, setBulkCategory] = useState('');

  // Load Data
  useEffect(() => {
    const data = getMerchandise();
    setItems(data);
  }, []);

  // --- Actions ---

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

  // --- Bulk Actions ---

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

  // --- Derived State ---

  const filteredItems = useMemo(() => {
    return items.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // --- Render Editor ---

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

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Merchandise</h2>
          <p className="text-slate-500 text-sm">Beheer catalogus en prijzen.</p>
        </div>
        <Button onClick={() => openEditor()} className="flex items-center">
          <Plus size={18} className="mr-2" /> Nieuw Item
        </Button>
      </div>

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
