
import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, User, Clock, MessageSquare } from 'lucide-react';
import { Card, Input, Button } from '../UI';
import { notesRepo, saveData } from '../../utils/storage';
import { AdminNote } from '../../types';

export const AdminNotesWidget = () => {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotes();
    window.addEventListener('storage-update', loadNotes);
    return () => window.removeEventListener('storage-update', loadNotes);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes]);

  const loadNotes = () => {
    const all = notesRepo.getAll();
    // Sort by created ASC
    setNotes(all.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;

    const note: AdminNote = {
      id: `NOTE-${Date.now()}`,
      text: newNoteText,
      authorRole: 'ADMIN', // Hardcoded role for now, ideally props or context
      createdAt: new Date().toISOString()
    };

    notesRepo.add(note);
    setNewNoteText('');
  };

  const handleDelete = (id: string) => {
    if(confirm('Notitie verwijderen?')) {
      notesRepo.delete(id);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col h-[400px]">
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center">
          <MessageSquare size={16} className="mr-2 text-purple-500"/> Team Chat
        </h3>
        <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded-full">{notes.length} berichten</span>
      </div>

      <div ref={scrollRef} className="flex-grow overflow-y-auto space-y-3 pr-2 mb-4 custom-scrollbar">
        {notes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
            Geen berichten. Laat een notitie achter!
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="group relative bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
               <div className="flex justify-between items-start mb-1">
                 <div className="flex items-center space-x-2">
                   <div className="w-4 h-4 rounded-full bg-purple-900/50 text-[8px] flex items-center justify-center text-purple-300 font-bold border border-purple-800">
                     {note.authorRole.charAt(0)}
                   </div>
                   <span className="text-[10px] font-bold text-slate-400">{note.authorRole}</span>
                 </div>
                 <span className="text-[9px] text-slate-600 font-mono">
                   {new Date(note.createdAt).toLocaleDateString() === new Date().toLocaleDateString() 
                     ? new Date(note.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                     : new Date(note.createdAt).toLocaleDateString()
                   }
                 </span>
               </div>
               <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{note.text}</p>
               
               <button 
                 onClick={() => handleDelete(note.id)}
                 className="absolute top-2 right-2 p-1 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <Trash2 size={12} />
               </button>
            </div>
          ))
        )}
      </div>

      <div className="flex space-x-2">
        <input 
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          placeholder="Schrijf een bericht..."
          className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
        />
        <Button onClick={handleAddNote} disabled={!newNoteText} className="px-3 bg-purple-600 hover:bg-purple-700 h-auto">
          <Send size={14} />
        </Button>
      </div>
    </Card>
  );
};
