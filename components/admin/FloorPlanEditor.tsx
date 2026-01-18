
import React, { useState, useEffect, useRef } from 'react';
import { 
  Move, Plus, Trash2, Save, Users, ZoomIn, ZoomOut, RotateCcw, 
  MousePointer, Grid as GridIcon, Check, X
} from 'lucide-react';
import { Button, Card, Badge, Input } from '../UI';
import { Reservation, BookingStatus } from '../../types';
import { bookingRepo, saveData } from '../../utils/storage';
import { undoManager } from '../../utils/undoManager';

const FLOOR_PLAN_KEY = 'grand_stage_floor_plan';

interface Table {
  id: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  label: string;
  seats: number;
  shape: 'RECT' | 'CIRCLE';
  width: number; // Percentage for rect, or diameter for circle
  height: number;
  rotation: number;
}

interface FloorPlanEditorProps {
  mode: 'EDIT' | 'HOST';
  reservations?: Reservation[]; // For Host Mode
  onAssignTable?: (reservationId: string, tableId: string) => void;
  onTableClick?: (tableId: string, reservation?: Reservation) => void;
  onTableDrop?: (tableId: string, guestId: string) => void; // NEW: Handle Drop
}

export const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({ 
  mode, 
  reservations = [], 
  onAssignTable,
  onTableClick,
  onTableDrop
}) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- DATA LOADING ---
  useEffect(() => {
    const stored = localStorage.getItem(FLOOR_PLAN_KEY);
    if (stored) {
      setTables(JSON.parse(stored));
    } else {
      // Default Seed
      setTables([
        { id: 'T1', x: 20, y: 20, label: '1', seats: 4, shape: 'RECT', width: 8, height: 8, rotation: 0 },
        { id: 'T2', x: 35, y: 20, label: '2', seats: 4, shape: 'RECT', width: 8, height: 8, rotation: 0 },
        { id: 'T3', x: 50, y: 20, label: '3', seats: 6, shape: 'CIRCLE', width: 10, height: 10, rotation: 0 },
      ]);
    }
  }, []);

  const saveLayout = () => {
    localStorage.setItem(FLOOR_PLAN_KEY, JSON.stringify(tables));
    undoManager.showSuccess("Plattegrond opgeslagen.");
  };

  // --- EDIT MODE ACTIONS ---

  const addTable = () => {
    const newTable: Table = {
      id: `TAB-${Date.now()}`,
      x: 50, y: 50,
      label: `${tables.length + 1}`,
      seats: 4,
      shape: 'RECT',
      width: 8,
      height: 8,
      rotation: 0
    };
    setTables([...tables, newTable]);
    setSelectedTableId(newTable.id);
  };

  const updateTable = (id: string, updates: Partial<Table>) => {
    setTables(tables.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTable = () => {
    if (selectedTableId) {
      setTables(tables.filter(t => t.id !== selectedTableId));
      setSelectedTableId(null);
    }
  };

  // --- INTERACTION ---

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (mode === 'HOST') return;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    setSelectedTableId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = mode === 'HOST' ? 'copy' : 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTableId?: string) => {
    e.preventDefault();
    setIsDragging(false);

    // HOST MODE DROP (Guest on Table)
    if (mode === 'HOST') {
        const guestId = e.dataTransfer.getData('guestId');
        if (guestId && targetTableId && onTableDrop) {
            onTableDrop(targetTableId, guestId);
        }
        return;
    }

    // EDIT MODE DROP (Table positioning)
    const id = e.dataTransfer.getData('text/plain');
    const rect = canvasRef.current?.getBoundingClientRect();
    
    if (rect && id && !targetTableId) {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      updateTable(id, { x, y });
    }
  };

  // --- RENDER HELPERS ---

  const getTableColor = (tableId: string) => {
    if (mode === 'EDIT') return selectedTableId === tableId ? 'bg-amber-500 text-black border-amber-600' : 'bg-slate-800 text-white border-slate-600';
    
    // HOST MODE
    const res = reservations.find(r => r.tableId === tableId && r.status !== BookingStatus.CANCELLED);
    
    if (!res) return 'bg-slate-800/50 text-slate-500 border-slate-700 hover:bg-slate-700/80'; // Empty
    
    if (res.status === BookingStatus.ARRIVED) return 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
    if (res.status === BookingStatus.CONFIRMED) return 'bg-blue-600 text-white border-blue-500';
    
    return 'bg-slate-700 text-white';
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div className="flex items-center space-x-2">
           {mode === 'EDIT' ? (
             <>
                <Button variant="secondary" onClick={addTable} className="h-8 px-3 text-xs">
                  <Plus size={14} className="mr-1"/> Tafel
                </Button>
                <div className="h-6 w-px bg-slate-800 mx-2" />
                <Button onClick={saveLayout} className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 border-none">
                  <Save size={14} className="mr-1"/> Opslaan
                </Button>
             </>
           ) : (
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center">
                <Users size={14} className="mr-2"/> Zaaloverzicht
             </div>
           )}
        </div>
        <div className="flex items-center space-x-2">
           <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-white"><ZoomOut size={16}/></button>
           <span className="text-xs w-12 text-center text-slate-500">{(zoom * 100).toFixed(0)}%</span>
           <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-white"><ZoomIn size={16}/></button>
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden">
        
        {/* Canvas */}
        <div className="flex-grow relative overflow-auto bg-black/50 cursor-grab active:cursor-grabbing p-8 custom-scrollbar">
           <div 
             ref={canvasRef}
             className="relative bg-slate-900/20 border-2 border-dashed border-slate-800 mx-auto transition-transform origin-top-left"
             style={{ width: '800px', height: '600px', transform: `scale(${zoom})` }}
             onDragOver={handleDragOver}
             onDrop={handleDrop}
           >
              {/* Floor Textures / Grid */}
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

              {/* Tables */}
              {tables.map(table => {
                const res = reservations.find(r => r.tableId === table.id && r.status !== BookingStatus.CANCELLED);
                
                return (
                  <div
                    key={table.id}
                    draggable={mode === 'EDIT'}
                    onDragStart={(e) => handleDragStart(e, table.id)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (mode === 'HOST') e.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={(e) => handleDrop(e, table.id)}
                    onClick={() => {
                        setSelectedTableId(table.id);
                        if (onTableClick) onTableClick(table.id, res);
                    }}
                    className={`absolute flex flex-col items-center justify-center border-2 shadow-lg transition-all cursor-pointer select-none ${getTableColor(table.id)}`}
                    style={{
                      left: `${table.x}%`,
                      top: `${table.y}%`,
                      width: `${table.width}%`,
                      height: `${table.height}%`,
                      borderRadius: table.shape === 'CIRCLE' ? '50%' : '8px',
                      transform: `translate(-50%, -50%) rotate(${table.rotation}deg)`
                    }}
                  >
                    <span className="font-bold text-sm">{table.label}</span>
                    <span className="text-[9px] opacity-70 flex items-center mt-0.5">
                       {mode === 'HOST' && res ? (
                         <span className="font-mono truncate max-w-full px-1">{res.customer.lastName}</span>
                       ) : (
                         <><Users size={8} className="mr-0.5"/> {table.seats}</>
                       )}
                    </span>
                  </div>
                );
              })}
           </div>
        </div>

        {/* Sidebar Properties (Edit Mode) */}
        {mode === 'EDIT' && selectedTable && (
           <div className="w-64 bg-slate-900 border-l border-slate-800 p-4 space-y-4 overflow-y-auto">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Tafel Instellingen</h4>
              
              <div className="space-y-3">
                 <Input label="Label" value={selectedTable.label} onChange={(e: any) => updateTable(selectedTable.id, { label: e.target.value })} />
                 <div className="grid grid-cols-2 gap-2">
                    <Input label="Zitplaatsen" type="number" value={selectedTable.seats} onChange={(e: any) => updateTable(selectedTable.id, { seats: parseInt(e.target.value) })} />
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Vorm</label>
                       <select 
                         className="w-full h-9 bg-black border border-slate-700 rounded text-xs text-white"
                         value={selectedTable.shape}
                         onChange={(e) => updateTable(selectedTable.id, { shape: e.target.value as any })}
                       >
                         <option value="RECT">Vierkant</option>
                         <option value="CIRCLE">Rond</option>
                       </select>
                    </div>
                 </div>
                 
                 <div className="space-y-1 pt-2 border-t border-slate-800">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Afmetingen</label>
                    <div className="grid grid-cols-2 gap-2">
                       <Input type="number" value={selectedTable.width} onChange={(e: any) => updateTable(selectedTable.id, { width: parseInt(e.target.value) })} />
                       <Input type="number" value={selectedTable.height} onChange={(e: any) => updateTable(selectedTable.id, { height: parseInt(e.target.value) })} />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Rotatie</label>
                    <input 
                      type="range" min="0" max="360" 
                      value={selectedTable.rotation}
                      onChange={(e) => updateTable(selectedTable.id, { rotation: parseInt(e.target.value) })}
                      className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                 </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800">
                 <Button onClick={deleteTable} variant="ghost" className="w-full text-red-500 hover:bg-red-900/20 hover:text-red-400">
                    <Trash2 size={14} className="mr-2"/> Verwijderen
                 </Button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
