
import React, { useState } from 'react';
import { Code, Copy, Check, ExternalLink, Smartphone, Monitor, Info } from 'lucide-react';
import { Card, Button } from '../UI';
import { IFRAME_SNIPPET, PARENT_LISTENER_SNIPPET } from '../../hooks/useIframeResizer';

export const EmbedManager = () => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  
  const appOrigin = window.location.origin + window.location.pathname;

  const copyToClipboard = (text: string, type: 'snippet' | 'script') => {
    navigator.clipboard.writeText(text);
    if (type === 'snippet') {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h2 className="text-3xl font-serif text-white">Embed Center</h2>
        <p className="text-slate-500 text-sm">Integreer het reserveringssysteem naadloos in uw eigen website.</p>
      </div>

      <Card className="p-8 bg-slate-900/50 border-slate-800">
        <div className="flex items-start space-x-6">
          <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500">
            <Info size={32} />
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Hoe werkt het?</h3>
            <p className="text-slate-400 leading-relaxed">
              Ons systeem is geoptimaliseerd voor embedding via een <strong>iframe</strong>. 
              Dankzij de ingebouwde auto-resize functionaliteit past de hoogte van de iframe zich automatisch aan 
              de inhoud aan, zodat er geen dubbele scrollbars ontstaan.
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">1</div>
          <h3 className="text-lg font-bold text-white">Plaats de Iframe</h3>
        </div>
        <p className="text-sm text-slate-500">Kopieer deze code en plaats deze op de pagina waar de reserveringstool moet verschijnen.</p>
        <div className="relative group">
          <pre className="p-6 bg-black rounded-2xl border border-slate-800 text-amber-500 font-mono text-xs overflow-x-auto">
            {IFRAME_SNIPPET(appOrigin)}
          </pre>
          <button 
            onClick={() => copyToClipboard(IFRAME_SNIPPET(appOrigin), 'snippet')}
            className="absolute top-4 right-4 p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-all text-slate-300"
          >
            {copiedSnippet ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">2</div>
          <h3 className="text-lg font-bold text-white">Auto-Height Script</h3>
        </div>
        <p className="text-sm text-slate-500">Voeg dit script toe aan de <code>&lt;head&gt;</code> of onderaan de <code>&lt;body&gt;</code> van uw website om de automatische hoogteverstelling te activeren.</p>
        <div className="relative group">
          <pre className="p-6 bg-black rounded-2xl border border-slate-800 text-blue-400 font-mono text-xs overflow-x-auto">
            {PARENT_LISTENER_SNIPPET.trim()}
          </pre>
          <button 
            onClick={() => copyToClipboard(PARENT_LISTENER_SNIPPET.trim(), 'script')}
            className="absolute top-4 right-4 p-2 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-all text-slate-300"
          >
            {copiedScript ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-slate-900/30 border-slate-800 flex items-center space-x-4">
          <Monitor className="text-slate-500" size={24} />
          <div>
            <h4 className="text-white font-bold text-sm">Responsive Design</h4>
            <p className="text-xs text-slate-500">De widget past zich automatisch aan desktop breedtes aan.</p>
          </div>
        </Card>
        <Card className="p-6 bg-slate-900/30 border-slate-800 flex items-center space-x-4">
          <Smartphone className="text-slate-500" size={24} />
          <div>
            <h4 className="text-white font-bold text-sm">Mobile First</h4>
            <p className="text-xs text-slate-500">Touch-geoptimaliseerde interface voor mobiele embeds.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
