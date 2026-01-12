
import React from 'react';
import { Gift, Sparkles, Star } from 'lucide-react';

interface VoucherCardPreviewProps {
  amount: number;
  recipientName: string;
  senderName: string;
  message: string;
  variant?: 'GOLD' | 'PLATINUM';
}

export const VoucherCardPreview: React.FC<VoucherCardPreviewProps> = ({ 
  amount, 
  recipientName, 
  senderName, 
  message,
  variant = 'GOLD'
}) => {
  return (
    <div className="relative group perspective-1000 w-full max-w-md mx-auto transform transition-transform hover:scale-105 duration-500">
      {/* Glow Effect behind the card */}
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
      
      {/* The Card Itself */}
      <div className="relative aspect-[1.586/1] rounded-xl overflow-hidden shadow-2xl bg-black border border-amber-900/50">
        
        {/* Background Texture & Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-950 z-0" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
        
        {/* Golden Accents / Shine Animation */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite] z-10 pointer-events-none" />
        
        {/* Decorative Circles */}
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full border border-amber-500/20 z-0" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full border border-amber-500/20 z-0" />

        {/* Content Layer */}
        <div className="relative z-20 h-full flex flex-col justify-between p-6 md:p-8">
          
          {/* Top Row: Brand */}
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-amber-500 rounded-md text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <Gift size={20} fill="currentColor" />
              </div>
              <div>
                <h3 className="text-white font-serif font-bold text-sm tracking-wider uppercase">Inspiration Point</h3>
                <p className="text-[8px] text-amber-500 uppercase tracking-[0.2em]">Dinner Theater</p>
              </div>
            </div>
            <Sparkles className="text-amber-500/50" size={24} />
          </div>

          {/* Middle: Amount */}
          <div className="text-center py-2">
            <p className="text-amber-500 text-xs uppercase tracking-widest font-bold mb-1">Waarde</p>
            <div className="text-5xl md:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-sm font-bold">
              €{amount.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
            </div>
          </div>

          {/* Bottom: Details */}
          <div className="space-y-4">
            {/* Message Preview (Truncated) */}
            {message && (
              <p className="text-[10px] text-slate-400 italic text-center px-4 line-clamp-2">
                "{message}"
              </p>
            )}

            <div className="flex justify-between items-end border-t border-white/10 pt-4">
              <div>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">Voor</p>
                <p className="text-sm font-bold text-white font-serif tracking-wide">
                  {recipientName || 'De Ontvanger'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-0.5">Van</p>
                <p className="text-sm font-bold text-white font-serif tracking-wide">
                  {senderName || 'De Afzender'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
