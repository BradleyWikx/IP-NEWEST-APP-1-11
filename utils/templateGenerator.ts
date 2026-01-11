
import { downloadCSV } from './csvExport';

export type TemplateType = 'CUSTOMER' | 'RESERVATION' | 'MERCHANDISE';

export const generateTemplate = (type: TemplateType) => {
  let headers: string[] = [];
  let example: string[] = [];
  let filename = '';

  switch (type) {
    case 'CUSTOMER':
      headers = ['salutation', 'firstName', 'lastName', 'email', 'phone', 'companyName', 'street', 'houseNumber', 'zip', 'city', 'externalId'];
      example = ['Dhr.', 'Jan', 'Jansen', 'jan.jansen@voorbeeld.nl', '0612345678', 'Jansen BV', 'Kalverstraat', '101', '1012 NX', 'Amsterdam', 'EXT-1001'];
      filename = 'import_template_klanten.csv';
      break;
      
    case 'RESERVATION':
      headers = [
        'date', 'email', 'firstName', 'lastName', 'partySize', 
        'status', 'package', 'optionExpiresAt', 'totalOverride', 'isPaid', 'notes'
      ];
      example = [
        '2025-06-15', 'peter@bedrijf.nl', 'Peter', 'De Vries', '4', 
        'REQUEST', 'premium', '2025-05-01', '', 'NEE', 'Dieetwensen: 1x Gluten'
      ];
      filename = 'import_template_reserveringen.csv';
      break;
      
    case 'MERCHANDISE':
      headers = ['name', 'category', 'price', 'stock', 'active', 'description'];
      example = ['Luxe Programma Boek', 'Souvenir', '15.00', '100', 'TRUE', '50 paginas full color'];
      filename = 'import_template_merchandise.csv';
      break;
  }

  // Generate CSV content with BOM for Excel compatibility
  const csvContent = [
    headers.join(','),
    example.map(v => `"${v}"`).join(',') // Quote values to handle potential separators in data
  ].join('\n');

  downloadCSV(filename, csvContent);
};
