
import { UndoRecord } from '../types';
import { bookingRepo, waitlistRepo, voucherOrderRepo, voucherRepo, saveData } from './storage';
import { logAuditAction } from './auditLogger';

const UNDO_TIMEOUT_MS = 30000; // 30 seconds

class UndoManager {
  private records: Map<string, UndoRecord> = new Map();

  // Registers an action that can be undone
  registerUndo(
    actionType: string,
    entityType: UndoRecord['entityType'],
    entityId: string,
    beforeSnapshot: any,
    createdEntities: UndoRecord['createdEntities'] = []
  ) {
    const id = `UNDO-${Date.now()}`;
    const record: UndoRecord = {
      id,
      actionType,
      entityType,
      entityId,
      beforeSnapshot: JSON.parse(JSON.stringify(beforeSnapshot)), // Deep copy safety
      createdEntities,
      expiresAt: Date.now() + UNDO_TIMEOUT_MS
    };

    this.records.set(id, record);

    // Auto-expire
    setTimeout(() => {
      this.records.delete(id);
    }, UNDO_TIMEOUT_MS);

    // Trigger UI Toast (dispatch global event)
    window.dispatchEvent(new CustomEvent('grand-stage-toast', {
      detail: {
        type: 'UNDO',
        message: `${actionType} uitgevoerd.`,
        undoId: id
      }
    }));
  }

  // Performs the undo operation
  performUndo(id: string) {
    const record = this.records.get(id);
    if (!record) {
      this.showError('Undo actie is verlopen of niet gevonden.');
      return;
    }

    try {
      // 1. Restore Snapshot
      switch (record.entityType) {
        case 'RESERVATION':
          bookingRepo.update(record.entityId, () => record.beforeSnapshot);
          break;
        case 'WAITLIST':
          waitlistRepo.update(record.entityId, () => record.beforeSnapshot);
          break;
        case 'VOUCHER_ORDER':
          voucherOrderRepo.update(record.entityId, () => record.beforeSnapshot);
          break;
        case 'VOUCHER':
          voucherRepo.update(record.entityId, () => record.beforeSnapshot);
          break;
      }

      // 2. Cleanup Created Side-Effects
      if (record.createdEntities && record.createdEntities.length > 0) {
        record.createdEntities.forEach(created => {
          if (created.type === 'RESERVATION') {
            bookingRepo.delete(created.id);
          } else if (created.type === 'VOUCHER') {
            voucherRepo.delete(created.id);
          }
        });
      }

      // 3. Log
      logAuditAction(`UNDO_${record.actionType}`, 'SYSTEM', record.entityId, {
        description: `Undid action ${record.actionType}`
      });

      this.showSuccess('Actie ongedaan gemaakt.');
      this.records.delete(id);
      
      // Refresh UI trigger
      window.dispatchEvent(new Event('storage-update'));

    } catch (err) {
      console.error(err);
      this.showError('Kon actie niet ongedaan maken.');
    }
  }

  // Generic Error Toast Helper
  showError(message: string) {
    window.dispatchEvent(new CustomEvent('grand-stage-toast', {
      detail: { type: 'ERROR', message }
    }));
  }

  // Generic Success Toast Helper
  showSuccess(message: string) {
    window.dispatchEvent(new CustomEvent('grand-stage-toast', {
      detail: { type: 'SUCCESS', message }
    }));
  }
}

export const undoManager = new UndoManager();
