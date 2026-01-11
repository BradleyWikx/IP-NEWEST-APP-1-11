
/**
 * Converts an array of objects or arrays to a CSV string.
 * Handles escaping of quotes and newlines.
 */
export const toCSV = (rows: any[], columns?: string[]): string => {
  if (!rows || rows.length === 0) return '';

  // Determine headers
  const headerRow = columns || Object.keys(rows[0]);
  
  const processValue = (val: any): string => {
    if (val === null || val === undefined) return '';
    const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    // Escape double quotes by doubling them
    const escaped = stringVal.replace(/"/g, '""');
    // Wrap in quotes if it contains comma, newline, or quotes
    if (escaped.search(/("|,|\n)/g) >= 0) {
      return `"${escaped}"`;
    }
    return escaped;
  };

  const csvRows = [
    headerRow.join(','), // Header
    ...rows.map(row => 
      headerRow.map(fieldName => processValue((row as any)[fieldName])).join(',')
    )
  ];

  return csvRows.join('\n');
};

/**
 * Triggers a browser download of the CSV string.
 * Adds BOM for Excel UTF-8 compatibility.
 */
export const downloadCSV = (filename: string, csvString: string) => {
  // Add Byte Order Mark (BOM) for Excel to recognize UTF-8
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * Legacy wrapper for compatibility if needed.
 */
export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  const csv = toCSV(data, headers);
  downloadCSV(filename, csv);
};
