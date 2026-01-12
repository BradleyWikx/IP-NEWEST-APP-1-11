
import React, { useState } from 'react';
import { 
  Database, RefreshCw, Plus, ShieldCheck, 
  ChevronRight, Calendar, Ticket, UserCheck, 
  FileText, Play
} from 'lucide-react';
import { Button, Card } from '../UI';
import { Link } from 'react-router-dom';
import { 
  seedDemoData, resetDemoData, generateRandomBookings, 
  generateRandomWaitlist, generateRandomVouchers, runSmokeTest 
} from '../../utils/seed';

export const DemoControlPanel = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'IDLE' | 'PASS' | 'FAIL'>('IDLE');

  const handleAction = (action: () => void, label: string) => {
    if (confirm(`Bevestig actie: ${label}?`)) {
      action();
      window.location.reload(); // Refresh to reflect changes immediately
    }
  };

  const handleSeedData = () => {
    if (confirm("⚠️ LET OP: Alle bestaande data wordt gewist!\n\nEr wordt een demo-set geladen voor Januari & Februari 2026.")) {
        seedDemoData();
        // Force reload to ensure clean state
        window.location.reload();
    }
  };

  const handleSmokeTest = () => {
    setLogs(['Running diagnostics...']);
    setTimeout(() => {
      const result = runSmokeTest();
      setLogs(result.logs);
      setTestResult(result.passed ? 'PASS' : 'FAIL');
    }, 500);
  };

  return (
    <Card className="bg-slate-900 border border-slate-800 p-6 space-y-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2 bg-purple-900/20 rounded-lg text-purple-500 border border-purple-900/50">
          <Database size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Demo & Debug Panel</h3>
          <p className="text-xs text-slate-500">Admin-only tools voor testen en verificatie.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Actions */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Management</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={handleSeedData} className="text-xs bg-red-900/10 border-red-900/30 text-red-400 hover:bg-red-900/30 col-span-2">
              <RefreshCw size={14} className="mr-2"/> 🔄 Reset & Genereer Demo Data 2026
            </Button>
            
            <Button variant="ghost" onClick={() => handleAction(() => generateRandomBookings(20), '+20 Bookings')} className="text-xs border border-slate-800">
              <Plus size={14} className="mr-2"/> +20 Bookings
            </Button>
            <Button variant="ghost" onClick={() => handleAction(() => generateRandomWaitlist(10), '+10 Waitlist')} className="text-xs border border-slate-800">
              <Plus size={14} className="mr-2"/> +10 Waitlist
            </Button>
            <Button variant="ghost" onClick={() => handleAction(() => generateRandomVouchers(5), '+5 Vouchers')} className="text-xs border border-slate-800 md:col-span-2">
              <Plus size={14} className="mr-2"/> +5 Active Vouchers
            </Button>
          </div>
        </div>

        {/* Smoke Test */}
        <div className="space-y-3 flex flex-col">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Integrity</p>
          <div className="flex-grow bg-black rounded-xl border border-slate-800 p-4 font-mono text-[10px] overflow-y-auto max-h-40">
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">Ready to run diagnostics...</span>
            ) : (
              <ul className="space-y-1">
                {logs.map((log, i) => (
                  <li key={i} className={log.includes('❌') ? 'text-red-400' : 'text-emerald-400'}>{log}</li>
                ))}
              </ul>
            )}
          </div>
          <Button 
            onClick={handleSmokeTest} 
            className={`w-full flex items-center justify-center ${testResult === 'FAIL' ? 'bg-red-900/20 text-red-500 border-red-900' : 'bg-slate-800'}`}
          >
            <Play size={14} className="mr-2" /> Run Smoke Test
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Quick Navigation</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/calendar" className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-600 flex items-center">
            <Calendar size={14} className="mr-2" /> Calendar
          </Link>
          <Link to="/admin/reservations" className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-600 flex items-center">
            <Ticket size={14} className="mr-2" /> Reservations
          </Link>
          <Link to="/admin/reports" className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-600 flex items-center">
            <FileText size={14} className="mr-2" /> Reports
          </Link>
          <Link to="/admin/host" className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-600 flex items-center">
            <UserCheck size={14} className="mr-2" /> Host View
          </Link>
        </div>
      </div>
    </Card>
  );
};
