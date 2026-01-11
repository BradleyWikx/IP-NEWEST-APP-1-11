
export const THEME = {
  colors: {
    primary: 'red-800', // Dieper rood
    primaryHover: 'red-900',
    background: 'black',
    surface: 'slate-950', // Iets donkerder dan 900 voor meer contrast met goud
    text: 'slate-200', // Iets zachter wit
    muted: 'slate-500',
    border: 'amber-900', // Gouden randen als basis
    accent: 'amber-400', // Helder goud voor highlights
    calendarBg: 'stone-950',
    calendarText: 'amber-100',
  },
  shows: {
    matinee: { bg: 'bg-emerald-950/50', text: 'text-emerald-400', border: 'border-emerald-800', label: 'Matinee' },
    weekday: { bg: 'bg-indigo-950/50', text: 'text-indigo-400', border: 'border-indigo-800', label: 'Evening' },
    weekend: { bg: 'bg-amber-950/50', text: 'text-amber-400', border: 'border-amber-800', label: 'Weekend Gala' },
    special: { bg: 'bg-red-950/50', text: 'text-red-400', border: 'border-red-800', label: 'Special Event' },
  },
  status: {
    REQUEST: 'bg-blue-900/30 text-blue-300 border-blue-800',
    OPTION: 'bg-amber-900/30 text-amber-300 border-amber-800',
    CONFIRMED: 'bg-emerald-900/30 text-emerald-300 border-emerald-800',
    WAITLIST: 'bg-slate-800 text-slate-400 border-slate-700',
    CANCELLED: 'bg-red-950/50 text-red-400 border-red-900',
    INVITED: 'bg-purple-900/30 text-purple-300 border-purple-800',
    ARCHIVED: 'bg-slate-900 text-slate-600 border-slate-800',
  }
};
