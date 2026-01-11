
export interface ImportSchemaField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'email' | 'date' | 'select';
  options?: string[];
  validate?: (value: any) => string | null;
}

export interface ParseResult {
  headers: string[];
  data: string[][];
}

/**
 * Parses CSV text, handling quoted fields and newlines correctly.
 */
export const parseCSV = (text: string): ParseResult => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\n' || char === '\r') {
        if (currentVal || currentRow.length > 0) {
          currentRow.push(currentVal.trim());
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentVal += char;
      }
    }
  }
  
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  const headers = rows[0] || [];
  const data = rows.slice(1).filter(r => r.length === headers.length || r.join('').trim().length > 0);

  return { headers, data };
};

/**
 * Auto-maps CSV headers to Schema keys using fuzzy matching.
 */
export const autoMapColumns = (headers: string[], schema: ImportSchemaField[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  
  schema.forEach(field => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fieldNorm = normalize(field.label);
    
    // Try to find a header that contains the field name or vice versa
    const match = headers.find(h => {
      const hNorm = normalize(h);
      return hNorm === fieldNorm || hNorm.includes(fieldNorm) || fieldNorm.includes(hNorm);
    });

    if (match) {
      mapping[field.key] = match;
    }
  });

  return mapping;
};

/**
 * Validates a single row against the schema.
 */
export const validateRow = (
  mappedRow: Record<string, any>, 
  schema: ImportSchemaField[]
): string[] => {
  const errors: string[] = [];

  schema.forEach(field => {
    const val = mappedRow[field.key];
    const isEmpty = val === undefined || val === null || val === '';

    if (field.required && isEmpty) {
      errors.push(`${field.label} is verplicht.`);
      return;
    }

    if (isEmpty) return;

    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) errors.push(`Ongeldig emailadres: ${val}`);
    } else if (field.type === 'number') {
      if (isNaN(Number(val))) errors.push(`Moet een getal zijn: ${val}`);
    } else if (field.type === 'date') {
      const d = new Date(val);
      if (isNaN(d.getTime())) errors.push(`Ongeldige datum: ${val}`);
    } else if (field.type === 'select' && field.options) {
      if (!field.options.includes(val)) errors.push(`Waarde moet een van: ${field.options.join(', ')}`);
    }

    if (field.validate) {
      const customErr = field.validate(val);
      if (customErr) errors.push(customErr);
    }
  });

  return errors;
};

/**
 * Generates a CSV string for error reporting.
 */
export const generateErrorCSV = (rows: any[]): string => {
  if (rows.length === 0) return '';
  
  const processedRows = rows.map(r => ({
    ...r.rawData,
    ERRORS: r.errors.join(' | ')
  }));

  const headers = Object.keys(processedRows[0]);
  const csvContent = [
    headers.join(','),
    ...processedRows.map(row => 
      headers.map(h => {
        const val = row[h] ? String(row[h]).replace(/"/g, '""') : '';
        return `"${val}"`;
      }).join(',')
    )
  ].join('\n');

  return csvContent;
};
