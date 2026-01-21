
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Calendar, Filter, MoreHorizontal,
  CheckCircle2, AlertCircle, Clock, XCircle, 
  User, Users, CreditCard, Star, ShoppingBag, 
  ArrowRight, Mail, Phone, Trash2, SlidersHorizontal,
  ChevronDown, MessageSquare, Utensils, Tag, PartyPopper, Briefcase, Loader2,
  Link as LinkIcon, Unlink, Plus, Edit2, Check, X, MapPin, Building2,
  Ban, FileText, Printer, ArrowUp, ArrowDown, Crown
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, CalendarEvent, WaitlistEntry, PaymentRecord, Invoice, Customer } from '../../types';
import { bookingRepo, calendarRepo, waitlistRepo, invoiceRepo, customerRepo } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';
import { logAuditAction } from '../../utils/auditLogger';
import { triggerEmail } from '../../utils/emailEngine';
import { ResponsiveTable } from '../ResponsiveTable';
import { getPaymentStatus } from '../../utils/paymentHelpers';
import { PriceOverridePanel } from './PriceOverridePanel';
import { recalculateReservationFinancials } from '../../utils/pricing';
import { AuditTimeline } from './AuditTimeline';
import { EditReservationModal } from './EditReservationModal';
import { DestructiveActionModal } from '../UI/DestructiveActionModal';
import { formatGuestName, formatCurrency } from '../../utils/formatters';
import { useReservations } from '../../hooks/useReservations';
import { WaitlistModal } from '../WaitlistModal';
import { CalendarBulkWizard } from './CalendarBulkWizard';
import { BulkReservationEditor } from './BulkReservationEditor';
import { createInvoiceFromReservation } from '../../utils/invoiceLogic';
import { printInvoice } from '../../utils/invoiceGenerator';

// --- TYPES ---

type FilterMode = 'ALL' | 'TODAY' | 'ACTION' | 'REQUESTS' | 'OPTIONS' | 'ARRIVALS' | 'CANCELLED';
type SortField = 'CREATED' | 'DATE' | 'NAME';
type SortDirection = 'asc' | 'desc';

const CANCELLATION_REASONS = [
  'Klantverzoek',
  'No Show',
  'Ziekte',
  'Dubbele Boeking',
  'Betaling niet ontvangen',
  'Overig'
];

// --- HELPER FOR VIP STATUS ---
// In a real app with large data, this lookup would be optimized on backend or via joined query.
const VipBadge = ({ customerId }: { customerId: string }) => {
    // We fetch customer to check tags. 
    // Optimization: In this component we might fetch all customers once and memoize, 
    // but for simplicity and correctness we use the repo direct access which is fast in-memory.
    const customer = customerRepo.getById(customerId);
    if (customer && customer.tags && customer.tags.includes('VIP')) {
        return (
            <span title="VIP Gast" className="inline-flex items-center ml-1">
                <Crown size={12} className="text-amber-500 fill-amber-500" />
            </span>
        );
    }
    return null;
};

// --- COMPONENTS ---

const KPIChip = ({ 
  label, count, active, onClick, color, icon: Icon 
}: { 
  label: string, count: number, active: boolean, onClick: () => void, color: string, icon: any 
}) => (
  <button 
    onClick={onClick}
    className={`
      flex items-center justify-between p-3 rounded-xl border transition-all duration-200 min-w-[140px] flex-1
      ${active 
        ? `bg-${color}-900/20 border-${color}-500/50 shadow-[0_0_15px_rgba(0,0,0,0.3)]` 
        : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:bg-slate-800'}
    `}
  >
    <div className="flex flex-col items-start">
      <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${active ? `text-${color}-400` : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`text-2xl font-serif font-bold ${active ? 'text-white' : 'text-slate-300'}`}>
        {count}
      </span>
    </div>
    <div className={`p-2 rounded-lg ${active ? `bg-${color}-500 text-black` : 'bg-slate-950 text-slate-600'}`}>
      <Icon size={18} />
    </div>
  </button>
);

// ... (Rest of existing Inline Edit Components unchanged: EditablePax, EditablePackage, EditableStatus) ...
const EditablePax = ({ reservation, onChange }: { reservation: Reservation, onChange: (id: string, pax: number) => void }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(reservation.partySize);

  const handleSave = () => {
    if (val !== reservation.partySize) {
      onChange(reservation.id, val);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <input 
          autoFocus
          type="number" 
          value={val}
          onChange={(e) => setVal(parseInt(e.target.value) || 0)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-12 h-7 bg-slate-950 border border-amber-500 rounded text-center text-xs text-white outline-none"
        />
        <button onClick={handleSave} className="text-emerald-500"><Check size={14}/></button>
      </div>
    );
  }

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className="flex items-center group cursor-pointer hover:bg-slate-800/50 px-1 rounded transition-colors"
    >
      <span className="font-bold text-white mr-1">{reservation.partySize}p</span>
      <Edit2 size={10} className="text-slate-600 ml-1 opacity-0 group-hover:opacity-100" />
    </div>
  );
};

const EditablePackage = ({ reservation, onChange }: { reservation: Reservation, onChange: (id: string, type: 'standard' | 'premium') => void }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as 'standard' | 'premium';
    if (val !== reservation.packageType) {
      onChange(reservation.id, val);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select 
        autoFocus
        value={reservation.packageType}
        onChange={handleChange}
        onBlur={() => setIsEditing(false)}
        onClick={(e) => e.stopPropagation()}
        className="h-7 text-[10px] bg-slate-950 border border-amber-500 rounded text-white outline-none uppercase font-bold"
      >
        <option value="standard">STANDARD</option>
        <option value="premium">PREMIUM</option>
      </select>
    );
  }

  return (
    <div 
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      className="flex items-center group cursor-pointer hover:bg-slate-800/50 px-1 rounded transition-colors"
    >
      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${reservation.packageType === 'premium' ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
        {reservation.packageType}
      </span>
      <Edit2 size={10} className="text-slate-600 ml-1 opacity-0 group-hover:opacity-100" />
    </div>
  );
};

