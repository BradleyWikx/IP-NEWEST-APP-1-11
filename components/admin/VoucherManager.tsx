
import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Download, Filter, CheckCircle2, AlertCircle, Copy, FileText, Layers } from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { Voucher, VoucherOrder } from '../../types';
import { voucherRepo, voucherOrderRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { ResponsiveTable } from '../ResponsiveTable';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { EmailHistory } from './EmailHistory';
import { toCSV, downloadCSV } from '../../utils/csvExport';

export const VoucherManager = () => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'VOUCHERS'>('ORDERS');
  const [orders, setOrders] = useState<VoucherOrder[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<VoucherOrder | null>(null);
  
  // Bulk Generator State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({ count: 10, amount: 50, label: '', prefix: 'BULK' });

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    setOrders(voucherOrderRepo.getAll().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setVouchers(voucherRepo.getAll());
  };

  const handleUpdateOrderStatus = (orderId: string, status: VoucherOrder['status'], extraUpdates: Partial<VoucherOrder> = {}) => {
    const original = orders.find(o => o.id === orderId);
    if (!original) return;

    voucherOrderRepo.update(orderId, (o) => ({ ...o, status, ...extraUpdates }));
    
    undoManager.registerUndo(
      `Status wijziging ${status}`,
      'VOUCHER_ORDER',
      orderId,
      original
    );

    if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status, ...extraUpdates });
    }
    
    if (status === 'INVOICED' && original.status !== 'INVOICED') {
        triggerEmail('VOUCHER_ORDER_INVOICED', { type: 'VOUCHER_ORDER', id: orderId, data: original });
    }
  };

  const handleMarkPaidAndGenerate = (order: VoucherOrder) => {
    if (order.status === 'PAID' || order.status === 'COMPLETED') return;

    const newVouchers: Voucher[] = [];
    const generatedCodes: string[] = [];
    const sideEffects: any[] = [];

    order.items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            const code = `GS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            newVouchers.push({
                code,
                originalBalance: item.price,
                currentBalance: item.price,
                isActive: true,
                createdAt: new Date().toISOString(),
                issuedTo: order.buyer.lastName,
                orderId: order.id,
                label: item.label
            });
            generatedCodes.push(code);
            sideEffects.push({ type: 'VOUCHER', id: code });
        }
    });

    voucherRepo.saveAll([...vouchers, ...newVouchers]);

    const originalOrder = JSON.parse(JSON.stringify(order));
    voucherOrderRepo.update(order.id, (o) => ({ ...o, status: 'PAID', generatedCodes }));

    undoManager.registerUndo(
      'Betaling & Generatie',
      'VOUCHER_ORDER',
      order.id,
      originalOrder,
      sideEffects
    );

    logAuditAction('GENERATE_VOUCHERS', 'SYSTEM', order.id, {
        description: `Generated ${newVouchers.length} vouchers for order ${order.id}`
    });

    refreshData();

    triggerEmail('VOUCHER_ORDER_PAID_VOUCHER_CREATED', { type: 'VOUCHER_ORDER', id: order.id, data: order });

    if (order.deliveryMethod === 'DIGITAL') {
        newVouchers.forEach(v => {
            triggerEmail('VOUCHER_DELIVERY_DIGITAL', { 
                type: 'VOUCHER_ORDER', 
                id: order.id, 
                data: order 
            }, {
                voucherCode: v.code,
                voucherValue: v.originalBalance.toFixed(2)
            });
        });
    } else if (order.deliveryMethod === 'PICKUP') {
        triggerEmail('VOUCHER_DELIVERY_PHYSICAL_PICKUP_READY', { type: 'VOUCHER_ORDER', id: order.id, data: order });
    } else if (order.deliveryMethod === 'POST') {
        triggerEmail('VOUCHER_DELIVERY_PHYSICAL_SHIPPED', { type: 'VOUCHER_ORDER', id: order.id, data: order }, {
            deliveryAddress: `${order.recipient.address?.street}, ${order.recipient.address?.city}`
        });
    }
  };

  const handleBulkGenerate = () => {
    if (bulkConfig.count < 1 || bulkConfig.amount <= 0) return;

    const newVouchers: Voucher[] = [];
    const exportRows: any[] = [];

    for(let i=0; i<bulkConfig.count; i++) {
        const code = `${bulkConfig.prefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        newVouchers.push({
            code,
            originalBalance: bulkConfig.amount,
            currentBalance: bulkConfig.amount,
            isActive: true,
            createdAt: new Date().toISOString(),
            issuedTo: 'Bulk Generated',
            label: bulkConfig.label || 'Bulk Import'
        });
        exportRows.push({
            Code: code,
            Waarde: bulkConfig.amount,
            Label: bulkConfig.label,
            Aangemaakt: new Date().toLocaleDateString()
        });
    }

    voucherRepo.saveAll([...vouchers, ...newVouchers]);
    refreshData();
    setIsBulkModalOpen(false);
    
    // Auto Export
    const csv = toCSV(exportRows);
    downloadCSV(`bulk_vouchers_${new Date().toISOString().slice(0,10)}.csv`, csv);
    
    undoManager.showSuccess(`${bulkConfig.count} vouchers gegenereerd en gedownload.`);
    logAuditAction('BULK_GENERATE_VOUCHERS', 'SYSTEM', 'MULTIPLE', { description: `Generated ${bulkConfig.count} vouchers via Bulk Tool` });
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Voucher Beheer</h2>
          <p className="text-slate-500 text-sm">Bestellingen en actieve codes.</p>
        </div>
        {activeTab === 'VOUCHERS' && (
            <Button onClick={() => setIsBulkModalOpen(true)} className="flex items-center bg-slate-800 hover:bg-slate-700 text-white border-slate-700">
                <Layers size={18} className="mr-2" /> Bulk Genereren
            </Button>
        )}
      </div>

      <div className="flex space-x-1 border-b border-slate-800">
        <button onClick={() => setActiveTab('ORDERS')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'ORDERS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Bestellingen</button>
        <button onClick={() => setActiveTab('VOUCHERS')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'VOUCHERS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Alle Vouchers</button>
      </div>

      {activeTab === 'ORDERS' && (
        <>
          <ResponsiveTable 
            data={orders}
            keyExtractor={o => o.id}
            onRowClick={(o) => setSelectedOrder(o)}
            columns={[
              { header: 'Datum', accessor: (o: VoucherOrder) => <span className="font-mono text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</span> },
              { header: 'Klant', accessor: (o: VoucherOrder) => <span className="font-bold text-white">{o.customerName || o.buyer.lastName}</span> },
              { header: 'Bedrag', accessor: (o: VoucherOrder) => <span className="text-emerald-500 font-mono">€{o.amount.toFixed(2)}</span> },
              { header: 'Methode', accessor: (o: VoucherOrder) => <span className="text-xs uppercase">{o.deliveryMethod}</span> },
              { header: 'Status', accessor: (o: VoucherOrder) => <Badge status={o.status === 'PAID' ? 'CONFIRMED' : o.status === 'REQUESTED' ? 'REQUEST' : 'ARCHIVED'}>{o.status}</Badge> }
            ]}
          />
          <ResponsiveDrawer isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Bestelling ${selectedOrder?.id}`}>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                   <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Details</h4>
                   <div className="space-y-1 text-sm text-slate-300">
                     <p>Naam: {selectedOrder.customerName}</p>
                     <p>Email: {selectedOrder.customerEmail}</p>
                     <p>Levering: {selectedOrder.deliveryMethod}</p>
                   </div>
                </div>
                <div className="flex space-x-2">
                   {selectedOrder.status === 'REQUESTED' && <Button onClick={() => handleUpdateOrderStatus(selectedOrder.id, 'INVOICED')} variant="secondary">Factuur Sturen</Button>}
                   {selectedOrder.status !== 'PAID' && <Button onClick={() => handleMarkPaidAndGenerate(selectedOrder)}>Markeer Betaald & Genereer</Button>}
                </div>
                <div className="pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Verzonden Emails</h3>
                    <EmailHistory entityId={selectedOrder.id} />
                </div>
              </div>
            )}
          </ResponsiveDrawer>
        </>
      )}

      {activeTab === 'VOUCHERS' && (
        <ResponsiveTable 
          data={vouchers}
          keyExtractor={v => v.code}
          columns={[
            { header: 'Code', accessor: (v: Voucher) => <span className="font-mono font-bold text-amber-500">{v.code}</span> },
            { header: 'Label', accessor: (v: Voucher) => <span className="text-xs text-slate-400">{v.label || '-'}</span> },
            { header: 'Saldo', accessor: (v: Voucher) => <span className="font-mono">€{v.currentBalance.toFixed(2)} / €{v.originalBalance}</span> },
            { header: 'Eigenaar', accessor: (v: Voucher) => <span>{v.issuedTo}</span> },
            { header: 'Status', accessor: (v: Voucher) => <Badge status={v.isActive ? 'CONFIRMED' : 'CANCELLED'}>{v.isActive ? 'Actief' : 'Gebruikt'}</Badge> }
          ]}
        />
      )}

      {/* Bulk Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
                <div className="p-6 border-b border-slate-800">
                    <h3 className="text-xl font-bold text-white mb-1">Bulk Vouchers Genereren</h3>
                    <p className="text-xs text-slate-500">Maak in één keer meerdere codes aan.</p>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Aantal" type="number" value={bulkConfig.count} onChange={(e: any) => setBulkConfig({...bulkConfig, count: parseInt(e.target.value)})} />
                        <Input label="Waarde (€)" type="number" value={bulkConfig.amount} onChange={(e: any) => setBulkConfig({...bulkConfig, amount: parseFloat(e.target.value)})} />
                    </div>
                    <Input label="Label (Intern)" placeholder="Bijv. Kerstpakket 2025" value={bulkConfig.label} onChange={(e: any) => setBulkConfig({...bulkConfig, label: e.target.value})} />
                    <Input label="Prefix Code" placeholder="BULK" value={bulkConfig.prefix} onChange={(e: any) => setBulkConfig({...bulkConfig, prefix: e.target.value.toUpperCase()})} />
                    
                    <div className="bg-blue-900/20 p-3 rounded-lg border border-blue-900/50 flex items-start text-xs text-blue-300">
                        <FileText size={14} className="mr-2 mt-0.5 shrink-0"/>
                        <p>Na generatie wordt direct een CSV bestand gedownload met alle codes.</p>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-800 flex justify-end space-x-3">
                    <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>Annuleren</Button>
                    <Button onClick={handleBulkGenerate} className="bg-emerald-600 hover:bg-emerald-700">Genereren & Downloaden</Button>
                </div>
            </Card>
        </div>
      )}
    </div>
  );
};
