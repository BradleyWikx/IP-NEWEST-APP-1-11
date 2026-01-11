
import React from 'react';
import { AlertCircle, Calendar, CheckCircle2, DollarSign } from 'lucide-react';
import { Card } from '../UI';
import { Reservation } from '../../types';
import { getPaymentStats } from '../../utils/paymentHelpers';

export const PaymentWidget = ({ reservations }: { reservations: Reservation[] }) => {
  const stats = getPaymentStats(reservations);

  return (
    <Card className="p-6 bg-slate-900 border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center">
          <DollarSign size={16} className="mr-2 text-emerald-500" />
          Betalingen
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Overdue */}
        <div className="p-3 rounded-xl bg-red-900/10 border border-red-900/30 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Overdue</span>
            <AlertCircle size={14} className="text-red-500" />
          </div>
          <div>
            <span className="text-2xl font-serif text-white">{stats.overdueCount}</span>
            <span className="text-xs text-red-400 block">€{stats.overdueAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Due Soon */}
        <div className="p-3 rounded-xl bg-orange-900/10 border border-orange-900/30 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Komende 7d</span>
            <Calendar size={14} className="text-orange-500" />
          </div>
          <div>
            <span className="text-2xl font-serif text-white">{stats.dueNext7DaysCount}</span>
            <span className="text-xs text-orange-400 block">€{stats.dueNext7DaysAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Paid Today */}
        <div className="p-3 rounded-xl bg-emerald-900/10 border border-emerald-900/30 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Vandaag</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div>
            <span className="text-2xl font-serif text-white">{stats.paidTodayCount}</span>
            <span className="text-xs text-emerald-400 block">€{stats.paidTodayAmount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
