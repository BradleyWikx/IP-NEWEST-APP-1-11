
const TUSSENVOEGSELS = new Set([
  'van', 'de', 'der', 'den', 'te', 'ten', 'ter', 
  'in', 'op', 'bij', "'t", "'s", "le", "la", "du", "von", "het", "aan"
]);

const capitalize = (s: string) => {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export const formatDutchName = (input: string): string => {
  if (!input) return '';
  const parts = input.split(' ').filter(Boolean);
  
  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    // Always capitalize first word (First Name)
    if (index === 0) return capitalize(part);
    
    // Check for tussenvoegsels (keep lower)
    if (TUSSENVOEGSELS.has(lower)) return lower;
    
    // Capitalize rest (Last Name parts)
    return capitalize(part);
  }).join(' ');
};

export const formatGuestName = (first: string, last: string) => {
  const full = `${first || ''} ${last || ''}`.trim();
  return formatDutchName(full);
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatTime = (timeStr: string) => {
  if (!timeStr) return '';
  // Ensure HH:MM format
  return timeStr.split(':').slice(0, 2).join(':');
};