const EditableStatus = ({ reservation, onChange }: { reservation: Reservation, onChange: (id: string, status: BookingStatus) => void }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as BookingStatus;
    if (newStatus !== reservation.status) {
      onChange(reservation.id, newStatus);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select 
        autoFocus
        value={reservation.status}
        onChange={handleChange}
        onBlur={() => setIsEditing(false)}
        onClick={(e) => e.stopPropagation()}
        className="h-7 text-[10px] bg-slate-950 border border-amber-500 rounded text-white outline-none uppercase font-bold"
      >
        <option value="REQUEST">REQUEST</option>
        <option value="OPTION">OPTION</option>
        <option value="CONFIRMED">CONFIRMED</option>
        <option value="ARRIVED">ARRIVED</option>
        <option value="CANCELLED">CANCELLED</option>
        <option value="NOSHOW">NOSHOW</option>
      </select>
    );
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="cursor-pointer group relative inline-block">
      <Badge status={reservation.status}>{reservation.status}</Badge>
      <div className="absolute top-0 right-0 -mt-1 -mr-1 opacity-0 group-hover:opacity-100">
        <div className="bg-slate-800 rounded-full p-0.5 border border-slate-600">
            <Edit2 size={8} className="text-slate-300" />
        </div>
      </div>
    </div>
  );
};

