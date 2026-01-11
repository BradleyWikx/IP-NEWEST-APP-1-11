
import React, { useState, useMemo, useEffect } from 'react';
import { ShoppingBag, Search, Minus, Plus, Tag, Image as ImageIcon, Filter, Users } from 'lucide-react';
import { MerchandiseItem, MerchandiseSelection } from '../types';
import { loadData, STORAGE_KEYS, getMerchandise } from '../utils/storage';
import { Button, Input, Card } from './UI';

interface MerchandisePickerProps {
  selections: MerchandiseSelection[];
  onUpdate: (id: string, delta: number) => void;
  onSet: (id: string, qty: number) => void;
  totalGuests: number;
}

interface ItemCardProps {
  item: MerchandiseItem;
  quantity: number;
  onUpdate: (id: string, delta: number) => void;
  onSet: (id: string, qty: number) => void;
  totalGuests: number;
}

export const MerchandiseItemCard = React.memo(({ item, quantity, onUpdate, onSet, totalGuests }: ItemCardProps) => {
  return (
    <div className={`
      relative overflow-hidden rounded-3xl border transition-all duration-300 group
      ${quantity > 0 ? 'bg-slate-900 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-slate-900/40 border-slate-800 hover:border-slate-600'}
    `}>
      <div className="absolute top-4 left-4 z-10">
        <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
          {item.category}
        </span>
      </div>

      <div className="p-6 flex flex-col h-full">
        <div className="w-full aspect-[4/3] bg-black/50 rounded-2xl mb-4 flex items-center justify-center border border-slate-800/50 group-hover:border-slate-700 transition-colors">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-2xl opacity-80 group-hover:opacity-100 transition-opacity" />
          ) : (
            <ImageIcon size={32} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
          )}
        </div>

        <div className="flex-grow">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-serif text-lg text-white font-bold leading-tight pr-2">{item.name}</h3>
            <p className="text-amber-500 font-serif whitespace-nowrap">€{item.price.toFixed(2)}</p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-6 line-clamp-2">{item.description}</p>
        </div>

        <div className="space-y-3 mt-auto">
          {/* Controls */}
          <div className="flex items-center justify-between bg-black/30 rounded-xl p-1 border border-slate-800">
            <button 
              onClick={() => onUpdate(item.id, -1)}
              disabled={quantity === 0}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <Minus size={16} />
            </button>
            
            <input 
              type="number"
              value={quantity}
              onChange={(e) => onSet(item.id, Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 text-center bg-transparent text-lg font-bold text-white outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            <button 
              onClick={() => onUpdate(item.id, 1)}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-black hover:bg-amber-500 transition-all"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Quick Add for Group */}
          <button 
            onClick={() => onSet(item.id, totalGuests)}
            className="w-full py-2 text-[10px] uppercase font-bold text-slate-500 hover:text-amber-500 hover:bg-amber-900/20 rounded-lg border border-transparent hover:border-amber-900/50 transition-colors flex items-center justify-center"
          >
            <Users size={12} className="mr-1.5" /> Voor Iedereen ({totalGuests})
          </button>
        </div>
      </div>
    </div>
  );
});

export const MerchandiseSummaryList = ({ selections, catalog }: { selections: MerchandiseSelection[], catalog?: MerchandiseItem[] }) => {
  const items = catalog || getMerchandise();
  const activeSelections = selections.filter(s => s.quantity > 0);
  if (activeSelections.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center">
        <ShoppingBag size={12} className="mr-2" /> Geselecteerde Items
      </h4>
      {activeSelections.map(sel => {
        const item = items.find(i => i.id === sel.id);
        if (!item) return null;
        return (
          <div key={sel.id} className="flex justify-between items-center text-sm">
            <div className="flex items-center text-slate-300">
              <span className="font-bold text-white mr-2">{sel.quantity}x</span>
              <span>{item.name}</span>
            </div>
            <span className="font-mono text-slate-400">€{(item.price * sel.quantity).toFixed(2)}</span>
          </div>
        );
      })}
      <div className="pt-3 border-t border-slate-800 flex justify-between items-center font-bold text-white">
        <span>Totaal Merchandise</span>
        <span>
          €{activeSelections.reduce((sum, sel) => {
            const item = items.find(i => i.id === sel.id);
            return sum + (item ? item.price * sel.quantity : 0);
          }, 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export const MerchandisePicker = ({ selections, onUpdate, onSet, totalGuests }: MerchandisePickerProps) => {
  const [catalog, setCatalog] = useState<MerchandiseItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    const data = getMerchandise();
    setCatalog(data.filter(item => item.active));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(catalog.map(i => i.category));
    return ['ALL', ...Array.from(cats)];
  }, [catalog]);

  const filteredItems = useMemo(() => {
    return catalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                            item.description?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [catalog, search, activeCategory]);

  // Helper for onSet wrapper to match parent logic if needed
  const handleSet = (id: string, qty: number) => {
    // Logic to replace quantity directly
    if (onSet) {
        onSet(id, qty);
    } else {
        // Fallback if onSet not provided (legacy compatibility)
        const current = selections.find(s => s.id === id)?.quantity || 0;
        onUpdate(id, qty - current);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex p-3 rounded-full bg-slate-900 mb-4 border border-slate-800">
          <ShoppingBag className="text-amber-500" size={24} />
        </div>
        <h2 className="text-3xl font-serif text-white mb-3">Shop & Souvenirs</h2>
        <p className="text-slate-400 text-sm">
          Maak uw theaterervaring compleet met onze exclusieve merchandise en extra's.
        </p>
      </div>

      <div className="sticky top-20 z-20 bg-black/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Zoek producten..." 
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex w-full md:w-auto overflow-x-auto no-scrollbar space-x-2 pb-1 md:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-amber-500 border-amber-500 text-black' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                {cat === 'ALL' ? 'Alles' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
          <Filter className="mx-auto text-slate-600 mb-4" size={32} />
          <p className="text-slate-500 font-bold">Geen producten gevonden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <MerchandiseItemCard 
              key={item.id} 
              item={item} 
              quantity={selections.find(s => s.id === item.id)?.quantity || 0}
              onUpdate={onUpdate}
              onSet={(id, qty) => handleSet(id, qty)}
              totalGuests={totalGuests}
            />
          ))}
        </div>
      )}
    </div>
  );
};
