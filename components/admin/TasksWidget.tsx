
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, ArrowRight, Phone, Mail, Clock, AlertCircle } from 'lucide-react';
import { Card } from '../UI';
import { tasksRepo } from '../../utils/storage';
import { Task } from '../../types';

export const TasksWidget = () => {
  const [openTasks, setOpenTasks] = useState<Task[]>([]);

  useEffect(() => {
    const load = () => {
      setOpenTasks(tasksRepo.getAll().filter(t => t.status === 'OPEN'));
    };
    load();
    window.addEventListener('storage-update', load);
    return () => window.removeEventListener('storage-update', load);
  }, []);

  const counts = {
    total: openTasks.length,
    call: openTasks.filter(t => t.type === 'CALL_OPTION_EXPIRING').length,
    pay: openTasks.filter(t => t.type === 'SEND_PAYMENT_REMINDER').length,
    other: openTasks.filter(t => !['CALL_OPTION_EXPIRING', 'SEND_PAYMENT_REMINDER'].includes(t.type)).length
  };

  return (
    <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center">
            <CheckSquare size={16} className="mr-2 text-blue-500"/> Open Taken
          </h3>
          <span className="text-2xl font-serif text-white">{counts.total}</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm p-2 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center text-slate-400">
              <Phone size={14} className="mr-2 text-amber-500" /> Optie Belacties
            </div>
            <span className="font-bold text-white">{counts.call}</span>
          </div>
          <div className="flex justify-between items-center text-sm p-2 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center text-slate-400">
              <Mail size={14} className="mr-2 text-red-500" /> Betaalherinnering
            </div>
            <span className="font-bold text-white">{counts.pay}</span>
          </div>
          <div className="flex justify-between items-center text-sm p-2 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex items-center text-slate-400">
              <Clock size={14} className="mr-2 text-slate-500" /> Overig
            </div>
            <span className="font-bold text-white">{counts.other}</span>
          </div>
        </div>
      </div>

      <Link to="/admin/tasks" className="mt-6 flex items-center justify-center w-full py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
        Naar Takenlijst <ArrowRight size={14} className="ml-2" />
      </Link>
    </Card>
  );
};
