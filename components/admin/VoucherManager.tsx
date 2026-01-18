
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Wallet, Plus, Download, Filter, CheckCircle2, AlertCircle, Copy, FileText, 
  Layers, Truck, MapPin, Phone, RefreshCw, Printer, Settings, Gift, Ticket, 
  DollarSign, Lock, Edit3, Trash2, Save, X, Ban, ExternalLink
} from 'lucide-react';
import { Button, Input, Card, Badge, ResponsiveDrawer } from '../UI';
import { Voucher, VoucherOrder, VoucherSaleConfig, VoucherProductDef, ShowDefinition, Invoice } from '../../types';
import { voucherRepo, voucherOrderRepo, saveData, STORAGE_KEYS, settingsRepo, getShowDefinitions, invoiceRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { ResponsiveTable } from '../ResponsiveTable';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { EmailHistory } from './EmailHistory';
import { toCSV, downloadCSV } from '../../utils/csvExport';
import { VOUCHER_SHIPPING_FEE } from '../../utils/pricing';
import { printVoucher } from '../../utils/voucherGenerator';
import { printInvoice } from '../../utils/invoiceGenerator';

// --- SECURE CODE GENERATOR ---

const VOUCHER_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 

const generateSecureVoucherCode = (prefix: string, existingCodes: Set<string>): string => {
  let code = '';
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 1000) {
    const randomValues = new Uint8Array(8);
    window.crypto.getRandomValues(randomValues);
    
    let payload = '';
    let weightSum = 0;

    for (let i = 0; i < 8; i++) {
      const index = randomValues[i] % VOUCHER_CHARSET.length;
      const char = VOUCHER_CHARSET[index];
      payload += char;
      weightSum += index * (i + 1);
    }

    const checkDigitIndex = weightSum % VOUCHER_CHARSET.length;
    const checkDigit = VOUCHER_CHARSET[checkDigitIndex];

    code = `${prefix}-${payload.slice(0, 4)}-${payload.slice(4)}-${checkDigit}`;

    if (!existingCodes.has(code)) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) throw new Error("Kon geen unieke vouchercode genereren. Probeer het opnieuw.");
  return code;
};

