
import React, { useState, useEffect } from 'react';
import { 
  Trash2, RotateCcw, AlertTriangle, XCircle, Search, Info 
} from 'lucide-react';
import { Button, Card, Badge } from '../UI';
import { bookingRepo } from '../../utils/storage';
import { Reservation } from '../../types';
import { ResponsiveTable } from '../ResponsiveTable';
import { undoManager } from '../../utils/undoManager';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';

export const TrashManager = () => {
  const [deletedItems, setDeletedItems] = useState<Reservation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemToDelete, setItemToDelete] = useState<Reservation | null>(null);

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

  const confirmHardDelete = () => {
    if (itemToDelete) {
      bookingRepo.hardDelete(itemToDelete.id);
      refreshData();
      setItemToDelete(null);
      undoManager.showSuccess("Item definitief verwijderd.");
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
        <div className="flex items-center space-x-2 text-xs text-amber-500 bg-amber-900/10 px-3 py-2 rounded-lg border border-amber-900/30">
           <Info size={14} />
           <span>Items ouder dan 30 dagen worden automatisch verwijderd.</span>
        </div>
      </div>

      <Card className="p-4 bg-slate-900/50">
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
           <input 
             className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
             placeholder="Zoek in prullenbak..."
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
         </div>
      </Card>

      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
        <ResponsiveTable<Reservation>
          data={filteredItems}
          keyExtractor={r => r.id}
          isVirtual={true}
          virtualHeight="600px" // Or calc(100vh - ...)
          columns={[
            { header: 'Verwijderd', accessor: r => <span className="text-slate-400 font-mono text-xs">{new Date(r.deletedAt!).toLocaleDateString()}</span> },
            { header: 'Reservering', accessor: r => (
                <div>
                    <span className="block font-bold text-white">{r.customer.lastName}</span>
                    <span className="text-xs text-slate-500">{r.id}</span>
                </div>
            )},
            { header: 'Status Origineel', accessor: r => <Badge status={r.status}>{r.status}</Badge> },
            { header: 'Auto-Delete', accessor: r => {
                const days = calculateDaysRemaining(r.deletedAt);
                return <span className={`text-xs font-bold ${days < 5 ? 'text-red-500' : 'text-slate-500'}`}>Over {days} dagen</span>
            }},
            { header: 'Actie', accessor: r => (
                <div className="flex space-x-2 justify-end">
                    <Button variant="secondary" onClick={() => handleRestore(r.id)} className="h-8 text-xs">
                        <RotateCcw size={14} className="mr-1"/> Herstel
                    </Button>
                    <Button variant="ghost" onClick={() => setItemToDelete(r)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-900/20">
                        <Trash2 size={14}/>
                    </Button>
                </div>
            )}
          ]}
          emptyMessage="Prullenbak is leeg."
        />
      </div>

      <DestructiveActionModal 
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmHardDelete}
        title="Definitief Verwijderen"
        description={<p>Weet je zeker dat je <strong>{itemToDelete?.customer.lastName}</strong> permanent wilt verwijderen? Dit kan niet ongedaan worden gemaakt.</p>}
        verificationText="VERWIJDER"
        confirmButtonText="Permanent Wissen"
      />
    </div>
  );
};
