
import React, { useState } from 'react';
import { 
  Database, UploadCloud, Users, ArrowRight, ShieldCheck, 
  FileSpreadsheet, Ticket, FileDown, Download
} from 'lucide-react';
import { Card, Button } from '../UI';
import { ImportWizard } from './ImportWizard';
import { ImportSchemaField } from '../../utils/csvHelpers';
import { 
  customerRepo, bookingRepo, getEvents, showRepo, 
  saveData, STORAGE_KEYS 
} from '../../utils/storage';
import { logAuditAction } from '../../utils/auditLogger';
import { Customer, Reservation, BookingStatus, AdminPriceOverride, ShowEvent } from '../../types';
import { calculateBookingTotals, getEffectivePricing } from '../../utils/pricing';
import { generateTemplate } from '../../utils/templateGenerator';

export const DataImporter = () => {
  const [activeImport, setActiveImport] = useState<'CUSTOMERS' | 'RESERVATIONS' | null>(null);

  // --- SCHEMAS ---

  const CUSTOMER_SCHEMA: ImportSchemaField[] = [
    { key: 'salutation', label: 'Aanhef', required: false, type: 'string' },
    { key: 'firstName', label: 'Voornaam', required: false, type: 'string' },
    { key: 'lastName', label: 'Achternaam', required: false, type: 'string' },
    { key: 'email', label: 'Email', required: true, type: 'email' },
    { key: 'phone', label: 'Telefoon', required: false, type: 'string' },
    { key: 'companyName', label: 'Bedrijf', required: false, type: 'string' },
    { key: 'street', label: 'Straat', required: false, type: 'string' },
    { key: 'houseNumber', label: 'Huisnummer', required: false, type: 'string' },
    { key: 'zip', label: 'Postcode', required: false, type: 'string' },
    { key: 'city', label: 'Stad', required: false, type: 'string' },
    { key: 'externalId', label: 'Extern ID', required: false, type: 'string' }
  ];

  const RESERVATION_SCHEMA: ImportSchemaField[] = [
    { key: 'date', label: 'Datum (YYYY-MM-DD)', required: true, type: 'date' },
    { key: 'email', label: 'Email Klant', required: true, type: 'email' },
    { key: 'firstName', label: 'Voornaam (indien nieuw)', required: false, type: 'string' },
    { key: 'lastName', label: 'Achternaam (indien nieuw)', required: false, type: 'string' },
    { key: 'partySize', label: 'Aantal Personen', required: true, type: 'number' },
    { key: 'status', label: 'Status', required: false, type: 'select', options: ['REQUEST', 'OPTION', 'CONFIRMED', 'INVITED', 'CANCELLED'] },
    { key: 'package', label: 'Arrangement', required: false, type: 'select', options: ['standard', 'premium'] },
    { key: 'optionExpiresAt', label: 'Optie Verloopt (Datum)', required: false, type: 'date' },
    { key: 'totalOverride', label: 'Totaalprijs Override', required: false, type: 'number' },
    { key: 'isPaid', label: 'Betaald? (JA/NEE)', required: false, type: 'string' },
    { key: 'notes', label: 'Opmerkingen', required: false, type: 'string' }
  ];

  // --- HANDLERS ---

  const handleCustomerImport = async (data: any[]) => {
    const existingCustomers = customerRepo.getAll();
    const emailMap = new Map(existingCustomers.map(c => [c.email.toLowerCase(), c]));
    
    // Since we can't deep update the repo array easily in one go without replacing, we modify a clone
    const finalCustomers = [...existingCustomers];
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    data.forEach((row, idx) => {
      const email = row.email.toLowerCase().trim();
      const existing = emailMap.get(email);

      if (existing) {
        // UPDATE LOGIC: Only fill missing fields
        let hasChanges = false;
        
        const updateIfEmpty = (field: keyof Customer, val: string) => {
          if (!existing[field] && val) {
            (existing as any)[field] = val;
            hasChanges = true;
          }
        };

        updateIfEmpty('salutation', row.salutation);
        updateIfEmpty('firstName', row.firstName);
        updateIfEmpty('lastName', row.lastName);
        updateIfEmpty('phone', row.phone);
        updateIfEmpty('companyName', row.companyName);
        updateIfEmpty('street', row.street);
        updateIfEmpty('houseNumber', row.houseNumber);
        updateIfEmpty('zip', row.zip);
        updateIfEmpty('city', row.city);
        
        if (hasChanges) updated++;
        else skipped++;
      } else {
        // CREATE LOGIC
        const newCustomer: Customer = {
          id: `CUST-IMP-${Date.now()}-${idx}`,
          salutation: row.salutation || '',
          firstName: row.firstName || '',
          lastName: row.lastName || '',
          email: row.email,
          phone: row.phone || '',
          companyName: row.companyName || '',
          city: row.city || '',
          isBusiness: !!row.companyName,
          street: row.street || '',
          houseNumber: row.houseNumber || '',
          zip: row.zip || '',
          country: 'NL'
        };
        
        finalCustomers.push(newCustomer);
        emailMap.set(email, newCustomer); // Update map for subsequent rows
        created++;
      }
    });

    customerRepo.saveAll(finalCustomers);
    
    logAuditAction('BULK_IMPORT', 'CUSTOMER', 'MULTIPLE', {
      description: `Import Result: ${created} Created, ${updated} Updated, ${skipped} Skipped.`
    });

    return { created, updated, skipped };
  };

  const handleReservationImport = async (data: any[]) => {
    const events = getEvents(); // Returns ShowEvent[]
    const shows = showRepo.getAll();
    const customers = customerRepo.getAll();
    const emailMap = new Map(customers.map(c => [c.email.toLowerCase(), c]));
    
    // We need to potentially create customers on the fly
    const newCustomers: Customer[] = [];
    const newReservations: Reservation[] = [];
    
    let created = 0;
    let skipped = 0; // Errors are filtered before this handler in Wizard, but logical skips here

    // Helper to find or create customer
    const resolveCustomer = (row: any): Customer | null => {
      const email = row.email.toLowerCase().trim();
      if (emailMap.has(email)) return emailMap.get(email)!;
      
      // Check pending new customers in this batch
      const pending = newCustomers.find(c => c.email.toLowerCase() === email);
      if (pending) return pending;

      // Create new if needed (even with partial name info)
      const nc: Customer = {
        id: `CUST-IMP-${Date.now()}-${newCustomers.length}`,
        firstName: row.firstName || 'Gast',
        lastName: row.lastName || '',
        email: row.email,
        phone: '',
        street: '', houseNumber: '', zip: '', city: '', country: 'NL'
      };
      newCustomers.push(nc);
      return nc;
    };

    for (const [idx, row] of data.entries()) {
      // 1. Validate Event
      // Ensure date matches an existing SHOW event
      const rawEvent = events.find(e => e.date === row.date);
      
      if (!rawEvent) {
        console.warn(`Row ${idx}: No event found for date ${row.date}`);
        skipped++;
        continue;
      }

      // 2. Resolve Customer
      const customer = resolveCustomer(row);
      if (!customer) {
        console.warn(`Row ${idx}: Customer not found and insufficient data to create`);
        skipped++;
        continue;
      }

      // 3. Resolve Show Definition
      const show = shows.find(s => s.id === rawEvent.showId);
      if (!show) {
        skipped++;
        continue;
      }

      // 4. Construct Financials
      const pricing = getEffectivePricing(rawEvent, show);
      const packageType = row.package === 'premium' ? 'premium' : 'standard';
      
      // Admin Override Logic
      let adminOverride: AdminPriceOverride | undefined = undefined;
      
      if (row.totalOverride && !isNaN(parseFloat(row.totalOverride))) {
        adminOverride = {
          unitPrice: undefined, // We override total directly via discount usually, but here we might want a manual fix
          // The calculation engine supports 'adminOverride' which manipulates unit price or adds discount.
          // For simplicity in import, if totalOverride is set, we set a FIXED discount to reach that total? 
          // OR we set the 'unitPrice' to match. Let's use discount logic.
          discount: {
             type: 'FIXED',
             amount: 0, // Placeholder, see logic below
             label: 'Import Override'
          },
          reason: 'CSV Import Override',
          updatedAt: new Date().toISOString()
        };
      }

      // Calculate standard price first
      const totals = calculateBookingTotals({
        totalGuests: parseInt(row.partySize),
        packageType,
        addons: [], // Import doesn't support detailed addons yet
        merchandise: [],
        date: row.date,
        showId: rawEvent.showId
      }, pricing);

      // Apply Override Math
      if (row.totalOverride) {
        const target = parseFloat(row.totalOverride);
        const diff = totals.subtotal - target;
        if (diff > 0) {
           // Discount needed
           adminOverride = {
             discount: { type: 'FIXED', amount: diff, label: 'Import Prijsafspraak' },
             reason: 'Import Override',
             updatedAt: new Date().toISOString()
           };
        } else if (diff < 0) {
           // Surcharge needed - Engine doesn't support negative discount easily without hack.
           // Instead, let's override unit price per person
           adminOverride = {
             unitPrice: target / parseInt(row.partySize),
             reason: 'Import Override',
             updatedAt: new Date().toISOString()
           };
        }
      }

      // 5. Status Logic
      let status: BookingStatus = (row.status?.toUpperCase() as BookingStatus) || BookingStatus.REQUEST;
      
      // Rules
      if (status === BookingStatus.OPTION && !row.optionExpiresAt) {
        // Default expiry 7 days
        const d = new Date(); d.setDate(d.getDate() + 7);
        row.optionExpiresAt = d.toISOString();
      }
      if (status === BookingStatus.INVITED) {
        adminOverride = {
           discount: { type: 'FIXED', amount: totals.subtotal, label: 'Invited' },
           reason: 'Import Invited',
           updatedAt: new Date().toISOString()
        };
      }

      // 6. Final Object
      const isPaid = row.isPaid && ['JA', 'YES', 'TRUE', '1'].includes(row.isPaid.toString().toUpperCase());
      const paidAmount = isPaid ? (row.totalOverride ? parseFloat(row.totalOverride) : totals.amountDue) : 0;

      // Recalculate with override
      const finalTotals = calculateBookingTotals({
        totalGuests: parseInt(row.partySize),
        packageType,
        addons: [],
        merchandise: [],
        adminOverride
      }, pricing);

      const reservation: Reservation = {
        id: `RES-IMP-${Date.now()}-${idx}`,
        createdAt: new Date().toISOString(),
        customerId: customer.id,
        customer,
        date: row.date,
        showId: rawEvent.showId,
        status,
        partySize: parseInt(row.partySize),
        packageType,
        addons: [],
        merchandise: [],
        financials: {
          total: finalTotals.subtotal,
          subtotal: finalTotals.subtotal,
          discount: finalTotals.discountAmount,
          finalTotal: finalTotals.amountDue,
          paid: paidAmount,
          isPaid,
          paidAt: isPaid ? new Date().toISOString() : undefined,
          paymentMethod: isPaid ? 'IMPORT' : undefined,
          paymentDueAt: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
          priceBreakdown: finalTotals.items // Store breakdown
        },
        notes: {
          internal: `Imported via CSV. ${row.notes || ''}`
        },
        adminPriceOverride: adminOverride,
        optionExpiresAt: row.optionExpiresAt ? new Date(row.optionExpiresAt).toISOString() : undefined,
        startTime: rawEvent.times.start
      };

      newReservations.push(reservation);
      created++;
    }

    // Save New Data
    if (newCustomers.length > 0) {
      customerRepo.saveAll([...customers, ...newCustomers]);
    }
    
    const existingReservations = bookingRepo.getAll();
    bookingRepo.saveAll([...existingReservations, ...newReservations]);

    logAuditAction('BULK_IMPORT', 'RESERVATION', 'MULTIPLE', {
      description: `Imported ${created} reservations. Skipped ${skipped} due to missing data.`
    });

    return { created, updated: 0, skipped };
  };

  if (activeImport) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 animate-in fade-in">
        <ImportWizard 
          title={activeImport === 'CUSTOMERS' ? 'Klanten Importeren' : 'Reserveringen Importeren'}
          schema={activeImport === 'CUSTOMERS' ? CUSTOMER_SCHEMA : RESERVATION_SCHEMA}
          onImport={activeImport === 'CUSTOMERS' ? handleCustomerImport : handleReservationImport}
          onClose={() => setActiveImport(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-serif text-white">Data Import</h2>
          <p className="text-slate-500 text-sm">Upload bulk data via CSV bestanden.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Customer Import Card */}
        <Card className="p-8 bg-slate-900 border-slate-800 hover:border-blue-500 transition-all group cursor-default">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-blue-900/20 text-blue-500 rounded-xl group-hover:scale-110 transition-transform">
              <Users size={32} />
            </div>
            <div className="px-3 py-1 bg-slate-800 rounded-full text-[10px] uppercase font-bold text-slate-400">
              CSV Ready
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Klantenbestand</h3>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Importeer klantgegevens. Bestaande klanten (op basis van email) worden aangevuld, niet overschreven.
          </p>

          <div className="space-y-2 mb-6 text-xs text-slate-500 font-mono bg-black/30 p-3 rounded-lg border border-slate-800">
            <p>Vereist: Email</p>
            <p>Optioneel: Aanhef, Naam, Telefoon, Bedrijf, Adres</p>
          </div>

          <Button onClick={() => setActiveImport('CUSTOMERS')} className="w-full flex items-center justify-center">
            Start Import <ArrowRight size={16} className="ml-2" />
          </Button>
        </Card>

        {/* Reservation Import Card */}
        <Card className="p-8 bg-slate-900 border-slate-800 hover:border-emerald-500 transition-all group cursor-default">
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-emerald-900/20 text-emerald-500 rounded-xl group-hover:scale-110 transition-transform">
              <Ticket size={32} />
            </div>
            <div className="px-3 py-1 bg-emerald-900/20 text-emerald-500 rounded-full text-[10px] uppercase font-bold">
              Nu Beschikbaar
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Reserveringen</h3>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Importeer historische of toekomstige boekingen. Koppelt automatisch aan bestaande klanten en events.
          </p>

          <div className="space-y-2 mb-6 text-xs text-slate-500 font-mono bg-black/30 p-3 rounded-lg border border-slate-800">
            <p>Vereist: Datum, Email, Aantal</p>
            <p>Optioneel: Status, Override Prijs, Betaald</p>
          </div>

          <Button onClick={() => setActiveImport('RESERVATIONS')} className="w-full flex items-center justify-center bg-slate-800 hover:bg-emerald-600 text-white border-none">
            Start Import <ArrowRight size={16} className="ml-2" />
          </Button>
        </Card>

      </div>

      {/* Templates Section */}
      <Card className="p-6 bg-slate-900/50 border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center">
          <FileSpreadsheet size={16} className="mr-2 text-slate-400" /> 
          Templates & Voorbeelden
        </h3>
        <div className="flex flex-wrap gap-4">
          <Button variant="secondary" onClick={() => generateTemplate('CUSTOMER')} className="flex items-center text-xs h-10">
            <Download size={14} className="mr-2"/> Klanten Template
          </Button>
          <Button variant="secondary" onClick={() => generateTemplate('RESERVATION')} className="flex items-center text-xs h-10">
            <Download size={14} className="mr-2"/> Reserveringen Template
          </Button>
          <Button variant="secondary" onClick={() => generateTemplate('MERCHANDISE')} className="flex items-center text-xs h-10">
            <Download size={14} className="mr-2"/> Merchandise Template
          </Button>
        </div>
      </Card>

      <div className="p-6 bg-amber-900/10 border border-amber-900/30 rounded-xl flex items-start space-x-4">
        <ShieldCheck size={24} className="text-amber-500 shrink-0" />
        <div>
          <h4 className="text-amber-500 font-bold text-sm uppercase mb-1">Veiligheid & Validatie</h4>
          <p className="text-amber-200/70 text-xs leading-relaxed max-w-2xl">
            Alle imports worden lokaal verwerkt. E-mailadressen worden ontdubbeld. 
            Reserveringen worden alleen aangemaakt als de datum overeenkomt met een bestaand evenement in de agenda.
          </p>
        </div>
      </div>
    </div>
  );
};
