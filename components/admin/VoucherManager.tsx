
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Plus, Download, Filter, CheckCircle2, AlertCircle, Copy, FileText, Layers, Truck, MapPin, Phone } from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { Voucher, VoucherOrder } from '../../types';
import { voucherRepo, voucherOrderRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { ResponsiveTable } from '../ResponsiveTable';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { EmailHistory } from './EmailHistory';
import { toCSV, downloadCSV } from '../../utils/csvExport';
import { VOUCHER_SHIPPING_FEE } from '../../utils/pricing';

// --- SECURE CODE GENERATOR ---

const VOUCHER_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes I, 1, O, 0 to avoid confusion

const generateSecureVoucherCode = (prefix: string, existingCodes: Set<string>): string => {
  let code = '';
  let isUnique = false;
  
  // Retry loop for collision avoidance
  while (!isUnique) {
    // 1. Generate 8 random bytes for the payload
    const randomValues = new Uint8Array(8);
    window.crypto.getRandomValues(randomValues);
    
    let payload = '';
    let weightSum = 0;

    // 2. Map random bytes to Charset & Calculate Checksum
    for (let i = 0; i < 8; i++) {
      const index = randomValues[i] % VOUCHER_CHARSET.length;
      const char = VOUCHER_CHARSET[index];
      payload += char;
      
      // Weighted Sum for Check Digit (Weight = Position + 1)
      weightSum += index * (i + 1);
    }

    // 3. Calculate Check Digit (Modulo 32)
    const checkDigitIndex = weightSum % VOUCHER_CHARSET.length;
    const checkDigit = VOUCHER_CHARSET[checkDigitIndex];

    // 4. Format: PREFIX-XXXX-XXXX-C
    code = `${prefix}-${payload.slice(0, 4)}-${payload.slice(4)}-${checkDigit}`;

    // 5. Uniqueness Check
    if (!existingCodes.has(code)) {
      isUnique = true;
    }
  }
  return code;
};

export const VoucherManager = () => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'VOUCHERS'>('ORDERS');
  const [orders, setOrders] = useState<VoucherOrder[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<VoucherOrder | null>(null);
  const [searchParams] = useSearchParams();
  
  // Bulk Generator State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({ count: 10, amount: 50, label: '', prefix: 'BULK' });

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    const allOrders = voucherOrderRepo.getAll().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setOrders(allOrders);
    setVouchers(voucherRepo.getAll());

    // Deep Linking Logic
    const openId = searchParams.get('open');
    if (openId) {
        const target = allOrders.find(o => o.id === openId);
        if (target) {
            setSelectedOrder(target);
            setActiveTab('ORDERS');
        }
    }
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
    
    // Create Set of existing codes for fast collision lookup
    const existingCodes = new Set<string>(vouchers.map(v => v.code));

    order.items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
            // SECURE GENERATION
            const code = generateSecureVoucherCode('GS', existingCodes);
            existingCodes.add(code); // Add to local set to prevent collisions within this batch

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
    const existingCodes = new Set<string>(vouchers.map(v => v.code));
    const prefix = bulkConfig.prefix.trim().toUpperCase() || 'BULK';

    for(let i=0; i<bulkConfig.count; i++) {
        // SECURE GENERATION
        const code = generateSecureVoucherCode(prefix, existingCodes);
        existingCodes.add(code);

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
              { header: 'Totaal', accessor: (o: VoucherOrder) => <span className="text-emerald-500 font-mono">€{o.totals.grandTotal.toFixed(2)}</span> },
              { header: 'Levering', accessor: (o: VoucherOrder) => (
                  <div className="flex items-center">
                      <span className="text-xs uppercase mr-2">{o.deliveryMethod}</span>
                      {o.deliveryMethod === 'POST' && <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 rounded">+€{VOUCHER_SHIPPING_FEE.toFixed(0)}</span>}
                  </div>
              )},
              { header: 'Status', accessor: (o: VoucherOrder) => <Badge status={o.status === 'PAID' ? 'CONFIRMED' : o.status === 'REQUESTED' ? 'REQUEST' : 'ARCHIVED'}>{o.status}</Badge> }
            ]}
          />
          <ResponsiveDrawer isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Bestelling ${selectedOrder?.id}`}>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                   <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center"><FileText size={14} className="mr-2"/> Bestelgegevens</h4>
                   <div className="space-y-2 text-sm text-slate-300">
                     <p><strong>Naam:</strong> {selectedOrder.buyer.firstName} {selectedOrder.buyer.lastName}</p>
                     <p><strong>Email:</strong> {selectedOrder.customerEmail}</p>
                     <div className="flex items-start mt-2 pt-2 border-t border-slate-800">
                        <Truck size={16} className="mr-2 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold block text-white">{selectedOrder.deliveryMethod}</span>
                            {selectedOrder.recipient.address && (
                                <div className="text-xs text-slate-400 mt-1">
                                    {selectedOrder.recipient.address.street}<br/>
                                    {selectedOrder.recipient.address.zip} {selectedOrder.recipient.address.city}
                                </div>
                            )}
                        </div>
                     </div>
                   </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Items</h4>
                    {selectedOrder.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm text-slate-300 mb-1">
                            <span>{item.quantity}x {item.label}</span>
                            <span>€{item.price.toFixed(2)}</span>
                        </div>
                    ))}
                    {selectedOrder.totals.shipping > 0 && (
                        <div className="flex justify-between text-sm text-slate-400 border-t border-slate-800 pt-2 mt-2">
                            <span>Verzendkosten</span>
                            <span>€{selectedOrder.totals.shipping.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-lg font-bold text-white border-t border-slate-800 pt-2 mt-2">
                        <span>Totaal</span>
                        <span>€{selectedOrder.totals.grandTotal.toFixed(2)}</span>
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
