
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, Filter, Search, CheckCircle2, XCircle, 
  Phone, Mail, Clock, MessageSquare, ArrowUpRight, Calendar
} from 'lucide-react';
import { Button, Card, Badge } from '../UI';
import { tasksRepo, saveData, STORAGE_KEYS } from '../../utils/storage';
import { Task, TaskType } from '../../types';
import { ResponsiveTable } from '../ResponsiveTable';

export const TaskManager = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('OPEN');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setTasks(tasksRepo.getAll().sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()));
  };

  const handleMarkDone = (id: string) => {
    tasksRepo.markDone(id);
    refreshData();
  };

  const handleDelete = (id: string) => {
    if(confirm('Taak verwijderen?')) {
      tasksRepo.delete(id);
      refreshData();
    }
  };

  const navigateToEntity = (task: Task) => {
    if (task.entityType === 'RESERVATION') {
      navigate(`/admin/reservations?open=${task.entityId}`);
    } else if (task.entityType === 'CHANGE_REQUEST') {
      navigate('/admin/inbox');
    } else if (task.entityType === 'WAITLIST') {
      navigate('/admin/waitlist');
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesType = filterType === 'ALL' || t.type === filterType;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const getTypeIcon = (type: TaskType) => {
    switch (type) {
      case 'CALL_OPTION_EXPIRING': return <Phone size={16} className="text-amber-500" />;
      case 'SEND_PAYMENT_REMINDER': return <Mail size={16} className="text-red-500" />;
      case 'CHANGE_REQUEST_FOLLOW_UP': return <MessageSquare size={16} className="text-blue-500" />;
      default: return <Clock size={16} className="text-slate-500" />;
    }
  };

  const getTypeLabel = (type: TaskType) => {
    switch (type) {
      case 'CALL_OPTION_EXPIRING': return 'Belactie Optie';
      case 'SEND_PAYMENT_REMINDER': return 'Betaalherinnering';
      case 'CHANGE_REQUEST_FOLLOW_UP': return 'Wijziging Opvolgen';
      case 'CONFIRM_WAITLIST': return 'Wachtlijst';
      case 'GENERAL_FOLLOW_UP': return 'Algemeen';
      default: return type;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-serif text-white">Takenlijst</h2>
          <p className="text-slate-500 text-sm">Beheer follow-ups en actiepunten.</p>
        </div>
      </div>

      <Card className="p-4 bg-slate-900/50 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            placeholder="Zoek in taken..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto">
          <select 
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="OPEN">Open</option>
            <option value="DONE">Afgerond</option>
            <option value="ALL">Alles</option>
          </select>

          <select 
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="ALL">Alle Types</option>
            <option value="CALL_OPTION_EXPIRING">Belacties</option>
            <option value="SEND_PAYMENT_REMINDER">Betalingen</option>
            <option value="CHANGE_REQUEST_FOLLOW_UP">Wijzigingen</option>
            <option value="GENERAL_FOLLOW_UP">Algemeen</option>
          </select>
        </div>
      </Card>

      <div className="flex-grow">
        <ResponsiveTable 
          data={filteredTasks}
          keyExtractor={t => t.id}
          columns={[
            { header: 'Type', accessor: t => (
              <div className="flex items-center space-x-2">
                {getTypeIcon(t.type)}
                <span className="font-bold text-slate-300">{getTypeLabel(t.type)}</span>
              </div>
            )},
            { header: 'Taak', accessor: t => (
              <div>
                <p className="text-white font-bold text-sm">{t.title}</p>
                <p className="text-xs text-slate-500 truncate max-w-xs">{t.notes}</p>
              </div>
            )},
            { header: 'Deadline', accessor: t => {
               const due = new Date(t.dueAt);
               const isOverdue = t.status === 'OPEN' && due < new Date();
               return (
                 <span className={`font-mono text-xs ${isOverdue ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                   {due.toLocaleDateString()}
                 </span>
               );
            }},
            { header: 'Status', accessor: t => <Badge status={t.status === 'OPEN' ? 'REQUEST' : 'CONFIRMED'}>{t.status}</Badge> },
            { header: 'Acties', accessor: t => (
              <div className="flex items-center space-x-2 justify-end">
                <Button variant="ghost" onClick={() => navigateToEntity(t)} className="h-8 px-2 text-xs text-slate-400 hover:text-white" title="Ga naar item">
                  <ArrowUpRight size={14} />
                </Button>
                {t.status === 'OPEN' && (
                  <Button variant="secondary" onClick={() => handleMarkDone(t.id)} className="h-8 px-2 text-xs text-emerald-500 border-emerald-900/50 hover:bg-emerald-900/20" title="Afronden">
                    <CheckCircle2 size={14} className="mr-1" /> Klaar
                  </Button>
                )}
                <Button variant="ghost" onClick={() => handleDelete(t.id)} className="h-8 w-8 p-0 text-slate-600 hover:text-red-500">
                  <XCircle size={14} />
                </Button>
              </div>
            )}
          ]}
        />
      </div>
    </div>
  );
};
