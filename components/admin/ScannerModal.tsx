
import React, { useState, useEffect } from 'react';
import { X, Scan, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { Card, Button, Input } from '../UI';
import { bookingRepo } from '../../utils/storage';
import { Reservation, BookingStatus } from '../../types';

interface ScannerModalProps {
  onClose: () => void;
  onCheckIn: (reservation: Reservation) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ onClose, onCheckIn }) => {
  const [scanValue, setScanValue] = useState('');
  const [result, setResult] = useState<{ status: 'SUCCESS' | 'WARNING' | 'ERROR', message: string, reservation?: Reservation } | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  // In a real app, integrate `react-qr-reader` or `html5-qrcode` here.
  // <QrReader onResult={(res) => handleScan(res.getText())} />

  const handleScan = (code: string) => {
    // Lookup Logic
    const reservation = bookingRepo.getById(code.trim());
    
    if (!reservation) {
      setResult({ status: 'ERROR', message: `Reservering '${code}' niet gevonden.` });
      return;
    }

    // Check Status
    if (reservation.status === BookingStatus.CANCELLED || reservation.status === BookingStatus.NOSHOW) {
      setResult({ status: 'ERROR', message: 'Deze reservering is geannuleerd/ongeldig.', reservation });
    } else {
       // In a real system we'd check an `arrivedAt` timestamp to see if already checked in.
       setResult({ status: 'SUCCESS', message: 'Geldig Ticket!', reservation });
    }
    
    setIsScanning(false);
  };

  const confirmCheckIn = () => {
    if (result?.reservation) {
      onCheckIn(result.reservation);
      // Reset for next scan
      setScanValue('');
      setResult(null);
      setIsScanning(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <Card className="w-full max-w-md bg-slate-950 border-slate-800 shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10">
          <X size={24} />
        </button>

        <div className="p-6 text-center">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center justify-center">
            <Scan size={24} className="mr-2 text-amber-500" /> Ticket Scanner
          </h3>

          {/* Simulated Camera View */}
          {isScanning ? (
            <div className="aspect-square bg-black rounded-2xl border-2 border-slate-800 relative mb-6 overflow-hidden group">
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-64 h-64 border-2 border-amber-500/50 rounded-lg animate-pulse relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-500 -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-500 -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-500 -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-500 -mb-1 -mr-1"></div>
                 </div>
               </div>
               <p className="absolute bottom-4 left-0 w-full text-center text-xs text-slate-500">Camera simulatie...</p>
               
               {/* Hidden in real app, useful for demo */}
               <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white mb-4 font-bold">Simuleer Scan</p>
                  <Input 
                    placeholder="Scan / Type Code" 
                    value={scanValue} 
                    onChange={(e: any) => setScanValue(e.target.value)}
                    autoFocus
                  />
                  <Button onClick={() => handleScan(scanValue)} className="mt-2 w-full">Check</Button>
               </div>
            </div>
          ) : (
            // Result View
            <div className={`aspect-square rounded-2xl border-2 mb-6 flex flex-col items-center justify-center p-6 ${
                result?.status === 'SUCCESS' ? 'bg-emerald-900/20 border-emerald-500' : 
                result?.status === 'WARNING' ? 'bg-orange-900/20 border-orange-500' : 'bg-red-900/20 border-red-500'
            }`}>
                {result?.status === 'SUCCESS' && <CheckCircle2 size={64} className="text-emerald-500 mb-4" />}
                {result?.status === 'ERROR' && <X size={64} className="text-red-500 mb-4" />}
                {result?.status === 'WARNING' && <AlertCircle size={64} className="text-orange-500 mb-4" />}
                
                <h4 className="text-xl font-bold text-white mb-2">{result?.message}</h4>
                {result?.reservation && (
                  <div className="text-sm text-slate-300">
                    <p className="font-bold">{result.reservation.customer.firstName} {result.reservation.customer.lastName}</p>
                    <p>{result.reservation.partySize} Personen</p>
                  </div>
                )}
            </div>
          )}

          <div className="flex gap-3">
             {result ? (
               <>
                 <Button variant="secondary" onClick={() => { setIsScanning(true); setResult(null); setScanValue(''); }} className="flex-1">Nieuwe Scan</Button>
                 {result.status === 'SUCCESS' && <Button onClick={confirmCheckIn} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Inchecken</Button>}
               </>
             ) : (
               <p className="text-xs text-slate-500">Richt camera op QR code of voer code handmatig in.</p>
             )}
          </div>
        </div>
      </Card>
    </div>
  );
};
