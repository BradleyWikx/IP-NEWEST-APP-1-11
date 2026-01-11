
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: { name: string; role: string };
  action: string; // e.g., 'UPDATE_STATUS', 'BULK_EDIT'
  entityType: 'RESERVATION' | 'CALENDAR' | 'SYSTEM' | 'CUSTOMER';
  entityId: string;
  changes?: { 
    before?: any; 
    after?: any; 
    description?: string;
  };
}

const AUDIT_KEY = 'grand_stage_audit_log';

// Helper to get current mock user (in a real app, this comes from Auth Context)
const getCurrentUser = () => ({
  name: 'John Doe',
  role: 'ADMIN' 
});

export const logAuditAction = (
  action: string,
  entityType: 'RESERVATION' | 'CALENDAR' | 'SYSTEM' | 'CUSTOMER',
  entityId: string,
  changes: { before?: any; after?: any; description?: string } = {}
) => {
  try {
    const newEntry: AuditLogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      user: getCurrentUser(),
      action,
      entityType,
      entityId,
      changes
    };

    const existingLogs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    // Prepend new log
    const updatedLogs = [newEntry, ...existingLogs].slice(0, 1000); // Limit to last 1000 entries
    
    localStorage.setItem(AUDIT_KEY, JSON.stringify(updatedLogs));
    console.log(`[Audit] ${action} on ${entityType} ${entityId}`);
  } catch (e) {
    console.error("Failed to log audit action", e);
  }
};

export const getAuditLogs = (): AuditLogEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
  } catch (e) {
    return [];
  }
};
