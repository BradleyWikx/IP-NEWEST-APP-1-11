
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Calendar, Filter, MoreHorizontal,
  CheckCircle2, AlertCircle, Clock, XCircle, 
  User, Users, CreditCard, Star, ShoppingBag, 
  ArrowRight, Mail, Phone, Trash2, SlidersHorizontal,
  ChevronDown, MessageSquare, Utensils, Tag, PartyPopper, Briefcase, Loader2,
  Link as LinkIcon, Unlink, Plus, Edit2, Check, X, MapPin, Building2,
  Ban, FileText, Printer
} from 'lucide-react';
import { Button, Card, Badge, ResponsiveDrawer, Input } from '../UI';
import { Reservation, BookingStatus, CalendarEvent, WaitlistEntry, PaymentRecord, Invoice } from '../../types';
import { bookingRepo, calendarRepo, waitlistRepo, invoiceRepo } from '../../utils/storage';
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

const CANCELLATION_REASONS = [
  'Klantverzoek',
  'No Show',
  'Ziekte',
  'Dubbele Boeking',
  'Betaling niet ontvangen',
  'Overig'
];

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

// --- INLINE EDIT COMPONENTS ---

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
  
  // Cancellation Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonSelect, setCancelReasonSelect] = useState(CANCELLATION_REASONS[0]);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [itemToCancel, setItemToCancel] = useState<string | null>(null); 

  // NEW: Option Modal State
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [itemToSetOption, setItemToSetOption] = useState<string | null>(null);
  const [optionDuration, setOptionDuration] = useState('1WEEK');
  const [optionCustomDate, setOptionCustomDate] = useState('');

  // --- LOADING EVENTS & INVOICES ---
  useEffect(() => {
    setAllEvents(calendarRepo.getAll());
    setInvoices(invoiceRepo.getAll());
    
    // Listen for storage updates to refresh invoice list
    const handleUpdate = () => setInvoices(invoiceRepo.getAll());
    window.addEventListener('storage-update', handleUpdate);
    return () => window.removeEventListener('storage-update', handleUpdate);
  }, []);

  // --- DEEP LINKING ---
  useEffect(() => {
    if (reservations.length > 0) {
      // Handle Open Drawer
      const openId = searchParams.get('open');
      if (openId && !selectedReservation) {
          const match = reservations.find(r => r.id === openId);
          if (match) setSelectedReservation(match);
      }
      
      // Handle Edit Modal with specific Tab
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
  
  // Reset payment amount when opening new reservation
  useEffect(() => {
    if (selectedReservation) {
        setPaymentAmount(selectedReservation.financials.finalTotal - selectedReservation.financials.paid);
    }
  }, [selectedReservation]);

  // --- INLINE EDIT HANDLERS ---
  const handleInlineStatusChange = (id: string, newStatus: BookingStatus) => {
    // Intercept cancellation to require reason
    if (newStatus === BookingStatus.CANCELLED) {
        setItemToCancel(id);
        setShowCancelModal(true);
        return;
    }

    // NEW: Intercept Option to require expiry
    if (newStatus === BookingStatus.OPTION) {
        setItemToSetOption(id);
        // Default 1 week
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setOptionCustomDate(d.toISOString().split('T')[0]);
        setOptionDuration('1WEEK');
        setShowOptionModal(true);
        return;
    }

    const original = reservations.find(r => r.id === id);
    if (!original) return;

    const updated = { ...original, status: newStatus };
    bookingRepo.update(id, () => updated);
    
    // Create undo point
    undoManager.registerUndo(
      `Status gewijzigd naar ${newStatus}`,
      'RESERVATION',
      id,
      original
    );
    
    // Enhanced Audit Log with Snapshots
    logAuditAction('UPDATE_STATUS', 'RESERVATION', id, { 
        description: `Inline update to ${newStatus}`,
        before: original,
        after: updated
    });
    refresh();
  };

  const confirmOptionStatus = () => {
      if (!itemToSetOption) return;

      let expiryDate = optionCustomDate;
      if (optionDuration === '1WEEK') {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          expiryDate = d.toISOString().split('T')[0];
      } else if (optionDuration === '2WEEKS') {
          const d = new Date();
          d.setDate(d.getDate() + 14);
          expiryDate = d.toISOString().split('T')[0];
      }

      const original = reservations.find(r => r.id === itemToSetOption);
      if (!original) return;

      const updated = {
          ...original,
          status: BookingStatus.OPTION,
          optionExpiresAt: expiryDate
      };

      bookingRepo.update(itemToSetOption, () => updated);

      logAuditAction('UPDATE_STATUS', 'RESERVATION', itemToSetOption, { 
          description: `Status changed to OPTION (Expires: ${expiryDate})`,
          before: original,
          after: updated
      });
      
      undoManager.showSuccess(`Omgezet naar Optie (Geldig tot ${new Date(expiryDate).toLocaleDateString()})`);
      
      setShowOptionModal(false);
      setItemToSetOption(null);
      refresh();
  };

  const handleInlinePaxChange = (id: string, newPax: number) => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    const updatedRes = { ...original, partySize: newPax };
    const newFinancials = recalculateReservationFinancials(updatedRes);
    const finalUpdate = { ...updatedRes, financials: newFinancials };
    
    bookingRepo.update(id, () => finalUpdate);
    
    undoManager.registerUndo(
      `Aantal personen gewijzigd naar ${newPax}`,
      'RESERVATION',
      id,
      original
    );

    logAuditAction('UPDATE_PAX', 'RESERVATION', id, { 
        description: `Inline update to ${newPax}p. Total recalculated.`,
        before: original,
        after: finalUpdate
    });
    refresh();
  };

  const handleInlinePackageChange = (id: string, newPackage: 'standard' | 'premium') => {
    const original = reservations.find(r => r.id === id);
    if (!original) return;

    const updatedRes = { ...original, packageType: newPackage };
    const newFinancials = recalculateReservationFinancials(updatedRes);
    const finalUpdate = { ...updatedRes, financials: newFinancials };
    
    bookingRepo.update(id, () => finalUpdate);
    
    undoManager.registerUndo(
      `Arrangement gewijzigd naar ${newPackage}`,
      'RESERVATION',
      id,
      original
    );

    logAuditAction('UPDATE_PACKAGE', 'RESERVATION', id, { 
        description: `Inline update to ${newPackage}`,
        before: original,
        after: finalUpdate
    });
    refresh();
  };
  
  const handleDeleteReservation = () => {
    if (selectedReservation) {
        bookingRepo.delete(selectedReservation.id);
        logAuditAction('DELETE_RESERVATION', 'RESERVATION', selectedReservation.id, { 
            description: 'Deleted via admin manager',
            before: selectedReservation // Keep snapshot of what was deleted
        });
        undoManager.showSuccess("Reservering verwijderd (in prullenbak).");
        setSelectedReservation(null);
        setShowDeleteModal(false);
        refresh();
    }
  };
  
  const handleRegisterPayment = () => {
    if (!selectedReservation) return;
    
    const newPayment: PaymentRecord = {
        id: `PAY-${Date.now()}`,
        amount: paymentAmount,
        method: paymentMethod,
        date: new Date().toISOString(),
        type: paymentType
    };

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
    
    logAuditAction('REGISTER_PAYMENT', 'RESERVATION', selectedReservation.id, { 
      description: `Payment of €${paymentAmount} registered`,
      before: selectedReservation,
      after: updatedRes
    });
    
    undoManager.showSuccess('Betaling geregistreerd.');
    setShowPaymentModal(false);
    setSelectedReservation(updatedRes); 
    refresh();
  };
  
  const handleCreateInvoice = () => {
    if (!selectedReservation) return;
    // Check if exists
    const existing = invoiceRepo.getAll().find(i => i.reservationId === selectedReservation.id);
    if (existing) {
        if (!confirm("Er bestaat al een factuur voor deze reservering. Wil je een nieuwe aanmaken?")) return;
    }

    const newInvoice = createInvoiceFromReservation(selectedReservation);
    invoiceRepo.add(newInvoice);
    logAuditAction('CREATE_INVOICE', 'SYSTEM', newInvoice.id, { description: `Created for res ${selectedReservation.id}` });
    undoManager.showSuccess("Factuur aangemaakt");
    
    // Refresh local invoices list immediately
    setInvoices(invoiceRepo.getAll());
  };

  const handlePriceOverrideSave = (override: any, sendEmail: boolean) => {
    if (!selectedReservation) return;

    // Apply Override to object
    const updatedRes = { ...selectedReservation, adminPriceOverride: override };
    // Recalculate totals with new override
    const newFinancials = recalculateReservationFinancials(updatedRes);
    
    const finalUpdate = {
        ...updatedRes,
        adminPriceOverride: override,
        financials: newFinancials
    };

    bookingRepo.update(selectedReservation.id, () => finalUpdate);

    logAuditAction('PRICE_OVERRIDE', 'RESERVATION', selectedReservation.id, { 
        description: 'Price manually overridden',
        before: selectedReservation,
        after: finalUpdate
    });

    if (sendEmail) {
        triggerEmail('BOOKING_CONFIRMED', { type: 'RESERVATION', id: selectedReservation.id, data: { ...updatedRes, financials: newFinancials } });
    }

    undoManager.showSuccess("Prijsaanpassing opgeslagen.");
    setIsPriceEditing(false);
    
    // Refresh local selected item
    const fresh = bookingRepo.getById(selectedReservation.id);
    if(fresh) setSelectedReservation(fresh);
    refresh();
  };

  // --- FILTER LOGIC ---
  
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
        if (a.status === 'REQUEST' && b.status !== 'REQUEST') return -1;
        if (b.status === 'REQUEST' && a.status !== 'REQUEST') return 1;
        if (a.date !== b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reservations, filterMode, selectedDate, searchTerm]);

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
    
    if (action === 'CANCEL') {
        setItemToCancel(null); 
        setShowCancelModal(true);
        return;
    }

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
        let createdCount = 0;
        let skippedCount = 0;
        const currentInvoices = invoiceRepo.getAll();
        const existingMap = new Set(currentInvoices.map(i => i.reservationId));
        const newInvoices: Invoice[] = [];

        selectedIds.forEach(id => {
            const res = bookingRepo.getById(id);
            if (res) {
                if (existingMap.has(id)) {
                    skippedCount++;
                } else {
                    const inv = createInvoiceFromReservation(res, [...currentInvoices, ...newInvoices]);
                    newInvoices.push(inv);
                    createdCount++;
                }
            }
        });
        
        if (newInvoices.length > 0) {
            invoiceRepo.saveAll([...currentInvoices, ...newInvoices]);
        }
        
        setInvoices(invoiceRepo.getAll());
        undoManager.showSuccess(`${createdCount} facturen aangemaakt. ${skippedCount} overgeslagen (bestond al).`);
    } else {
        selectedIds.forEach(id => {
            bookingRepo.update(id, r => ({ ...r, status: BookingStatus.CONFIRMED }));
        });
    }

    if (action !== 'INVOICE') {
        logAuditAction('BULK_UPDATE', 'RESERVATION', 'MULTIPLE', { 
            description: `Bulk action ${action} on ${selectedIds.size} items.` 
        });
        undoManager.showSuccess(`${selectedIds.size} reserveringen bijgewerkt.`);
    }
    
    setIsProcessingBulk(false);
    setSelectedIds(new Set());
    refresh();
  };

  const executeCancellation = () => {
      const reason = cancelReasonSelect === 'Overig' ? cancelReasonText : cancelReasonSelect;
      if (!reason) {
          alert("Geef een reden op voor annulering.");
          return;
      }

      const idsToCancel = itemToCancel ? [itemToCancel] : Array.from(selectedIds);
      
      idsToCancel.forEach(id => {
          const original = bookingRepo.getById(id);
          if (!original) return;

          const updated = {
              ...original,
              status: BookingStatus.CANCELLED,
              cancellationReason: reason
          };

          bookingRepo.update(id, () => updated);
          
          triggerEmail('BOOKING_CANCELLED', { 
              type: 'RESERVATION', 
              id, 
              data: updated 
          });

          // Log detail
          logAuditAction('CANCEL_RESERVATION', 'RESERVATION', id, {
              description: `Cancelled with reason: ${reason}`,
              before: original,
              after: updated
          });
      });

      undoManager.showSuccess(`${idsToCancel.length} reservering(en) geannuleerd.`);
      
      setShowCancelModal(false);
      setCancelReasonText('');
      setCancelReasonSelect(CANCELLATION_REASONS[0]);
      setItemToCancel(null);
      setSelectedIds(new Set());
      refresh();
  };

  // --- CAPACITY BAR ---
  const capacityStats = useMemo(() => {
    let targetDate = filterMode === 'TODAY' ? new Date().toISOString().split('T')[0] : selectedDate;
    if (!targetDate) return null;

    const event = allEvents.find(e => e.date === targetDate && e.type === 'SHOW');
    const capacity = (event as any)?.capacity || 230;
    
    const dailyRes = reservations.filter(r => 
        r.date === targetDate && 
        ['CONFIRMED', 'ARRIVED', 'OPTION', 'INVITED'].includes(r.status)
    );
    const booked = dailyRes.reduce((s, r) => s + r.partySize, 0);
    const pending = reservations.filter(r => r.date === targetDate && r.status === 'REQUEST').reduce((s,r) => s + r.partySize, 0);

    return { date: targetDate, capacity, booked, pending, eventName: event?.title };
  }, [filterMode, selectedDate, reservations, allEvents]);

  // --- ACTIONS ---

  const handleLinkReservations = (targetId: string) => {
    if (!selectedReservation) return;
    
    const sourceLinks = selectedReservation.linkedBookingIds || [];
    if (!sourceLinks.includes(targetId)) {
        bookingRepo.update(selectedReservation.id, r => ({ ...r, linkedBookingIds: [...sourceLinks, targetId] }));
    }

    const targetRes = bookingRepo.getById(targetId);
    if (targetRes) {
        const targetLinks = targetRes.linkedBookingIds || [];
        if (!targetLinks.includes(selectedReservation.id)) {
            bookingRepo.update(targetId, r => ({ ...r, linkedBookingIds: [...targetLinks, selectedReservation.id] }));
        }
    }

    logAuditAction('LINK_RESERVATIONS', 'RESERVATION', selectedReservation.id, { description: `Linked with ${targetId}` });
    undoManager.showSuccess("Boekingen gekoppeld.");
    
    const updated = bookingRepo.getById(selectedReservation.id);
    if(updated) setSelectedReservation(updated);
    
    setShowLinkModal(false);
    refresh();
  };

  const handleUnlink = (targetId: string) => {
    if (!selectedReservation) return;

    bookingRepo.update(selectedReservation.id, r => ({ 
        ...r, 
        linkedBookingIds: r.linkedBookingIds?.filter(id => id !== targetId) 
    }));

    const targetRes = bookingRepo.getById(targetId);
    if (targetRes) {
        bookingRepo.update(targetId, r => ({ 
            ...r, 
            linkedBookingIds: r.linkedBookingIds?.filter(id => id !== selectedReservation.id) 
        }));
    }

    const updated = bookingRepo.getById(selectedReservation.id);
    if(updated) setSelectedReservation(updated);
    refresh();
  };

  const linkCandidates = useMemo(() => {
    if (!linkSearchTerm || !selectedReservation) return [];
    const q = linkSearchTerm.toLowerCase();
    return reservations.filter(r => 
        r.id !== selectedReservation.id && 
        r.date === selectedReservation.date && 
        (r.customer.lastName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [linkSearchTerm, reservations, selectedReservation]);

  const getTicketPrice = (r: Reservation) => {
    const ticketLine = r.financials.priceBreakdown?.find(i => i.category === 'TICKET');
    return ticketLine ? ticketLine.unitPrice : (r.financials.subtotal / (r.partySize || 1));
  };

  const getActionReason = (r: Reservation) => {
    if (r.status === 'REQUEST') return { label: 'Aanvraag Beoordelen', color: 'blue' };
    if (r.status === 'OPTION') {
       return { label: 'Optie Verloopt', color: 'amber' };
    }
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
                       className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500 w-4 h-4"
                       checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                       onChange={(e) => { e.stopPropagation(); toggleAll(); }}
                     />
                   </div>
                 ), 
                 accessor: r => (
                   <div onClick={e => e.stopPropagation()}>
                     <input 
                       type="checkbox" 
                       className="rounded bg-slate-900 border-slate-700 checked:bg-amber-500 w-4 h-4"
                       checked={selectedIds.has(r.id)}
                       onChange={(e) => { e.stopPropagation(); toggleSelection(r.id); }}
                     />
                   </div>
                 ),
                 className: 'w-12 text-center'
               },
               { header: 'Gast', accessor: r => <div className="font-bold text-white text-sm">{formatGuestName(r.customer.firstName, r.customer.lastName)} {r.customer.companyName && <span className="block text-[10px] text-blue-400 font-normal">{r.customer.companyName}</span>}</div> },
               { header: 'Datum', accessor: r => <span className="block font-bold text-slate-200 text-sm">{new Date(r.date).toLocaleDateString('nl-NL', {weekday:'short', day:'numeric', month:'short'})}</span> },
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
                   // NEW: Enhanced Status Display with Option Expiry
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
                 header: 'Totaal', 
                 accessor: r => {
                   const hasInvoice = invoices.some(i => i.reservationId === r.id);
                   return (
                     <div className="flex items-center space-x-2">
                       <span className="font-mono font-bold text-white">€{r.financials.finalTotal.toFixed(0)}</span>
                       {hasInvoice && <FileText size={12} className="text-slate-500" title="Factuur aanwezig" />}
                     </div>
                   );
                 }
               },
            ]}
         />
         <div className="bg-slate-950 p-2 text-[10px] text-center text-slate-500 border-t border-slate-800 uppercase font-bold tracking-widest">
            {filteredData.length} Reserveringen getoond
         </div>
      </div>

      {/* 4. DETAIL DRAWER (Updated) */}
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

               {/* Linked Reservations */}
               <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                     <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        <LinkIcon size={12} className="mr-2" /> Gekoppelde Groepen
                     </h3>
                     <Button variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setShowLinkModal(true)}>
                        <LinkIcon size={10} className="mr-1"/> Koppel
                     </Button>
                  </div>
                  
                  {selectedReservation.linkedBookingIds && selectedReservation.linkedBookingIds.length > 0 ? (
                     <div className="grid grid-cols-1 gap-2">
                        {selectedReservation.linkedBookingIds.map(linkId => {
                           const linkedRes = reservations.find(r => r.id === linkId);
                           if (!linkedRes) return null;
                           return (
                              <div key={linkId} className="flex justify-between items-center p-2 bg-slate-900 border border-slate-800 rounded-lg">
                                 <div className="flex items-center space-x-2 text-xs">
                                    <span className="font-bold text-white">{formatGuestName(linkedRes.customer.firstName, linkedRes.customer.lastName)}</span>
                                    <span className="text-slate-500">({linkedRes.partySize}p)</span>
                                 </div>
                                 <button onClick={() => handleUnlink(linkId)} className="text-slate-500 hover:text-red-500">
                                    <Unlink size={14} />
                                 </button>
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <p className="text-xs text-slate-600 italic">Geen gekoppelde reserveringen.</p>
                  )}
               </div>

               {/* Info Cards */}
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
                        <p className="text-xs text-slate-500 font-bold uppercase">Gezelschap</p>
                        <p className="text-xl font-serif text-white">{selectedReservation.partySize} Personen</p>
                     </div>
                  </div>

                  {/* Financials */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
                     <div className="flex justify-between items-end relative z-10">
                        <div>
                           <p className="text-xs text-slate-500 font-bold uppercase mb-1">Financieel</p>
                           <p className="text-3xl font-mono text-white">€{selectedReservation.financials.finalTotal.toFixed(2)}</p>
                           {selectedReservation.financials.isPaid ? 
                              <span className="text-emerald-500 text-xs font-bold flex items-center mt-1"><CheckCircle2 size={12} className="mr-1"/> Betaald</span> : 
                              <span className="text-red-500 text-xs font-bold flex items-center mt-1"><AlertCircle size={12} className="mr-1"/> Openstaand</span>
                           }
                        </div>
                        <Button variant="ghost" onClick={() => setIsPriceEditing(true)} className="text-xs">Aanpassen</Button>
                     </div>
                     
                     <div className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
                        <Button onClick={() => setShowPaymentModal(true)} className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                            Betaal
                        </Button>
                        {linkedInvoice ? (
                            <Button onClick={() => printInvoice(linkedInvoice)} variant="secondary" className="flex-1 h-8 text-xs">
                                <Printer size={12} className="mr-2"/> Print Factuur
                            </Button>
                        ) : (
                            <Button onClick={handleCreateInvoice} variant="secondary" className="flex-1 h-8 text-xs">
                                <FileText size={12} className="mr-2"/> Maak Factuur
                            </Button>
                        )}
                     </div>
                  </div>
               </div>

               {/* Timeline */}
               <div className="pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Geschiedenis</h3>
                  <AuditTimeline entityId={selectedReservation.id} />
               </div>

            </div>
         )}
      </ResponsiveDrawer>

      {/* FLOATING BULK ACTION BAR */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl rounded-full px-6 py-3 z-50 flex items-center space-x-4 animate-in slide-in-from-bottom-10 fade-in">
           <div className="flex items-center space-x-2 border-r border-slate-700 pr-4">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">Geselecteerd</span>
           </div>
           
           <div className="flex items-center space-x-2">
              <button 
                onClick={() => handleBulkAction('CONFIRM')}
                disabled={isProcessingBulk}
                className="p-2 hover:bg-emerald-900/30 text-emerald-500 rounded-lg transition-colors" 
                title="Bevestig Selectie"
              >
                <CheckCircle2 size={20} />
              </button>
              
              <button 
                onClick={() => handleBulkAction('INVOICE')}
                disabled={isProcessingBulk}
                className="p-2 hover:bg-slate-800 text-white rounded-lg transition-colors" 
                title="Maak Facturen"
              >
                <FileText size={20} />
              </button>

              <button 
                onClick={() => handleBulkAction('CANCEL')}
                disabled={isProcessingBulk}
                className="p-2 hover:bg-orange-900/30 text-orange-500 rounded-lg transition-colors" 
                title="Annuleer Selectie"
              >
                <XCircle size={20} />
              </button>
              <button 
                onClick={() => handleBulkAction('DELETE')}
                disabled={isProcessingBulk}
                className="p-2 hover:bg-red-900/30 text-red-500 rounded-lg transition-colors" 
                title="Verwijder Selectie"
              >
                <Trash2 size={20} />
              </button>
              <button 
                onClick={() => handleBulkAction('EMAIL')}
                disabled={isProcessingBulk}
                className="p-2 hover:bg-blue-900/30 text-blue-500 rounded-lg transition-colors" 
                title="Stuur Email"
              >
                <Mail size={20} />
              </button>
           </div>

           <button onClick={() => setSelectedIds(new Set())} className="ml-2 text-slate-500 hover:text-white">
              <X size={16} />
           </button>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && selectedReservation && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
               <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-white font-bold">Koppel Reservering</h3>
                  <button onClick={() => setShowLinkModal(false)}><XCircle size={20} className="text-slate-500 hover:text-white"/></button>
               </div>
               <div className="p-4 space-y-4">
                  <Input 
                     placeholder="Zoek op naam of ID..." 
                     value={linkSearchTerm} 
                     onChange={(e: any) => setLinkSearchTerm(e.target.value)} 
                     autoFocus
                  />
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                     {linkCandidates.map(r => (
                        <div key={r.id} className="flex justify-between items-center p-2 hover:bg-slate-800 rounded cursor-pointer border border-transparent hover:border-slate-700" onClick={() => handleLinkReservations(r.id)}>
                           <div>
                              <p className="text-sm text-white font-bold">{formatGuestName(r.customer.firstName, r.customer.lastName)}</p>
                              <p className="text-xs text-slate-500">{r.id} • {r.partySize}p</p>
                           </div>
                           <Plus size={16} className="text-emerald-500" />
                        </div>
                     ))}
                     {linkCandidates.length === 0 && <p className="text-xs text-slate-500 text-center">Geen kandidaten gevonden.</p>}
                  </div>
               </div>
            </Card>
         </div>
      )}

      {/* CANCELLATION REASON MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <Card className="w-full max-w-md bg-slate-900 border-red-900/50 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-start space-x-4 bg-red-950/20">
                 <div className="p-3 bg-red-900/20 rounded-full text-red-500 shrink-0"><XCircle size={24}/></div>
                 <div>
                    <h3 className="text-xl font-bold text-white mb-1">Bevestig Annulering</h3>
                    <p className="text-sm text-slate-300">
                        Je staat op het punt om {itemToCancel ? 'een reservering' : `${selectedIds.size} reserveringen`} te annuleren. 
                        Een reden is verplicht.
                    </p>
                 </div>
              </div>
              
              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Reden</label>
                    <select 
                        className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500"
                        value={cancelReasonSelect}
                        onChange={(e) => setCancelReasonSelect(e.target.value)}
                    >
                        {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>
                 
                 {cancelReasonSelect === 'Overig' && (
                     <div className="animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Toelichting</label>
                        <textarea 
                            className="w-full bg-black/40 border border-slate-700 rounded-xl p-3 text-white text-sm focus:border-red-500 outline-none h-24 resize-none"
                            placeholder="Geef een reden..."
                            value={cancelReasonText}
                            onChange={(e) => setCancelReasonText(e.target.value)}
                            autoFocus
                        />
                     </div>
                 )}
                 
                 <div className="flex gap-3 pt-2">
                    <Button variant="ghost" onClick={() => { setShowCancelModal(false); setCancelReasonText(''); }} className="flex-1">Annuleren</Button>
                    <Button onClick={executeCancellation} className="flex-1 bg-red-600 hover:bg-red-700 text-white border-none shadow-lg">Bevestig Annulering</Button>
                 </div>
              </div>
           </Card>
        </div>
      )}

      {/* NEW: OPTION EXPIRY MODAL */}
      {showOptionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <Card className="w-full max-w-md bg-slate-900 border-amber-900/50 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-start space-x-4 bg-amber-950/20">
                 <div className="p-3 bg-amber-900/20 rounded-full text-amber-500 shrink-0"><Clock size={24}/></div>
                 <div>
                    <h3 className="text-xl font-bold text-white mb-1">Optie Instellen</h3>
                    <p className="text-sm text-slate-300">
                        Je zet deze reservering om naar een optie. Hoe lang moet deze geldig blijven?
                    </p>
                 </div>
              </div>
              
              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Geldigheidsduur</label>
                    <select 
                        className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                        value={optionDuration}
                        onChange={(e) => setOptionDuration(e.target.value)}
                    >
                        <option value="1WEEK">1 Week (Standaard)</option>
                        <option value="2WEEKS">2 Weken</option>
                        <option value="CUSTOM">Aangepaste Datum...</option>
                    </select>
                 </div>
                 
                 {optionDuration === 'CUSTOM' && (
                     <div className="animate-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Vervaldatum</label>
                        <input 
                            type="date"
                            className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-500"
                            value={optionCustomDate}
                            onChange={(e) => setOptionCustomDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                        />
                     </div>
                 )}
                 
                 <div className="flex gap-3 pt-4">
                    <Button variant="ghost" onClick={() => { setShowOptionModal(false); refresh(); }} className="flex-1">Annuleren</Button>
                    <Button onClick={confirmOptionStatus} className="flex-1 bg-amber-600 hover:bg-amber-700 text-black border-none shadow-lg">Bevestig Optie</Button>
                 </div>
              </div>
           </Card>
        </div>
      )}
      
      {/* Payment Registration Modal */}
      {showPaymentModal && selectedReservation && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl">
               <div className="p-6 border-b border-slate-800 bg-slate-950/50">
                  <h3 className="text-lg font-bold text-white mb-1">Betaling Registreren</h3>
                  <p className="text-xs text-slate-500">Voor {formatGuestName(selectedReservation.customer.firstName, selectedReservation.customer.lastName)}</p>
               </div>
               <div className="p-6 space-y-4">
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
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 block">Type Betaling</label>
                      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                          {['DEPOSIT', 'PARTIAL', 'FINAL'].map(type => (
                              <button
                                  key={type}
                                  onClick={() => setPaymentType(type as any)}
                                  className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors ${paymentType === type ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                              >
                                  {type === 'DEPOSIT' ? 'Aanbet.' : type === 'PARTIAL' ? 'Deel' : 'Restant'}
                              </button>
                          ))}
                      </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-slate-800">
                      <Button variant="ghost" onClick={() => setShowPaymentModal(false)} className="flex-1">Annuleren</Button>
                      <Button onClick={handleRegisterPayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-lg">Verwerken</Button>
                  </div>
               </div>
            </Card>
         </div>
      )}

      {/* Modals (Edit, Delete, Price) */}
      {showEditModal && selectedReservation && (
         <EditReservationModal 
            reservation={selectedReservation} 
            initialTab={editModalTab}
            onClose={() => { setShowEditModal(false); setEditModalTab(undefined); }} 
            onSave={() => { refresh(); setShowEditModal(false); setEditModalTab(undefined); }} 
         />
      )}

      {/* Price Override Modal */}
      {isPriceEditing && selectedReservation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <Card className="w-full max-w-lg bg-slate-950 border-slate-800 shadow-2xl">
              <div className="p-6">
                 <PriceOverridePanel 
                    reservation={selectedReservation}
                    onSave={handlePriceOverrideSave}
                    onCancel={() => setIsPriceEditing(false)}
                 />
              </div>
           </Card>
        </div>
      )}

      <DestructiveActionModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteReservation}
        title="Reservering Verwijderen"
        description={<p>Weet u zeker dat u deze reservering wilt verwijderen? Het item wordt verplaatst naar de prullenbak en kan binnen 30 dagen worden hersteld.</p>}
        verificationText="DELETE"
        confirmButtonText="Verwijderen"
      />
      
    </div>
  );
};
