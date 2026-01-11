
export const calculateTimeRemaining = (expiryDateStr?: string) => {
  if (!expiryDateStr) return { diff: 0, label: 'Geen datum', isExpired: false, color: 'slate' };

  const now = new Date();
  const expiry = new Date(expiryDateStr);
  const diffMs = expiry.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let label = '';
  let color = 'slate';
  let isExpired = false;

  if (diffMs < 0) {
    isExpired = true;
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);
    if (absDays > 0) label = `${absDays}d verlopen`;
    else label = `${absHours}u verlopen`;
    color = 'red';
  } else {
    if (diffDays > 1) {
      label = `Nog ${diffDays} dagen`;
      color = diffDays > 3 ? 'emerald' : 'emerald';
    } else if (diffHours > 0) {
      label = `Nog ${diffHours} uur`;
      color = 'amber';
    } else {
      label = '< 1 uur';
      color = 'amber';
    }
  }

  return { diff: diffMs, label, isExpired, color };
};

export const addDays = (dateStr: string | Date, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};