export const VoucherManager = () => {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'VOUCHERS' | 'CONFIG'>('ORDERS');
  const [orders, setOrders] = useState<VoucherOrder[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<VoucherOrder | null>(null);
  const [searchParams] = useSearchParams();
  
  // Bulk Generator State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({ count: 10, amount: 50, label: '', prefix: 'BULK' });

  // Config State (Moved from Settings)
  const [voucherConfig, setVoucherConfig] = useState<VoucherSaleConfig | null>(null);
  const [shows, setShows] = useState<ShowDefinition[]>([]);
  const [editingProduct, setEditingProduct] = useState<Partial<VoucherProductDef> | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    refreshData();
    window.addEventListener('storage-update', refreshData);
    return () => window.removeEventListener('storage-update', refreshData);
  }, []);

  const refreshData = () => {
    const allOrders = voucherOrderRepo.getAll().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setOrders(allOrders);
    setVouchers(voucherRepo.getAll());
    setInvoices(invoiceRepo.getAll());
    setVoucherConfig(settingsRepo.getVoucherSaleConfig());
    setShows(getShowDefinitions());

    const openId = searchParams.get('open');
    if (openId && !selectedOrder) {
        const target = allOrders.find(o => o.id === openId);
        if (target) {
            setSelectedOrder(target);
            setActiveTab('ORDERS');
        }
    }
  };

  // --- ORDER LOGIC ---

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
    
    // Only send invoice email if it wasn't already sent (e.g. from shop)
    if (status === 'INVOICED' && original.status === 'REQUESTED') {
        triggerEmail('VOUCHER_ORDER_INVOICED', { type: 'VOUCHER_ORDER', id: orderId, data: original });
    }
    refreshData();
  };

  const handleCancelOrder = () => {
    if (!selectedOrder) return;
    if (!confirm("Weet je zeker dat je deze bestelling wilt annuleren? Als er al vouchers zijn gegenereerd, worden deze gedeactiveerd.")) return;

    // 1. Deactivate Vouchers
    if (selectedOrder.generatedCodes && selectedOrder.generatedCodes.length > 0) {
        const allVouchers = voucherRepo.getAll();
        const updatedVouchers = allVouchers.map(v => 
            selectedOrder.generatedCodes?.includes(v.code) ? { ...v, isActive: false } : v
        );
        voucherRepo.saveAll(updatedVouchers);
    }

    // 2. Update Order Status
    handleUpdateOrderStatus(selectedOrder.id, 'ARCHIVED');
    
    undoManager.showSuccess("Bestelling geannuleerd en vouchers gedeactiveerd.");
  };

  const handleDeleteOrder = () => {
    if (!selectedOrder) return;
    if (!confirm("LET OP: Dit verwijdert de bestelling en historie permanent. Gebruik 'Annuleren' als je de historie wilt bewaren.")) return;

    // 1. Delete Order
    voucherOrderRepo.delete(selectedOrder.id);
    
    // 2. Delete Vouchers (Clean up)
    if (selectedOrder.generatedCodes && selectedOrder.generatedCodes.length > 0) {
        selectedOrder.generatedCodes.forEach(code => voucherRepo.delete(code));
    }

    undoManager.showSuccess("Bestelling verwijderd.");
    setSelectedOrder(null);
    refreshData();
  };

  const handleMarkPaidAndGenerate = (order: VoucherOrder) => {
    try {
        // Only process if not already processed
        if (order.status === 'PAID' || order.status === 'COMPLETED') return;
        
        if (!confirm("Weet je zeker dat de betaling is ontvangen? Dit genereert direct de codes en stuurt deze naar de klant.")) return;

        // 1. Generate Codes
        // Use fresh data from repo to avoid state staleness
        const currentVouchers = voucherRepo.getAll();
        const existingCodes = new Set<string>(currentVouchers.map(v => v.code));
        
        const newVouchers: Voucher[] = [];
        const generatedCodes: string[] = [];
        
        order.items.forEach(item => {
            for (let i = 0; i < item.quantity; i++) {
                const code = generateSecureVoucherCode('GS', existingCodes);
                existingCodes.add(code); 

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
            }
        });

        // 2. Save Vouchers
        voucherRepo.saveAll([...currentVouchers, ...newVouchers]);

        // 3. Update Order
        const updatedOrder = { 
            ...order, 
            status: 'PAID' as const, 
            generatedCodes 
        };
        
        voucherOrderRepo.update(order.id, () => updatedOrder);

        // 4. Update Invoice (Mark as Paid)
        const allInvoices = invoiceRepo.getAll();
        const linkedInvoice = allInvoices.find(i => i.customerId === order.id);
        if (linkedInvoice) {
            invoiceRepo.update(linkedInvoice.id, i => ({ 
                ...i, 
                status: 'PAID', 
                dates: { ...i.dates, paid: new Date().toISOString() } 
            }));
        }

        // 5. Audit & Feedback
        logAuditAction('GENERATE_VOUCHERS', 'SYSTEM', order.id, {
            description: `Generated ${newVouchers.length} vouchers for order ${order.id}.`
        });
        
        undoManager.showSuccess("Betaling verwerkt en vouchers aangemaakt.");

        // 6. Emails
        if (order.deliveryMethod === 'DIGITAL') {
            newVouchers.forEach(v => {
                triggerEmail('VOUCHER_DELIVERY_DIGITAL', { 
                    type: 'VOUCHER_ORDER', 
                    id: order.id, 
                    data: updatedOrder 
                }, {
                    voucherCode: v.code,
                    voucherValue: v.originalBalance.toFixed(2)
                });
            });
        } else {
            triggerEmail('VOUCHER_ORDER_PAID_VOUCHER_CREATED', { type: 'VOUCHER_ORDER', id: order.id, data: updatedOrder });
        }

        // 7. Update UI State Immediately
        refreshData();
        setSelectedOrder(updatedOrder);

    } catch (e) {
        console.error(e);
        alert("Er is een fout opgetreden: " + (e as Error).message);
    }
  };

  const handleBulkGenerate = () => {
    if (bulkConfig.count < 1 || bulkConfig.amount <= 0) return;

    const newVouchers: Voucher[] = [];
    const exportRows: any[] = [];
    const currentVouchers = voucherRepo.getAll();
    const existingCodes = new Set<string>(currentVouchers.map(v => v.code));
    const prefix = bulkConfig.prefix.trim().toUpperCase() || 'BULK';

    for(let i=0; i<bulkConfig.count; i++) {
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

    voucherRepo.saveAll([...currentVouchers, ...newVouchers]);
    refreshData();
    setIsBulkModalOpen(false);
    
    const csv = toCSV(exportRows);
    downloadCSV(`bulk_vouchers_${new Date().toISOString().slice(0,10)}.csv`, csv);
    
    undoManager.showSuccess(`${bulkConfig.count} vouchers gegenereerd en gedownload.`);
    logAuditAction('BULK_GENERATE_VOUCHERS', 'SYSTEM', 'MULTIPLE', { description: `Generated ${bulkConfig.count} vouchers via Bulk Tool` });
  };

  const getLinkedInvoice = (orderId: string) => {
      return invoices.find(i => i.customerId === orderId);
  };

  // --- CONFIG ACTIONS ---

  const handleSaveConfig = async () => {
    if (!voucherConfig) return;
    setIsSavingConfig(true);
    await new Promise(r => setTimeout(r, 500));
    settingsRepo.updateVoucherSaleConfig(voucherConfig);
    logAuditAction('UPDATE_SETTINGS', 'SYSTEM', 'VOUCHER_CONFIG', { description: 'Updated voucher configuration' });
    undoManager.showSuccess("Instellingen opgeslagen.");
    setIsSavingConfig(false);
  };

  const addVoucherProduct = () => {
    setEditingProduct({
        id: `PROD-${Date.now()}`,
        label: '',
        description: '',
        price: 0,
        active: true
    });
  };

  const deleteVoucherProduct = (id: string) => {
    if (!voucherConfig) return;
    if (confirm("Product verwijderen?")) {
        setVoucherConfig({
            ...voucherConfig,
            products: voucherConfig.products.filter(p => p.id !== id)
        });
    }
  };

  const prefillFromProfile = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (!val || !editingProduct) return;
      const [showId, profileId] = val.split(':');
      const show = shows.find(s => s.id === showId);
      const profile = show?.profiles.find(p => p.id === profileId);
      
      if (show && profile) {
          setEditingProduct({
              ...editingProduct,
              label: `${show.name} - ${profile.name}`,
              description: 'Inclusief diner en show',
              price: profile.pricing.standard
          });
      }
  };

  const saveVoucherProduct = () => {
      if (!voucherConfig || !editingProduct) return;
      // Basic validation
      if (!editingProduct.label || !editingProduct.price) {
          alert("Label en prijs zijn verplicht.");
          return;
      }

      const newProduct = editingProduct as VoucherProductDef;
      const newProducts = [...voucherConfig.products];
      const idx = newProducts.findIndex(p => p.id === newProduct.id);
      
      if (idx >= 0) newProducts[idx] = newProduct;
      else newProducts.push(newProduct);

      setVoucherConfig({ ...voucherConfig, products: newProducts });
      setEditingProduct(null);
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Voucher Beheer</h2>
          <p className="text-slate-500 text-sm">Bestellingen, actieve codes en verkoopinstellingen.</p>
        </div>
        {activeTab === 'VOUCHERS' && (
            <Button onClick={() => setIsBulkModalOpen(true)} className="flex items-center bg-slate-800 hover:bg-slate-700 text-white border-slate-700">
                <Layers size={18} className="mr-2" /> Bulk Genereren
            </Button>
        )}
        {activeTab === 'CONFIG' && (
            <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="flex items-center min-w-[140px]">
                {isSavingConfig ? <RefreshCw className="animate-spin mr-2" size={18}/> : <Save size={18} className="mr-2" />}
                Opslaan
            </Button>
        )}
      </div>

      <div className="flex space-x-1 border-b border-slate-800">
        <button onClick={() => setActiveTab('ORDERS')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'ORDERS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Bestellingen</button>
        <button onClick={() => setActiveTab('VOUCHERS')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'VOUCHERS' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Alle Vouchers</button>
        <button onClick={() => setActiveTab('CONFIG')} className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'CONFIG' ? 'border-amber-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Instellingen</button>
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
              { 
                header: 'Status', 
                accessor: (o: VoucherOrder) => {
                    let statusColor = 'slate';
                    if (o.status === 'PAID') statusColor = 'emerald';
                    if (o.status === 'INVOICED') statusColor = 'orange';
                    if (o.status === 'REQUESTED') statusColor = 'blue';
                    if (o.status === 'ARCHIVED') statusColor = 'red';
                    
                    return (
                        <Badge status="CUSTOM" className={`bg-${statusColor}-900/20 text-${statusColor}-500 border-${statusColor}-900/50`}>
                            {o.status === 'INVOICED' ? 'OPENSTAAND' : o.status}
                        </Badge>
                    );
                } 
              }
            ]}
          />
          <ResponsiveDrawer isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Bestelling ${selectedOrder?.id}`}>
            {selectedOrder && (
              <div className="space-y-6">
                
                {/* Header Actions */}
                <div className="flex justify-end space-x-2 pb-2 border-b border-slate-800">
                    <Button variant="ghost" onClick={handleDeleteOrder} className="text-red-500 hover:bg-red-900/20">
                        <Trash2 size={16} />
                    </Button>
                </div>

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

                <div className="grid grid-cols-2 gap-2">
                   {selectedOrder.status !== 'PAID' && selectedOrder.status !== 'ARCHIVED' && (
                       <Button onClick={() => handleMarkPaidAndGenerate(selectedOrder)} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg col-span-2">
                           <RefreshCw size={16} className="mr-2"/> Betaling Ontvangen & Genereren
                       </Button>
                   )}
                   
                   {/* Cancel Button */}
                   {selectedOrder.status !== 'ARCHIVED' && (
                       <Button onClick={handleCancelOrder} variant="secondary" className="w-full border-red-900/50 text-red-400 hover:bg-red-900/20">
                           <Ban size={16} className="mr-2"/> Annuleren
                       </Button>
                   )}

                   {/* Invoice Button */}
                   {getLinkedInvoice(selectedOrder.id) && (
                       <Button 
                         onClick={() => {
                             const inv = getLinkedInvoice(selectedOrder.id);
                             if (inv) printInvoice(inv);
                         }} 
                         variant="secondary" 
                         className="w-full"
                       >
                           <Printer size={16} className="mr-2"/> Print Factuur
                       </Button>
                   )}
                </div>
                
                {selectedOrder.generatedCodes && selectedOrder.generatedCodes.length > 0 && (
                    <div className="bg-emerald-900/10 border border-emerald-900/50 p-4 rounded-xl">
                        <h4 className="text-xs font-bold text-emerald-500 uppercase mb-2">Gegenereerde Codes</h4>
                        <div className="space-y-1">
                            {selectedOrder.generatedCodes.map(code => {
                                const voucher = vouchers.find(v => v.code === code);
                                return (
                                    <div key={code} className="flex justify-between items-center p-2 bg-black/30 rounded">
                                        <div className="flex items-center">
                                            <span className={`font-mono text-sm ${voucher?.isActive ? 'text-white' : 'text-red-400 line-through'}`}>{code}</span>
                                            {!voucher?.isActive && <span className="text-[9px] ml-2 text-red-500 font-bold">INACTIEF</span>}
                                        </div>
                                        <button 
                                        onClick={() => {
                                            if (voucher) printVoucher(voucher);
                                        }} 
                                        className="text-slate-400 hover:text-white"
                                        title="Print Voucher PDF"
                                        >
                                            <Printer size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

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
            { header: 'Status', accessor: (v: Voucher) => <Badge status={v.isActive ? 'CONFIRMED' : 'CANCELLED'}>{v.isActive ? 'Actief' : 'Gebruikt'}</Badge> },
            { 
                header: 'Actie', 
                accessor: (v: Voucher) => (
                    <button onClick={() => printVoucher(v)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded">
                        <Printer size={16} />
                    </button>
                )
            }
          ]}
        />
      )}
      
      {activeTab === 'CONFIG' && voucherConfig && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* Main Toggle */}
          <Card className="p-6 bg-slate-900 border-slate-800 flex items-center justify-between">
             <div className="flex items-center space-x-4">
               <div className={`p-3 rounded-full ${voucherConfig.isEnabled ? 'bg-emerald-900/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                 <Gift size={24} />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">Theaterbonnen Verkoop</h3>
                 <p className="text-slate-500 text-xs">Schakel de publieke verkoop pagina voor cadeaukaarten in of uit.</p>
               </div>
             </div>
             <button 
                onClick={() => setVoucherConfig({...voucherConfig, isEnabled: !voucherConfig.isEnabled})}
                className={`w-14 h-8 rounded-full relative transition-colors ${voucherConfig.isEnabled ? 'bg-emerald-500' : 'bg-slate-800 border border-slate-700'}`}
             >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${voucherConfig.isEnabled ? 'left-7' : 'left-1'}`} />
             </button>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Col: Products */}
            <div className="space-y-8">
              <Card className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                    <Ticket size={14} className="mr-2"/> Arrangement Producten
                  </h3>
                  <Button variant="secondary" onClick={addVoucherProduct} className="text-xs h-8 px-3">
                    <Plus size={14} className="mr-1"/> Toevoegen
                  </Button>
                </div>

                <div className="space-y-3">
                  {voucherConfig.products.map(product => (
                    <div key={product.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex justify-between items-center group">
                       <div>
                         <p className="text-white font-bold text-sm">{product.label}</p>
                         <p className="text-slate-500 text-xs truncate max-w-[200px]">{product.description}</p>
                         <p className="text-amber-500 font-mono text-xs mt-1">€{product.price.toFixed(2)}</p>
                       </div>
                       <div className="flex space-x-2 opacity-50 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingProduct(product)} className="p-2 bg-slate-900 rounded hover:text-white text-slate-400"><Edit3 size={14}/></button>
                         <button onClick={() => deleteVoucherProduct(product.id)} className="p-2 bg-slate-900 rounded hover:text-red-500 text-slate-400"><Trash2 size={14}/></button>
                       </div>
                    </div>
                  ))}
                  {voucherConfig.products.length === 0 && (
                    <p className="text-slate-500 text-xs italic text-center py-4">Nog geen producten geconfigureerd.</p>
                  )}
                </div>
              </Card>

              <Card className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                    <DollarSign size={14} className="mr-2"/> Vrij Bedrag
                  </h3>
                  <button 
                    onClick={() => setVoucherConfig({
                      ...voucherConfig, 
                      freeAmount: { ...voucherConfig.freeAmount, enabled: !voucherConfig.freeAmount.enabled }
                    })}
                    className={`w-10 h-6 rounded-full relative transition-colors ${voucherConfig.freeAmount.enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voucherConfig.freeAmount.enabled ? 'left-5' : 'left-1'}`} />
                  </button>
                </div>
                
                <div className={`grid grid-cols-3 gap-4 ${!voucherConfig.freeAmount.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                   <Input 
                     label="Min (€)" type="number" 
                     value={voucherConfig.freeAmount.min}
                     onChange={(e: any) => setVoucherConfig({...voucherConfig, freeAmount: {...voucherConfig.freeAmount, min: parseInt(e.target.value)}})}
                   />
                   <Input 
                     label="Max (€)" type="number" 
                     value={voucherConfig.freeAmount.max}
                     onChange={(e: any) => setVoucherConfig({...voucherConfig, freeAmount: {...voucherConfig.freeAmount, max: parseInt(e.target.value)}})}
                   />
                   <Input 
                     label="Stap (€)" type="number" 
                     value={voucherConfig.freeAmount.step}
                     onChange={(e: any) => setVoucherConfig({...voucherConfig, freeAmount: {...voucherConfig.freeAmount, step: parseInt(e.target.value)}})}
                   />
                </div>
              </Card>
            </div>

            {/* Right Col: Rules & Delivery */}
            <div className="space-y-8">
              <Card className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                  <Layers size={14} className="mr-2"/> Bundeling
                </h3>
                
                <div className="flex items-start justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
                   <div className="pr-4">
                     <p className="text-white font-bold text-sm mb-1">Gecombineerde Uitgifte Toestaan</p>
                     <p className="text-slate-500 text-xs leading-relaxed">
                       Indien ingeschakeld kan de klant kiezen om alle items in de winkelwagen samen te voegen tot één voucher met de totaalwaarde.
                     </p>
                   </div>
                   <button 
                      onClick={() => setVoucherConfig({
                        ...voucherConfig, 
                        bundling: { ...voucherConfig.bundling, allowCombinedIssuance: !voucherConfig.bundling.allowCombinedIssuance }
                      })}
                      className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${voucherConfig.bundling.allowCombinedIssuance ? 'bg-emerald-500' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voucherConfig.bundling.allowCombinedIssuance ? 'left-5' : 'left-1'}`} />
                    </button>
                </div>
              </Card>

              <Card className="p-8 space-y-6">
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center">
                  <Truck size={14} className="mr-2"/> Verzending & Kosten
                </h3>

                {/* Pickup (ReadOnly/Info) */}
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                   <span className="text-sm text-slate-300">Fysiek Ophalen</span>
                   <span className="text-xs font-bold text-emerald-500 uppercase">Gratis</span>
                </div>

                {/* Digital (ReadOnly/Info) */}
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                   <div className="flex items-center">
                     <span className="text-sm text-slate-300 mr-2">Digitaal (E-mail)</span>
                     <Lock size={12} className="text-slate-600" title="Fixed system fee"/>
                   </div>
                   <span className="text-xs font-bold text-slate-300 uppercase">€{voucherConfig.delivery.digitalFee.toFixed(2)}</span>
                </div>

                {/* Shipping */}
                <div className="flex items-center justify-between pt-2">
                   <div className="flex items-center space-x-3">
                     <button 
                        onClick={() => setVoucherConfig({
                          ...voucherConfig, 
                          delivery: { ...voucherConfig.delivery, shipping: { ...voucherConfig.delivery.shipping, enabled: !voucherConfig.delivery.shipping.enabled } }
                        })}
                        className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${voucherConfig.delivery.shipping.enabled ? 'bg-emerald-500' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${voucherConfig.delivery.shipping.enabled ? 'left-5' : 'left-1'}`} />
                      </button>
                      <span className="text-sm text-slate-300">Postverzending</span>
                   </div>
                   
                   <div className={`flex items-center space-x-2 ${!voucherConfig.delivery.shipping.enabled ? 'opacity-30 pointer-events-none' : ''}`}>
                     <span className="text-xs text-slate-500">Tarief €</span>
                     <Input 
                       type="number" 
                       className="w-20 text-right h-8 py-1"
                       value={voucherConfig.delivery.shipping.fee}
                       onChange={(e: any) => setVoucherConfig({
                         ...voucherConfig, 
                         delivery: { ...voucherConfig.delivery, shipping: { ...voucherConfig.delivery.shipping, fee: parseFloat(e.target.value) } }
                       })}
                     />
                   </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Product Editor Drawer (Nested) */}
          {editingProduct && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Voucher Product</h3>
                    <button onClick={() => setEditingProduct(null)}><X size={20} className="text-slate-500 hover:text-white"/></button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    {/* Source Selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bron (Optioneel)</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-amber-500 outline-none"
                        onChange={prefillFromProfile}
                        defaultValue=""
                      >
                        <option value="" disabled>Kopieer van Show Profiel...</option>
                        {shows.map(show => (
                          <optgroup key={show.id} label={show.name}>
                            {show.profiles.map(p => (
                              <option key={p.id} value={`${show.id}:${p.id}`}>{p.name} (€{p.pricing.standard})</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <Input 
                      label="Label" 
                      value={editingProduct.label} 
                      onChange={(e: any) => setEditingProduct({...editingProduct, label: e.target.value})}
                      placeholder="Bijv. Premium Arrangement"
                    />
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Omschrijving</label>
                      <textarea 
                        className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-amber-500 outline-none"
                        value={editingProduct.description}
                        onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                      />
                    </div>

                    <Input 
                      label="Prijs (€)" 
                      type="number"
                      value={editingProduct.price} 
                      onChange={(e: any) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                    />
                  </div>

                  <div className="p-4 border-t border-slate-800 flex justify-end space-x-2">
                    <Button variant="ghost" onClick={() => setEditingProduct(null)}>Annuleren</Button>
                    <Button onClick={saveVoucherProduct}>Opslaan</Button>
                  </div>
               </div>
            </div>
          )}

        </div>
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