export const ReservationManager = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Use custom hook for async data
  const { data: reservations, isLoading, refresh } = useReservations();
  
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]); 

  // Filter State
  const [filterMode, setFilterMode] = useState<FilterMode>('TODAY');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('DATE');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Drawer / Modals
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalTab, setEditModalTab] = useState<string | undefined>(undefined);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPriceEditing, setIsPriceEditing] = useState(false);
  
  // Link Modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  
  // Payment Logic
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('FACTUUR');
  const [paymentType, setPaymentType] = useState<'DEPOSIT' | 'FINAL' | 'PARTIAL'>('PARTIAL');
  
  // Modals with Email Choice
  const [sendEmailChecked, setSendEmailChecked] = useState(true); // Default to TRUE
  
  // Cancellation
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonSelect, setCancelReasonSelect] = useState(CANCELLATION_REASONS[0]);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [itemToCancel, setItemToCancel] = useState<string | null>(null); 

  // Option
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [itemToSetOption, setItemToSetOption] = useState<string | null>(null);
  const [optionDuration, setOptionDuration] = useState('1WEEK');
  const [optionCustomDate, setOptionCustomDate] = useState('');

  // Status Change Modal (Generic)
  const [statusChangeTarget, setStatusChangeTarget] = useState<{id: string, status: BookingStatus} | null>(null);

  // --- LOADING EVENTS & INVOICES ---
  useEffect(() => {
    setAllEvents(calendarRepo.getAll());
    setInvoices(invoiceRepo.getAll());
    
    // Listen for storage updates
    const handleUpdate = () => setInvoices(invoiceRepo.getAll());
    window.addEventListener('storage-update', handleUpdate);
    return () => window.removeEventListener('storage-update', handleUpdate);
  }, []);

  // --- REACTIVE DETAIL VIEW SYNC ---
  useEffect(() => {
    if (selectedReservation) {
        const fresh = reservations.find(r => r.id === selectedReservation.id);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedReservation)) {
            setSelectedReservation(fresh);
        }
    }
  }, [reservations, selectedReservation]);

  // ... (Deep Linking & Sort Logic same as before) ...
  useEffect(() => {
    if (reservations.length > 0) {
      const openId = searchParams.get('open');
      if (openId && !selectedReservation) {
          const match = reservations.find(r => r.id === openId);
          if (match) setSelectedReservation(match);
      }
      
      const editId = searchParams.get('editId');
      const tab = searchParams.get('tab');
      if (editId) {
          const match = reservations.find(r => r.id === editId);
          if (match) {
              setSelectedReservation(match);
              if (tab) setEditModalTab(tab);
              setShowEditModal(true);
          }
      }
      
      const dateParam = searchParams.get('date');
      if (dateParam) {
          setSelectedDate(dateParam);
          setFilterMode('ALL');
      }
    }
  }, [reservations, searchParams]);
  
  useEffect(() => {
    if (selectedReservation) {
        setPaymentAmount(selectedReservation.financials.finalTotal - selectedReservation.financials.paid);
    }
  }, [selectedReservation]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <div className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  // ... (Stats Logic same as before) ...
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const active = reservations.filter(r => r.status !== 'CANCELLED' && r.status !== 'ARCHIVED');
    
    return {
      todayCount: active.filter(r => r.date === today).length,
      actionCount: active.filter(r => r.status === 'REQUEST' || getPaymentStatus(r) === 'OVERDUE' || (r.status === 'OPTION' && r.optionExpiresAt && r.optionExpiresAt <= today)).length,
      requests: active.filter(r => r.status === 'REQUEST').length,
      options: active.filter(r => r.status === 'OPTION').length,
      cancelled: reservations.filter(r => r.status === 'CANCELLED').length,
      arrivals: active.filter(r => r.date === today && r.status === 'CONFIRMED').length,
    };
  }, [reservations]);

  // ... (Filter Logic same as before) ...
  const filteredData = useMemo(() => {
    let result = reservations;
    const today = new Date().toISOString().split('T')[0];

    if (searchTerm) {
        const q = searchTerm.toLowerCase();
        result = result.filter(r => {
            const fullName = `${r.customer.firstName} ${r.customer.lastName}`.toLowerCase();
            const email = r.customer.email.toLowerCase();
            const id = r.id.toLowerCase();
            const company = r.customer.companyName ? r.customer.companyName.toLowerCase() : '';
            const status = r.status.toLowerCase();

            return fullName.includes(q) || 
                   email.includes(q) || 
                   id.includes(q) || 
                   company.includes(q) ||
                   status.includes(q);
        });
        
    } else {
        switch (filterMode) {
          case 'TODAY':
            result = result.filter(r => r.date === today && r.status !== BookingStatus.CANCELLED);
            break;
          case 'ACTION':
            result = result.filter(r => {
               if (r.status === 'CANCELLED' || r.status === 'ARCHIVED') return false;
               const isReq = r.status === 'REQUEST';
               const isOverdue = getPaymentStatus(r) === 'OVERDUE';
               const isExpiring = r.status === 'OPTION' && r.optionExpiresAt && r.optionExpiresAt <= today;
               return isReq || isOverdue || isExpiring;
            });
            break;
          case 'REQUESTS':
            result = result.filter(r => r.status === 'REQUEST');
            break;
          case 'OPTIONS':
            result = result.filter(r => r.status === 'OPTION');
            break;
          case 'CANCELLED':
            result = result.filter(r => r.status === 'CANCELLED');
            break;
          case 'ARRIVALS':
            result = result.filter(r => r.date === today && (r.status === 'CONFIRMED' || r.status === 'ARRIVED'));
            break;
          case 'ALL':
            if (selectedDate) {
                result = result.filter(r => r.date === selectedDate);
            }
            break;
        }
    }

    return result.sort((a, b) => {
        let valA, valB;
        switch (sortField) {
            case 'CREATED':
                valA = new Date(a.createdAt).getTime();
                valB = new Date(b.createdAt).getTime();
                break;
            case 'DATE':
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
                break;
            case 'NAME':
                valA = (a.customer.lastName + a.customer.firstName).toLowerCase();
                valB = (b.customer.lastName + b.customer.firstName).toLowerCase();
                break;
            default:
                valA = 0; valB = 0;
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
  }, [reservations, filterMode, selectedDate, searchTerm, sortField, sortDirection]);

  // ... (All Action Handlers: handleInlineStatusChange, confirmStatusChange, etc. same as before) ...
  const handleInlineStatusChange = (id: string, newStatus: BookingStatus) => {
    setSendEmailChecked(true); // Default to send email
    
    if (newStatus === BookingStatus.CANCELLED) {
        setItemToCancel(id);
        setShowCancelModal(true);
        return;
    }
    if (newStatus === BookingStatus.OPTION) {
        setItemToSetOption(id);
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setOptionCustomDate(d.toISOString().split('T')[0]);
        setOptionDuration('1WEEK');
        setShowOptionModal(true);
        return;
    }
    setStatusChangeTarget({ id, status: newStatus });
  };

  const confirmStatusChange = () => {
    if (!statusChangeTarget) return;
    const { id, status } = statusChangeTarget;
    const original = reservations.find(r => r.id === id);
    if (!original) return;
    const updated = { ...original, status };
    bookingRepo.update(id, () => updated);
    undoManager.registerUndo(`Status gewijzigd naar ${status}`, 'RESERVATION', id, original);
    logAuditAction('UPDATE_STATUS', 'RESERVATION', id, { description: `Update to ${status} via Manager`, before: original, after: updated });
    if (sendEmailChecked) {
        if (status === 'CONFIRMED') triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: updated });
        else if (status === 'REQUEST') triggerEmail('BOOKING_REQUEST_RECEIVED', { type: 'RESERVATION', id, data: updated });
    }
    setStatusChangeTarget(null);
    refreshData();
  };

  const confirmOptionStatus = () => {
      if (!itemToSetOption) return;
      let expiryDate = optionCustomDate;
      if (optionDuration === '1WEEK') { const d = new Date(); d.setDate(d.getDate() + 7); expiryDate = d.toISOString().split('T')[0]; } 
      else if (optionDuration === '2WEEKS') { const d = new Date(); d.setDate(d.getDate() + 14); expiryDate = d.toISOString().split('T')[0]; }
      const original = reservations.find(r => r.id === itemToSetOption);
      if (!original) return;
      const updated = { ...original, status: BookingStatus.OPTION, optionExpiresAt: expiryDate };
      bookingRepo.update(itemToSetOption, () => updated);
      logAuditAction('UPDATE_STATUS', 'RESERVATION', itemToSetOption, { description: `Status changed to OPTION`, before: original, after: updated });
      undoManager.showSuccess(`Omgezet naar Optie`);
      if (sendEmailChecked) triggerEmail('BOOKING_OPTION_EXPIRING', { type: 'RESERVATION', id: itemToSetOption, data: updated });
      setShowOptionModal(false);
      setItemToSetOption(null);
      refreshData();
  };

  const handleInlinePaxChange = (id: string, newPax: number) => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;
    const updatedRes = { ...original, partySize: newPax };
    const newFinancials = recalculateReservationFinancials(updatedRes);
    const finalUpdate = { ...updatedRes, financials: newFinancials };
    bookingRepo.update(id, () => finalUpdate);
    undoManager.registerUndo(`Aantal personen gewijzigd naar ${newPax}`, 'RESERVATION', id, original);
    logAuditAction('UPDATE_PAX', 'RESERVATION', id, { description: `Inline update to ${newPax}p`, before: original, after: finalUpdate });
    refreshData();
  };

  const handleInlinePackageChange = (id: string, newPackage: 'standard' | 'premium') => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;
    const updatedRes = { ...original, packageType: newPackage };
    const newFinancials = recalculateReservationFinancials(updatedRes);
    const finalUpdate = { ...updatedRes, financials: newFinancials };
    bookingRepo.update(id, () => finalUpdate);
    undoManager.registerUndo(`Arrangement gewijzigd naar ${newPackage}`, 'RESERVATION', id, original);
    logAuditAction('UPDATE_PACKAGE', 'RESERVATION', id, { description: `Inline update to ${newPackage}`, before: original, after: finalUpdate });
    refreshData();
  };
  
  const handleDeleteReservation = () => {
    if (selectedReservation) {
        bookingRepo.delete(selectedReservation.id);
        logAuditAction('DELETE_RESERVATION', 'RESERVATION', selectedReservation.id, { description: 'Deleted via admin manager', before: selectedReservation });
        undoManager.showSuccess("Reservering verwijderd (in prullenbak).");
        setSelectedReservation(null);
        setShowDeleteModal(false);
        refreshData();
    }
  };
  
  const handleRegisterPayment = () => {
    if (!selectedReservation) return;
    const newPayment: PaymentRecord = { id: `PAY-${Date.now()}`, amount: paymentAmount, method: paymentMethod, date: new Date().toISOString(), type: paymentType };
    const currentPayments = selectedReservation.financials.payments || [];
    const updatedPayments = [...currentPayments, newPayment];
    const newPaidTotal = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const isFullyPaid = newPaidTotal >= selectedReservation.financials.finalTotal - 0.01;
    const updatedRes = {
        ...selectedReservation,
        financials: {
            ...selectedReservation.financials,
            payments: updatedPayments,
            paid: newPaidTotal,
            isPaid: isFullyPaid,
            paidAt: isFullyPaid ? new Date().toISOString() : selectedReservation.financials.paidAt,
            paymentMethod: isFullyPaid ? paymentMethod : selectedReservation.financials.paymentMethod
        }
    };
    bookingRepo.update(selectedReservation.id, () => updatedRes);
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedReservation.id, { description: `Payment of €${paymentAmount} registered`, before: selectedReservation, after: updatedRes });
    undoManager.showSuccess('Betaling geregistreerd.');
    setShowPaymentModal(false);
    setSelectedReservation(updatedRes); 
    refreshData();
  };
  
  const handleCreateInvoice = () => {
    if (!selectedReservation) return;
    const existing = invoiceRepo.getAll().find(i => i.reservationId === selectedReservation.id);
    if (existing) {
        if (!confirm("Er bestaat al een factuur voor deze reservering. Wil je een nieuwe aanmaken?")) return;
    }
    const newInvoice = createInvoiceFromReservation(selectedReservation);
    invoiceRepo.add(newInvoice);
    logAuditAction('CREATE_INVOICE', 'SYSTEM', newInvoice.id, { description: `Created for res ${selectedReservation.id}` });
    undoManager.showSuccess("Factuur aangemaakt");
    setInvoices(invoiceRepo.getAll());
  };

  const handlePriceOverrideSave = (override: any, sendEmail: boolean) => {
    if (!selectedReservation) return;
    const updatedRes = { ...selectedReservation, adminPriceOverride: override };
    const newFinancials = recalculateReservationFinancials(updatedRes);
    const finalUpdate = { ...updatedRes, adminPriceOverride: override, financials: newFinancials };
    bookingRepo.update(selectedReservation.id, () => finalUpdate);
    logAuditAction('PRICE_OVERRIDE', 'RESERVATION', selectedReservation.id, { description: 'Price manually overridden', before: selectedReservation, after: finalUpdate });
    if (sendEmail) {
        triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: selectedReservation.id, data: { ...updatedRes, financials: newFinancials } });
    }
    undoManager.showSuccess("Prijsaanpassing opgeslagen.");
    setIsPriceEditing(false);
    const fresh = bookingRepo.getById(selectedReservation.id);
    if(fresh) setSelectedReservation(fresh);
    refreshData();
  };

  // --- SELECTION LOGIC ---
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredData.map(r => r.id)));
    }
  };

  const handleBulkAction = async (action: 'CONFIRM' | 'CANCEL' | 'DELETE' | 'EMAIL' | 'INVOICE') => {
    if (selectedIds.size === 0) return;
    setSendEmailChecked(true);
    if (action === 'CANCEL') { setItemToCancel(null); setShowCancelModal(true); return; }
    if (!confirm(`Weet je zeker dat je ${selectedIds.size} items wilt bijwerken?`)) return;
    setIsProcessingBulk(true);
    await new Promise(r => setTimeout(r, 500));

    if (action === 'DELETE') {
        selectedIds.forEach(id => bookingRepo.delete(id));
    } else if (action === 'EMAIL') {
        selectedIds.forEach(id => {
            const r = bookingRepo.getById(id);
            if(r) triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: r });
        });
    } else if (action === 'INVOICE') {
        // ... (Invoice generation logic) ...
        const currentInvoices = invoiceRepo.getAll();
        const newInvoices: Invoice[] = [];
        selectedIds.forEach(id => {
            const res = bookingRepo.getById(id);
            if (res) newInvoices.push(createInvoiceFromReservation(res, [...currentInvoices, ...newInvoices]));
        });
        if (newInvoices.length > 0) invoiceRepo.saveAll([...currentInvoices, ...newInvoices]);
        setInvoices(invoiceRepo.getAll());
        undoManager.showSuccess(`${newInvoices.length} facturen aangemaakt.`);
    } else {
        selectedIds.forEach(id => {
            bookingRepo.update(id, r => ({ ...r, status: BookingStatus.CONFIRMED }));
            triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id, data: bookingRepo.getById(id)! });
        });
    }

    if (action !== 'INVOICE') {
        logAuditAction('BULK_UPDATE', 'RESERVATION', 'MULTIPLE', { description: `Bulk action ${action} on ${selectedIds.size} items.` });
        undoManager.showSuccess(`${selectedIds.size} reserveringen bijgewerkt.`);
    }
    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    refreshData();
  };

  const executeCancellation = () => {
      const reason = cancelReasonSelect === 'Overig' ? cancelReasonText : cancelReasonSelect;
      if (!reason) { alert("Geef een reden op voor annulering."); return; }
      const idsToCancel = itemToCancel ? [itemToCancel] : Array.from(selectedIds);
      idsToCancel.forEach(id => {
          const original = bookingRepo.getById(id);
          if (!original) return;
          const updated = { ...original, status: BookingStatus.CANCELLED, cancellationReason: reason };
          bookingRepo.update(id, () => updated);
          if (sendEmailChecked) triggerEmail('BOOKING_CANCELLED', { type: 'RESERVATION', id, data: updated });
          logAuditAction('CANCEL_RESERVATION', 'RESERVATION', id, { description: `Cancelled with reason: ${reason}`, before: original, after: updated });
      });
      undoManager.showSuccess(`${idsToCancel.length} reservering(en) geannuleerd.`);
      setShowCancelModal(false);
      setCancelReasonText('');
      setCancelReasonSelect(CANCELLATION_REASONS[0]);
      setItemToCancel(null);
      setSelectedIds(new Set());
      refreshData();
  };

  // ... (capacityStats, handleLinkReservations, etc. remain unchanged) ...
  const capacityStats = useMemo(() => {
    let targetDate = filterMode === 'TODAY' ? new Date().toISOString().split('T')[0] : selectedDate;
    if (!targetDate) return null;
    const event = allEvents.find(e => e.date === targetDate && e.type === 'SHOW');
    const capacity = (event as any)?.capacity || 230;
    const dailyRes = reservations.filter(r => r.date === targetDate && ['CONFIRMED', 'ARRIVED', 'OPTION', 'INVITED'].includes(r.status));
    const booked = dailyRes.reduce((s, r) => s + r.partySize, 0);
    const pending = reservations.filter(r => r.date === targetDate && r.status === 'REQUEST').reduce((s,r) => s + r.partySize, 0);
    return { date: targetDate, capacity, booked, pending, eventName: event?.title };
  }, [filterMode, selectedDate, reservations, allEvents]);

  const handleLinkReservations = (targetId: string) => { /* ... */ };
  const handleUnlink = (targetId: string) => { /* ... */ };
  const linkCandidates = useMemo(() => [], [linkSearchTerm]); // Placeholder
  const getTicketPrice = (r: Reservation) => {
    const ticketLine = r.financials.priceBreakdown?.find(i => i.category === 'TICKET');
    return ticketLine ? ticketLine.unitPrice : (r.financials.subtotal / (r.partySize || 1));
  };
  const getActionReason = (r: Reservation) => {
    if (r.status === 'REQUEST') return { label: 'Aanvraag Beoordelen', color: 'blue' };
    if (r.status === 'OPTION') return { label: 'Optie Verloopt', color: 'amber' };
    const payStatus = getPaymentStatus(r);
    if (payStatus === 'OVERDUE') return { label: 'Betaling Vervallen', color: 'red' };
    if (payStatus === 'DUE_SOON') return { label: 'Betaling Nadert', color: 'orange' };
    return { label: 'Actie Vereist', color: 'slate' };
  };
  const linkedInvoice = selectedReservation ? invoices.find(i => i.reservationId === selectedReservation.id) : null;

  return (
    <div className="h-full flex flex-col space-y-6 pb-20">
      
      {/* 1. TOP BAR: KPI FILTERS */}
      <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
         {/* ... chips ... */}
         <KPIChip label="Vandaag" count={stats.todayCount} active={filterMode === 'TODAY' && !searchTerm} onClick={() => { setFilterMode('TODAY'); setSearchTerm(''); }} color="emerald" icon={Calendar} />
         <KPIChip label="Actie Vereist" count={stats.actionCount} active={filterMode === 'ACTION' && !searchTerm} onClick={() => { setFilterMode('ACTION'); setSearchTerm(''); }} color="red" icon={AlertCircle} />
         <KPIChip label="Aanvragen" count={stats.requests} active={filterMode === 'REQUESTS' && !searchTerm} onClick={() => { setFilterMode('REQUESTS'); setSearchTerm(''); }} color="blue" icon={MessageSquare} />
         <KPIChip label="Opties" count={stats.options} active={filterMode === 'OPTIONS' && !searchTerm} onClick={() => { setFilterMode('OPTIONS'); setSearchTerm(''); }} color="amber" icon={Clock} />
         <KPIChip label="Geannuleerd" count={stats.cancelled} active={filterMode === 'CANCELLED' && !searchTerm} onClick={() => { setFilterMode('CANCELLED'); setSearchTerm(''); }} color="slate" icon={Ban} />
         <div className="h-auto w-px bg-slate-800 mx-2 hidden lg:block" />
         {capacityStats && (
            <Card className="flex-grow min-w-[250px] p-3 bg-slate-900 border-slate-800 flex flex-col justify-center">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{capacityStats.eventName || 'Geen Show'}</span>
                  <span className="text-xs font-mono font-bold text-white">{capacityStats.booked} / {capacityStats.capacity}</span>
               </div>
               <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, (capacityStats.booked / capacityStats.capacity) * 100)}%` }} />
                  <div className="h-full bg-blue-500/50" style={{ width: `${Math.min(100, (capacityStats.pending / capacityStats.capacity) * 100)}%` }} />
               </div>
            </Card>
         )}
      </div>

      {/* 2. TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
         <div className="relative flex-grow w-full md:w-auto group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input className="w-full bg-black/40 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-slate-600" placeholder="Zoek op naam, email of ref..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         </div>
         <div className="flex items-center space-x-2 bg-black/40 p-1 rounded-xl border border-slate-700">
            <button onClick={() => { setFilterMode('ALL'); setSelectedDate(''); setSearchTerm(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterMode === 'ALL' && !selectedDate && !searchTerm ? 'bg-amber-500 text-black' : 'text-slate-400 hover:text-white'}`}>Alles</button>
            <div className="h-4 w-px bg-slate-700" />
            <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setFilterMode('ALL'); }} className="bg-transparent border-none text-white text-xs font-bold focus:ring-0 cursor-pointer" />
         </div>
         <div className="flex space-x-2">
            <Button onClick={() => navigate('/admin/reservations/new')} className="h-10 text-xs bg-amber-500 text-black hover:bg-amber-400 border-none font-bold">+ Nieuwe Boeking</Button>
         </div>
      </div>

      {/* 3. RICH TABLE */}
      <div className="flex-grow bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
         {isLoading && (
            <div className="absolute inset-0 bg-slate-900/80 z-20 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center"><Loader2 size={32} className="text-amber-500 animate-spin mb-2" /><span className="text-xs font-bold text-slate-400 uppercase">Gegevens ophalen...</span></div>
            </div>
         )}
         <ResponsiveTable<Reservation>
            data={filteredData}
            keyExtractor={r => r.id}
            onRowClick={setSelectedReservation}
            isVirtual={true}
            virtualHeight="calc(100vh - 380px)"
            rowHeight={80} 
            columns={[
               { 
                 header: (
                   <div className="flex items-center space-x-2">
                     <input 
                       type="checkbox" 
                       className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500 w-4 h-4 cursor-pointer"
                       checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                       onChange={(e) => { e.stopPropagation(); toggleAll(); }}
                     />
                   </div>
                 ), 
                 accessor: r => (
                   <div onClick={e => e.stopPropagation()}>
                     <input 
                       type="checkbox" 
                       className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500 w-4 h-4 cursor-pointer"
                       checked={selectedIds.has(r.id)}
                       onChange={(e) => { e.stopPropagation(); toggleSelection(r.id); }}
                     />
                   </div>
                 ),
                 className: 'w-12 text-center'
               },
               { 
                 header: (
                   <button onClick={() => handleSort('NAME')} className="flex items-center font-bold text-slate-300 hover:text-white uppercase tracking-wider">
                     Gast {getSortIcon('NAME')}
                   </button>
                 ),
                 accessor: r => (
                    <div className="font-bold text-white text-sm flex items-center">
                        {formatGuestName(r.customer.firstName, r.customer.lastName)} 
                        {/* VIP INDICATOR */}
                        <VipBadge customerId={r.customerId} />
                        {r.customer.companyName && <span className="block text-[10px] text-blue-400 font-normal ml-2">{r.customer.companyName}</span>}
                    </div>
                 )
               },
               { 
                 header: (
                   <button onClick={() => handleSort('DATE')} className="flex items-center font-bold text-slate-300 hover:text-white uppercase tracking-wider">
                     Datum {getSortIcon('DATE')}
                   </button>
                 ),
                 accessor: r => <span className="block font-bold text-slate-200 text-sm">{new Date(r.date).toLocaleDateString('nl-NL', {weekday:'short', day:'numeric', month:'short'})}</span> 
               },
               // ... (Rest of columns unchanged) ...
               { 
                 header: 'Pax', 
                 accessor: r => <EditablePax reservation={r} onChange={handleInlinePaxChange} />,
                 className: 'w-20'
               },
               { 
                 header: 'Arrangement', 
                 accessor: r => (
                   <div className="flex flex-col">
                      <EditablePackage reservation={r} onChange={handleInlinePackageChange} />
                      <span className="text-[10px] text-slate-500 mt-0.5 ml-1">€{getTicketPrice(r).toFixed(0)} p.p.</span>
                   </div>
                 ) 
               },
               { 
                 header: filterMode === 'CANCELLED' ? 'Reden Annulering' : (filterMode === 'ACTION' ? 'Actie Vereist' : 'Status'), 
                 accessor: r => {
                   if (filterMode === 'CANCELLED') {
                       return (
                           <div className="flex flex-col">
                               <Badge status="CANCELLED">Geannuleerd</Badge>
                               <span className="text-[10px] text-slate-400 mt-1 italic">{r.cancellationReason || 'Geen reden opgegeven'}</span>
                           </div>
                       )
                   }
                   if (filterMode === 'ACTION' && !searchTerm) {
                      const reason = getActionReason(r);
                      return <Badge status="CUSTOM" className={`bg-${reason.color}-900/30 text-${reason.color}-400 border-${reason.color}-800`}>{reason.label}</Badge>;
                   }
                   return (
                     <div className="flex flex-col items-start">
                        <EditableStatus reservation={r} onChange={handleInlineStatusChange} />
                        {r.status === BookingStatus.OPTION && r.optionExpiresAt && (
                            <span className="text-[9px] font-bold text-amber-500 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-900/50 mt-1 flex items-center">
                                <Clock size={10} className="mr-1"/> 
                                {new Date(r.optionExpiresAt).toLocaleDateString()}
                            </span>
                        )}
                     </div>
                   );
                 } 
               },
               { 
                 header: (
                   <button onClick={() => handleSort('CREATED')} className="flex items-center font-bold text-slate-300 hover:text-white uppercase tracking-wider">
                     Boekingstijd {getSortIcon('CREATED')}
                   </button>
                 ),
                 accessor: r => (
                   <div className="flex flex-col">
                     <div className="flex items-center space-x-2">
                       <span className="font-mono font-bold text-white">€{r.financials.finalTotal.toFixed(0)}</span>
                       {invoices.some(i => i.reservationId === r.id) && (
                         <div title="Factuur aanwezig">
                           <FileText size={12} className="text-slate-500" />
                         </div>
                       )}
                     </div>
                     <span className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleString('nl-NL', {day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                   </div>
                 )
               },
            ]}
         />
         <div className="bg-slate-950 p-2 text-[10px] text-center text-slate-500 border-t border-slate-800 uppercase font-bold tracking-widest">
            {filteredData.length} Reserveringen getoond
         </div>
      </div>

      {/* 4. DETAIL DRAWER (Updated with VIP Badge in title) */}
      <ResponsiveDrawer
         isOpen={!!selectedReservation}
         onClose={() => { setSelectedReservation(null); setEditModalTab(undefined); }}
         title="Details"
         widthClass="md:w-[600px]"
      >
         {selectedReservation && (
            <div className="pb-20 space-y-8">
               
               {/* Quick Header */}
               <div className="flex justify-between items-start">
                  <div>
                     <div className="flex items-center space-x-2">
                        <h2 className="text-2xl font-serif text-white">{formatGuestName(selectedReservation.customer.firstName, selectedReservation.customer.lastName)}</h2>
                        <VipBadge customerId={selectedReservation.customerId} />
                        {selectedReservation.customer.companyName && <Building2 size={16} className="text-blue-500" />}
                     </div>
                     <div className="flex flex-col space-y-1 mt-1">
                        <span className="flex items-center text-slate-400 text-sm"><Mail size={12} className="mr-2"/> {selectedReservation.customer.email}</span>
                        <span className="flex items-center text-slate-400 text-sm"><Phone size={12} className="mr-2"/> {selectedReservation.customer.phone || selectedReservation.customer.phoneCode + ' ...'}</span>
                        <span className="flex items-center text-slate-400 text-sm"><MapPin size={12} className="mr-2"/> {selectedReservation.customer.city} ({selectedReservation.customer.country || 'NL'})</span>
                     </div>
                  </div>
                  <div className="text-right">
                     <Badge status={selectedReservation.status} className="mb-1 text-sm px-3 py-1"/>
                     <p className="text-xs text-slate-500 font-mono">{selectedReservation.id}</p>
                  </div>
               </div>

               {/* ... (Rest of Detail Drawer is unchanged) ... */}
               {/* Business Details (If applicable) */}
               {selectedReservation.customer.companyName && (
                   <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl space-y-3">
                       <h4 className="text-xs font-bold text-blue-500 uppercase tracking-widest flex items-center">
                           <Briefcase size={14} className="mr-2"/> Zakelijke Details
                       </h4>
                       <div className="grid grid-cols-2 gap-4 text-sm">
                           <div>
                               <span className="text-xs text-slate-500 block">Bedrijf</span>
                               <span className="text-white font-bold">{selectedReservation.customer.companyName}</span>
                           </div>
                           {/* Alternative Date removed from UI */}
                           {selectedReservation.customer.billingInstructions && (
                               <div className="col-span-2">
                                   <span className="text-xs text-slate-500 block">Factuur Opmerking</span>
                                   <span className="text-slate-300 italic">{selectedReservation.customer.billingInstructions}</span>
                               </div>
                           )}
                       </div>
                   </div>
               )}

               {/* Action Grid */}
               <div className="grid grid-cols-3 gap-2">
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1" onClick={() => triggerEmail('BOOKING_CONFIRMED', {type:'RESERVATION', id: selectedReservation.id, data: selectedReservation})}>
                     <Mail size={16} /> <span>Email</span>
                  </Button>
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1" onClick={() => setShowEditModal(true)}>
                     <SlidersHorizontal size={16} /> <span>Wijzig</span>
                  </Button>
                  <Button variant="secondary" className="flex flex-col items-center justify-center h-16 text-xs gap-1 text-red-400 hover:text-red-500" onClick={() => setShowDeleteModal(true)}>
                     <Trash2 size={16} /> <span>Verwijder</span>
                  </Button>
               </div>

               {/* ... (Linked Reservations, Info Cards, Financials, Timeline - all unchanged) ... */}
               <div className="space-y-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
                     <div className="flex items-center space-x-4">
                        <div className="p-3 bg-slate-950 rounded-lg text-slate-400"><Calendar size={20} /></div>
                        <div>
                           <p className="text-xs text-slate-500 font-bold uppercase">Wanneer</p>
                           <p className="text-white font-bold">{new Date(selectedReservation.date).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xs text-slate-500">{selectedReservation.startTime || '19:30'}</p>
                        <p className="text-xs text-emerald-500 font-bold">{allEvents.find(e => e.date === selectedReservation.date)?.title || 'Show'}</p>
                     </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Boeking Details</h4>
                     <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                           <span className="text-slate-500 block text-xs">Arrangement</span>
                           <span className="text-white font-bold capitalize">{selectedReservation.packageType}</span>
                        </div>
                        <div className="space-y-1">
                           <span className="text-slate-500 block text-xs">Gasten</span>
                           <span className="text-white font-bold">{selectedReservation.partySize} Personen</span>
                        </div>
                     </div>
                     
                     {/* Notes & Dietary */}
                     {(selectedReservation.notes.dietary || selectedReservation.notes.comments || selectedReservation.notes.internal) && (
                        <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                           {selectedReservation.notes.dietary && (
                              <div className="flex items-start space-x-2 text-red-400">
                                 <Utensils size={14} className="mt-0.5" />
                                 <span className="text-sm font-bold">{selectedReservation.notes.dietary}</span>
                              </div>
                           )}
                           {selectedReservation.notes.isCelebrating && (
                              <div className="flex items-start space-x-2 text-purple-400">
                                 <PartyPopper size={14} className="mt-0.5" />
                                 <span className="text-sm font-bold">{selectedReservation.notes.celebrationText || 'Viering'}</span>
                              </div>
                           )}
                           {selectedReservation.notes.comments && (
                              <div className="flex items-start space-x-2 text-slate-400 italic">
                                 <MessageSquare size={14} className="mt-0.5" />
                                 <span className="text-sm">"{selectedReservation.notes.comments}"</span>
                              </div>
                           )}
                           {selectedReservation.notes.internal && (
                              <div className="bg-amber-900/10 border border-amber-900/30 p-3 rounded-lg text-xs text-amber-200/80 mt-2">
                                 <span className="font-bold uppercase text-[9px] text-amber-500 block mb-1">Interne Notitie</span>
                                 {selectedReservation.notes.internal}
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  {/* Financials & Payments */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                     <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Financieel</h4>
                        <Badge status={getPaymentStatus(selectedReservation) === 'PAID' ? 'CONFIRMED' : 'REQUEST'}>
                           {getPaymentStatus(selectedReservation)}
                        </Badge>
                     </div>
                     <div className="p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                           <span className="text-slate-400">Totaalbedrag</span>
                           <span className="text-white font-mono font-bold">€{selectedReservation.financials.finalTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                           <span className="text-slate-400">Reeds Voldaan</span>
                           <span className="text-emerald-500 font-mono">€{selectedReservation.financials.paid.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-slate-800">
                           <span className="text-slate-400 font-bold">Openstaand</span>
                           <span className="text-white font-mono font-bold">€{(selectedReservation.financials.finalTotal - selectedReservation.financials.paid).toFixed(2)}</span>
                        </div>
                        
                        {/* New Payment Button */}
                        <div className="pt-3 mt-1">
                           <Button onClick={() => { setShowPaymentModal(true); setSelectedRes(selectedReservation); }} className="w-full text-xs h-8 bg-slate-800 hover:bg-slate-700 border-slate-700">
                              <CreditCard size={12} className="mr-2"/> Betaling Registreren
                           </Button>
                        </div>
                     </div>
                  </div>
                  
                  {/* Invoices Link */}
                  {linkedInvoice ? (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center">
                          <div className="flex items-center text-xs text-slate-400">
                              <FileText size={14} className="mr-2 text-slate-500" />
                              <span>Factuur {linkedInvoice.id}</span>
                          </div>
                          <Button variant="ghost" onClick={() => navigate('/admin/invoices')} className="text-xs h-7 px-2">Bekijk</Button>
                      </div>
                  ) : (
                      <Button variant="ghost" onClick={handleCreateInvoice} className="w-full text-xs text-slate-500 border border-dashed border-slate-800 hover:border-slate-600 hover:text-slate-300">
                          <Plus size={12} className="mr-2"/> Maak Factuur
                      </Button>
                  )}

                  {/* Audit Timeline */}
                  <div className="pt-6 border-t border-slate-800">
                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 pl-2">Geschiedenis</h4>
                     <AuditTimeline entityId={selectedReservation.id} />
                  </div>

               </div>
            </div>
         )}
      </ResponsiveDrawer>

      {/* Edit Modal */}
      {showEditModal && selectedReservation && (
        <EditReservationModal 
          reservation={selectedReservation} 
          onClose={() => { setShowEditModal(false); refresh(); }} 
          onSave={() => { 
             setShowEditModal(false); 
             setSelectedReservation(null); 
             refresh(); 
          }}
          initialTab={editModalTab}
        />
      )}

      {/* Delete Confirmation */}
      <DestructiveActionModal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteReservation}
        title="Reservering Verwijderen"
        description={<p>Weet u zeker dat u deze reservering wilt verwijderen? Dit verplaatst het item naar de prullenbak.</p>}
        verificationText="DELETE"
        confirmButtonText="Verwijderen"
      />

      {/* Cancel Confirmation */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <Card className="w-full max-w-sm bg-slate-900 border-slate-800 shadow-2xl">
              <div className="p-6">
                 <h3 className="text-xl font-bold text-white mb-4 flex items-center"><AlertTriangle className="text-red-500 mr-2"/> Annuleren</h3>
                 
                 <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Reden</label>
                        <select 
                            className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                            value={cancelReasonSelect}
                            onChange={(e) => setCancelReasonSelect(e.target.value)}
                        >
                            {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    {cancelReasonSelect === 'Overig' && (
                        <textarea 
                            className="w-full h-20 bg-black border border-slate-700 rounded-lg p-3 text-sm text-white resize-none"
                            placeholder="Toelichting..."
                            value={cancelReasonText}
                            onChange={(e) => setCancelReasonText(e.target.value)}
                        />
                    )}
                    
                    <div className="pt-2 border-t border-slate-800">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={sendEmailChecked} 
                                onChange={(e) => setSendEmailChecked(e.target.checked)}
                                className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-red-600" 
                            />
                            <span className="text-sm text-white">Stuur annulering per e-mail</span>
                        </label>
                    </div>
                 </div>

                 <div className="flex gap-3 mt-6">
                    <Button variant="ghost" onClick={() => setShowCancelModal(false)} className="flex-1">Terug</Button>
                    <Button onClick={executeCancellation} className="flex-1 bg-red-600 hover:bg-red-700 border-none">Bevestigen</Button>
                 </div>
              </div>
           </Card>
        </div>
      )}

      {/* Option Status Modal */}
      {showOptionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <Card className="w-full max-w-sm bg-slate-900 border-slate-800 shadow-2xl">
                <div className="p-6">
                   <h3 className="text-xl font-bold text-white mb-2">Zet in Optie</h3>
                   <p className="text-sm text-slate-400 mb-6">Kies een vervaldatum voor deze optie.</p>
                   
                   <div className="space-y-4">
                       <select 
                           className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                           value={optionDuration}
                           onChange={(e) => setOptionDuration(e.target.value)}
                       >
                           <option value="1WEEK">1 Week (Standaard)</option>
                           <option value="2WEEKS">2 Weken</option>
                           <option value="CUSTOM">Aangepaste Datum</option>
                       </select>
                       
                       {optionDuration === 'CUSTOM' && (
                           <input 
                               type="date" 
                               className="w-full bg-black border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                               value={optionCustomDate}
                               onChange={(e) => setOptionCustomDate(e.target.value)}
                           />
                       )}

                       <div className="pt-2 border-t border-slate-800">
                            <label className="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={sendEmailChecked} 
                                    onChange={(e) => setSendEmailChecked(e.target.checked)}
                                    className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-amber-600" 
                                />
                                <span className="text-sm text-white">Stuur bevestiging per e-mail</span>
                            </label>
                       </div>
                   </div>

                   <div className="flex gap-3 mt-6">
                      <Button variant="ghost" onClick={() => setShowOptionModal(false)} className="flex-1">Annuleren</Button>
                      <Button onClick={confirmOptionStatus} className="flex-1 bg-amber-600 hover:bg-amber-700 border-none text-black">Opslaan</Button>
                   </div>
                </div>
             </Card>
          </div>
      )}

      {/* Payment Modal Reuse Logic */}
      {showPaymentModal && selectedReservation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-slate-950 border border-slate-800 w-full max-w-md p-6 shadow-2xl">
             <h3 className="text-lg font-bold text-white mb-4">Betaling Registreren</h3>
             <div className="space-y-4">
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Bedrag (€)</label>
                     <input 
                         type="number" 
                         className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white text-lg font-mono focus:border-emerald-500 outline-none"
                         value={paymentAmount}
                         onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                     />
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Methode</label>
                     <select 
                         className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500"
                         value={paymentMethod}
                         onChange={(e) => setPaymentMethod(e.target.value)}
                     >
                         <option value="FACTUUR">Bankoverschrijving</option>
                         <option value="IDEAL">iDeal / Mollie</option>
                         <option value="PIN">Pin (aan de deur)</option>
                         <option value="CASH">Contant</option>
                         <option value="VOUCHER">Voucher</option>
                     </select>
                 </div>
                 <div className="flex gap-3 pt-4">
                     <Button variant="ghost" onClick={() => setShowPaymentModal(false)} className="flex-1">Annuleren</Button>
                     <Button onClick={handleRegisterPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none">Opslaan</Button>
                 </div>
             </div>
          </Card>
        </div>
      )}

      {/* Confirmation for Status Change */}
      {statusChangeTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <Card className="w-full max-w-sm bg-slate-900 border-slate-800 shadow-2xl">
                <div className="p-6">
                   <h3 className="text-xl font-bold text-white mb-2">Status Wijzigen</h3>
                   <p className="text-sm text-slate-400 mb-6">
                      Weet je zeker dat je de status wilt wijzigen naar <strong>{statusChangeTarget.status}</strong>?
                   </p>
                   
                   <div className="mb-6 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <label className="flex items-center space-x-3 cursor-pointer">
                          <input 
                              type="checkbox" 
                              checked={sendEmailChecked} 
                              onChange={(e) => setSendEmailChecked(e.target.checked)}
                              className="w-5 h-5 rounded bg-slate-800 border-slate-600 checked:bg-blue-600" 
                          />
                          <span className="text-sm text-white">Stuur update email naar klant</span>
                      </label>
                   </div>

                   <div className="flex gap-3">
                      <Button variant="ghost" onClick={() => setStatusChangeTarget(null)} className="flex-1">Annuleren</Button>
                      <Button onClick={confirmStatusChange} className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none">
                          Bevestigen
                      </Button>
                   </div>
                </div>
             </Card>
          </div>
      )}

      {/* BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-6 py-3 z-50 flex items-center space-x-4 animate-in slide-in-from-bottom-10 fade-in">
           <div className="flex items-center space-x-2 border-r border-slate-700 pr-4">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">Geselecteerd</span>
           </div>
           
           <div className="flex items-center space-x-2">
              <button onClick={() => handleBulkAction('CONFIRM')} className="p-2 hover:bg-emerald-900/30 text-emerald-500 rounded-lg transition-colors" title="Bevestig Selectie"><CheckCircle2 size={18} /></button>
              <button onClick={() => handleBulkAction('CANCEL')} className="p-2 hover:bg-red-900/30 text-red-500 rounded-lg transition-colors" title="Annuleer Selectie"><XCircle size={18} /></button>
              <div className="h-4 w-px bg-slate-700 mx-2" />
              <button onClick={() => handleBulkAction('EMAIL')} className="p-2 hover:bg-blue-900/30 text-blue-500 rounded-lg transition-colors" title="Stuur Email"><Mail size={18} /></button>
              <button onClick={() => handleBulkAction('INVOICE')} className="p-2 hover:bg-amber-900/30 text-amber-500 rounded-lg transition-colors" title="Maak Facturen"><FileText size={18} /></button>
              <button onClick={() => handleBulkAction('DELETE')} className="p-2 hover:bg-slate-800 text-slate-400 rounded-lg transition-colors" title="Verwijder"><Trash2 size={18} /></button>
           </div>

           <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-500 hover:text-white">
              <X size={16} />
           </button>
        </div>
      )}

    </div>
  );
};
