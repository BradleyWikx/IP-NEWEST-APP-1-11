
import React, { useState, useEffect, useRef } from 'react';
import { X, Scan, CheckCircle2, AlertCircle, Search, Camera, Wallet, Ticket } from 'lucide-react';
import { Card, Button, Input } from '../UI';
import { bookingRepo, voucherRepo } from '../../utils/storage';
import { Reservation, BookingStatus, Voucher } from '../../types';
import { Html5QrcodeScanner, Html5QrcodeScannerState } from 'html5-qrcode';

interface ScannerModalProps {
  onClose: () => void;
  onCheckIn: (reservation: Reservation) => void;
}

type ScanResult = 
  | { type: 'RESERVATION', data: Reservation, status: 'SUCCESS' | 'WARNING' | 'ERROR', message: string }
  | { type: 'VOUCHER', data: Voucher, status: 'SUCCESS' | 'ERROR', message: string }
  | { type: 'ERROR', status: 'ERROR', message: string };

export const ScannerModal: React.FC<ScannerModalProps> = ({ onClose, onCheckIn }) => {
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isScanning && !scannerRef.current) {
        // Initialize Scanner
        // Need a small timeout to ensure DOM is ready
        const timer = setTimeout(() => {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );
            
            scanner.render(onScanSuccess, onScanFailure);
            scannerRef.current = scanner;
        }, 100);
        return () => clearTimeout(timer);
    }

    return () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
            scannerRef.current = null;
        }
    };
  }, [isScanning]);

  const processCode = (code: string) => {
    const cleanCode = code.trim();
    
    // 1. Check Reservation
    const reservation = bookingRepo.getById(cleanCode);
    if (reservation) {
        if (reservation.status === BookingStatus.CANCELLED || reservation.status === BookingStatus.NOSHOW) {
            setResult({ type: 'RESERVATION', data: reservation, status: 'ERROR', message: 'Geannuleerde reservering' });
        } else if (reservation.status === BookingStatus.ARRIVED) {
            setResult({ type: 'RESERVATION', data: reservation, status: 'WARNING', message: 'Reeds ingecheckt' });
        } else {
            setResult({ type: 'RESERVATION', data: reservation, status: 'SUCCESS', message: 'Geldig Ticket' });
        }
        setIsScanning(false);
        return;
    }

    // 2. Check Voucher
    const vouchers = voucherRepo.getAll();
    const voucher = vouchers.find(v => v.code.toUpperCase() === cleanCode.toUpperCase());
    if (voucher) {
        if (!voucher.isActive || voucher.currentBalance <= 0) {
            setResult({ type: 'VOUCHER', data: voucher, status: 'ERROR', message: 'Voucher ongeldig of leeg' });
        } else {
            setResult({ type: 'VOUCHER', data: voucher, status: 'SUCCESS', message: 'Geldige Voucher' });
        }
        setIsScanning(false);
        return;
    }

    // 3. Not found
    setResult({ type: 'ERROR', status: 'ERROR', message: `Code '${cleanCode}' onbekend.` });
    setIsScanning(false);
  };

  const onScanSuccess = (decodedText: string, decodedResult: any) => {
      // Stop scanning on success to show result
      if (scannerRef.current) {
          scannerRef.current.clear().then(() => {
              scannerRef.current = null;
              processCode(decodedText);
          }).catch(console.error);
      }
  };

  const onScanFailure = (error: any) => {
      // console.warn(`Code scan error = ${error}`);
  };

  const handleManualSubmit = () => {
      if (manualCode) processCode(manualCode);
  };

  const resetScan = () => {
      setResult(null);
      setManualCode('');
      setIsScanning(true);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <Card className="w-full max-w-md bg-slate-950 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10 p-2 bg-slate-900/50 rounded-full">
          <X size={20} />
        </button>

        <div className="p-6 text-center overflow-y-auto">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center justify-center">
            <Scan size={24} className="mr-2 text-amber-500" /> Scanner
          </h3>

          {/* Camera Container */}
          {isScanning && (
            <div className="mb-6 rounded-2xl overflow-hidden bg-black border-2 border-slate-800 relative min-h-[300px]">
               <div id="reader" className="w-full h-full"></div>
               {/* Overlay styling for html5-qrcode happens via CSS usually, but we keep it simple here */}
            </div>
          )}

          {/* Result View */}
          {!isScanning && result && (
            <div className={`rounded-2xl border-2 mb-6 p-6 animate-in zoom-in-95 duration-200 ${
                result.status === 'SUCCESS' ? 'bg-emerald-900/20 border-emerald-500' : 
                result.status === 'WARNING' ? 'bg-orange-900/20 border-orange-500' : 'bg-red-900/20 border-red-500'
            }`}>
                {result.status === 'SUCCESS' && <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />}
                {result.status === 'ERROR' && <X size={48} className="text-red-500 mx-auto mb-4" />}
                {result.status === 'WARNING' && <AlertCircle size={48} className="text-orange-500 mx-auto mb-4" />}
                
                <h4 className="text-xl font-bold text-white mb-2">{result.message}</h4>
                
                {result.type === 'RESERVATION' && (
                  <div className="text-sm text-slate-300 space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-blue-400 font-bold uppercase tracking-wider text-xs mb-2">
                        <Ticket size={14} /> <span>Reservering</span>
                    </div>
                    <p className="font-bold text-lg text-white">{result.data.customer.firstName} {result.data.customer.lastName}</p>
                    <p>{result.data.partySize} Personen • {result.data.tableId ? result.data.tableId.replace('TAB-', 'Tafel ') : 'Geen tafel'}</p>
                    <p className="text-slate-500 text-xs mt-2">{result.data.id}</p>
                  </div>
                )}

                {result.type === 'VOUCHER' && (
                  <div className="text-sm text-slate-300 space-y-1">
                    <div className="flex items-center justify-center space-x-2 text-amber-400 font-bold uppercase tracking-wider text-xs mb-2">
                        <Wallet size={14} /> <span>Voucher</span>
                    </div>
                    <p className="font-serif text-2xl text-white font-bold">€{result.data.currentBalance.toFixed(2)}</p>
                    <p className="text-slate-400">van €{result.data.originalBalance.toFixed(2)}</p>
                    <p className="text-slate-500 text-xs mt-2">{result.data.code}</p>
                  </div>
                )}
            </div>
          )}

          {/* Manual Input */}
          {isScanning && (
             <div className="flex gap-2">
                <Input 
                    placeholder="Of typ code..." 
                    value={manualCode} 
                    onChange={(e: any) => setManualCode(e.target.value)}
                    onKeyDown={(e: any) => e.key === 'Enter' && handleManualSubmit()}
                    className="bg-slate-900 border-slate-700"
                />
                <Button onClick={handleManualSubmit} variant="secondary">Check</Button>
             </div>
          )}

          {/* Action Buttons */}
          {!isScanning && (
             <div className="flex gap-3">
               <Button variant="secondary" onClick={resetScan} className="flex-1">Nieuwe Scan</Button>
               {result?.type === 'RESERVATION' && result.status !== 'ERROR' && (
                   <Button onClick={() => onCheckIn(result.data)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                       Inchecken
                   </Button>
               )}
             </div>
          )}
        </div>
      </Card>
    </div>
  );
};
