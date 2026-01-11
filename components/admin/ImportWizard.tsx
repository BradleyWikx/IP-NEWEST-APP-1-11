
import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, 
  X, Download, RefreshCw, ArrowRight 
} from 'lucide-react';
import { Button, Stepper } from '../UI';
import { 
  parseCSV, autoMapColumns, validateRow, generateErrorCSV, ImportSchemaField 
} from '../../utils/csvHelpers';
import { downloadCSV } from '../../utils/csvExport';

interface ImportWizardProps {
  title: string;
  schema: ImportSchemaField[];
  onImport: (data: any[]) => Promise<{ created: number; updated: number; skipped: number }>;
  onClose: () => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ title, schema, onImport, onClose }) => {
  const [step, setStep] = useState(0);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0 });
  
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ACTIONS ---

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, data } = parseCSV(text);
      setRawHeaders(headers);
      setRawRows(data);
      setColumnMapping(autoMapColumns(headers, schema));
      setStep(1);
    };
    reader.readAsText(file);
  };

  const runValidation = () => {
    const results = rawRows.map((row, index) => {
      const mappedData: Record<string, any> = {};
      Object.entries(columnMapping).forEach(([schemaKey, csvHeader]) => {
        const headerIndex = rawHeaders.indexOf(csvHeader);
        if (headerIndex >= 0) mappedData[schemaKey] = row[headerIndex];
      });

      const errors = validateRow(mappedData, schema);
      return { rowIndex: index, rawData: mappedData, errors, isValid: errors.length === 0 };
    });

    setValidationResults(results);
    setStats({
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length
    });
    setStep(2);
  };

  const executeImport = async () => {
    setIsProcessing(true);
    const validData = validationResults.filter(r => r.isValid).map(r => r.rawData);
    try {
      const result = await onImport(validData);
      setImportResult(result);
      setStep(3);
    } catch (e) {
      alert("Er ging iets mis tijdens het importeren.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadErrors = () => {
    const invalidRows = validationResults.filter(r => !r.isValid);
    downloadCSV('import_errors.csv', generateErrorCSV(invalidRows));
  };

  // --- RENDERERS ---

  const renderUpload = () => (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in">
      <input type="file" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} accept=".csv" className="hidden" />
      <div 
        className="w-full max-w-lg border-2 border-dashed border-slate-700 rounded-2xl bg-slate-900/50 p-12 text-center cursor-pointer hover:border-amber-500 transition-all group"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files?.[0] && processFile(e.dataTransfer.files[0]); }}
      >
        <Upload size={48} className="text-slate-500 group-hover:text-amber-500 mx-auto mb-4 transition-colors" />
        <h3 className="text-xl font-bold text-white mb-2">Upload CSV Bestand</h3>
        <p className="text-slate-500 text-sm">Sleep bestand hierheen of klik om te bladeren</p>
      </div>
      <Button variant="ghost" onClick={() => downloadCSV('template.csv', schema.map(f => f.label).join(','))} className="mt-6">
        <Download size={16} className="mr-2"/> Download Template
      </Button>
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between text-sm text-slate-400">
        <span>Systeem Veld</span>
        <span>CSV Kolom</span>
      </div>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
        {schema.map(field => (
          <div key={field.key} className="grid grid-cols-2 gap-4 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="font-bold text-white text-sm">{field.label} {field.required && <span className="text-red-500">*</span>}</span>
              <div className="text-[10px] text-slate-500 font-mono">{field.key}</div>
            </div>
            <select
              className="bg-black border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
              value={columnMapping[field.key] || ''}
              onChange={(e) => setColumnMapping({...columnMapping, [field.key]: e.target.value})}
            >
              <option value="">-- Negeer --</option>
              {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
        <Button variant="ghost" onClick={() => setStep(0)}>Terug</Button>
        <Button onClick={runValidation} disabled={schema.some(f => f.required && !columnMapping[f.key])}>Valideren</Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-center">
          <p className="text-xs font-bold text-slate-500 uppercase">Totaal</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 bg-emerald-900/20 rounded-xl border border-emerald-900/50 text-center">
          <p className="text-xs font-bold text-emerald-500 uppercase">Geldig</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.valid}</p>
        </div>
        <div className="p-4 bg-red-900/20 rounded-xl border border-red-900/50 text-center">
          <p className="text-xs font-bold text-red-500 uppercase">Ongeldig</p>
          <p className="text-2xl font-bold text-red-400">{stats.invalid}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h3 className="font-bold text-white text-sm">Preview Data</h3>
          {stats.invalid > 0 && <Button variant="ghost" onClick={downloadErrors} className="text-xs text-red-400 h-8"><Download size={14} className="mr-2"/> Foutenlijst</Button>}
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-950 text-slate-500 sticky top-0">
              <tr>
                <th className="p-3 w-8">#</th>
                <th className="p-3 w-8">St</th>
                {schema.map(f => <th key={f.key} className="p-3">{f.label}</th>)}
                <th className="p-3 text-red-400">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {validationResults.slice(0, 50).map((row, i) => (
                <tr key={i} className={row.isValid ? 'hover:bg-slate-800' : 'bg-red-900/10'}>
                  <td className="p-3 text-slate-500">{i + 1}</td>
                  <td className="p-3">{row.isValid ? <CheckCircle2 size={14} className="text-emerald-500"/> : <AlertTriangle size={14} className="text-red-500"/>}</td>
                  {schema.map(f => <td key={f.key} className="p-3 text-slate-300 max-w-[150px] truncate">{row.rawData[f.key]}</td>)}
                  <td className="p-3 text-red-400">{row.errors[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-slate-800">
        <Button variant="ghost" onClick={() => setStep(1)}>Terug</Button>
        <Button onClick={executeImport} disabled={isProcessing || stats.valid === 0} className="bg-emerald-600 hover:bg-emerald-700">
          {isProcessing ? <RefreshCw className="animate-spin" size={18}/> : `Importeer ${stats.valid} Records`}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-12 animate-in fade-in">
      <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
        <CheckCircle2 size={40} className="text-black" />
      </div>
      <h2 className="text-3xl font-serif text-white mb-2">Import Voltooid!</h2>
      <div className="flex justify-center gap-8 my-8 text-sm">
        <div><p className="font-bold text-2xl text-emerald-400">{importResult?.created}</p><p className="text-slate-500">Aangemaakt</p></div>
        <div><p className="font-bold text-2xl text-amber-400">{importResult?.updated}</p><p className="text-slate-500">Geüpdatet</p></div>
        <div><p className="font-bold text-2xl text-slate-400">{importResult?.skipped}</p><p className="text-slate-500">Overgeslagen</p></div>
      </div>
      <Button onClick={onClose} className="min-w-[200px]">Sluiten</Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex justify-between items-center p-6 border-b border-slate-900 bg-black/40">
        <div>
          <h2 className="text-2xl font-serif text-white">{title}</h2>
          <p className="text-slate-500 text-xs uppercase tracking-widest">CSV Importer Wizard</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
      </div>
      <div className="px-6 py-4 bg-black/20">
        <Stepper steps={['Upload', 'Map', 'Review', 'Finish']} current={step} />
      </div>
      <div className="flex-grow overflow-y-auto p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
          {step === 0 && renderUpload()}
          {step === 1 && renderMapping()}
          {step === 2 && renderReview()}
          {step === 3 && renderSuccess()}
        </div>
      </div>
    </div>
  );
};
