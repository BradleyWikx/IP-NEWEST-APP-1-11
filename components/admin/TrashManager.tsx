
import React, { useState, useEffect } from 'react';
import { 
  Trash2, RotateCcw, AlertTriangle, XCircle, Search 
} from 'lucide-react';
import { Button, Card, Badge } from '../UI';
import { bookingRepo } from '../../utils/storage';
import { Reservation } from '../../types';
import { ResponsiveTable } from '../ResponsiveTable';
import { undoManager } from '../../utils/undoManager';

export const TrashManager = () => {
  const [deletedItems, setDeletedItems] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setDeletedItems(bookingRepo.getTrash());
  };

  const handleRestore = (id: string) => {
    bookingRepo.restore(id);
    undoManager.showSuccess("Item hersteld uit prullenbak.");
    refreshData();
  };

  const handleHardDelete = (id: string) => {
    if (confirm("Dit item wordt permanent verwijderd en kan NIET meer worden hersteld. Doorgaan?")) {
      bookingRepo.hardDelete(id);
      refreshData();
    }
  };

  const calculateDaysRemaining = (deletedAt?: string) => {
    if (!deletedAt) return 0;
    const deletedDate = new Date(deletedAt);
    const cleanupDate = new Date(deletedDate);
    cleanupDate.setDate(deletedDate.getDate() + 30);
    
    const diffTime = cleanupDate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const filteredItems = deletedItems.filter(item => 
    item.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Prullenbak</h2>
          <p className="text-slate-500 text-sm">Verwijderde items. Worden automatisch gewist na 30 dagen.</p>
        </div>
        <div className="flex items-center space-x-2 bg-red-900/20 border border-red-900/50 px-3 py-1.5 rounded-lg text-red-400 text-xs">
           <AlertTriangle size={14} className="mr-2" /> 
           <span>Items ouder dan 30 dagen worden verwijderd</span>
        </div>
      </div>

      <Card className="p-4 bg-slate-900/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
            placeholder="Zoek in prullenbak..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <div className="flex-grow">
        <ResponsiveTable 
          data={filteredItems}
          keyExtractor={r => r.id}
          emptyMessage="Prullenbak is leeg."
          columns={[
            { 
              header: 'Verwijderd Op', 
              accessor: (r: Reservation) => (
                <div>
                  <span className="text-xs text-white block">{r.deletedAt ? new Date(r.deletedAt).toLocaleDateString() : '-'}</span>
                  <span className="text-[10px] text-slate-500">Nog {calculateDaysRemaining(r.deletedAt)} dagen</span>
                </div>
              ) 
            },
            { 
              header: 'Item', 
              accessor: (r: Reservation) => (
                <div>
                  <span className="font-bold text-white block">{r.customer.lastName}, {r.customer.firstName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{r.id}</span>
                </div>
              ) 
            },
            { 
              header: 'Datum Show', 
              accessor: (r: Reservation) => <span className="font-mono text-slate-400 text-xs">{new Date(r.date).toLocaleDateString()}</span> 
            },
            { 
              header: 'Status', 
              accessor: (r: Reservation) => <Badge status={r.status} className="opacity-50">{r.status}</Badge> 
            },
            { 
              header: 'Acties', 
              accessor: (r: Reservation) => (
                <div className="flex justify-end space-x-2">
                  <Button variant="secondary" onClick={() => handleRestore(r.id)} className="h-8 px-2 text-xs flex items-center">
                    <RotateCcw size={14} className="mr-1" /> Herstel
                  </Button>
                  <Button variant="ghost" onClick={() => handleHardDelete(r.id)} className="h-8 px-2 text-xs text-red-500 hover:text-red-400 hover:bg-red-900/20">
                    <XCircle size={14} />
                  </Button>
                </div>
              ) 
            }
          ]}
        />
      </div>
    </div>
  );
};
