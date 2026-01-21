
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'grand_stage_wizard_progress';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Hours

export const useWizardPersistence = (initialState: any) => {
  const [wizardData, setWizardData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Check expiry
        if (parsed._timestamp && (Date.now() - parsed._timestamp > EXPIRY_MS)) {
          localStorage.removeItem(STORAGE_KEY);
          return { ...initialState, idempotencyKey: `IDEM-${Date.now()}` };
        }

        // Merge saved data with initial state structure to ensure new fields exist
        return { ...initialState, ...parsed };
      }
    } catch (e) {
      console.error("Failed to rehydrate wizard state", e);
      localStorage.removeItem(STORAGE_KEY);
    }
    
    // Default Fallback
    return {
      ...initialState,
      idempotencyKey: `IDEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  });

  useEffect(() => {
    // Save state with timestamp
    const stateToSave = {
        ...wizardData,
        _timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [wizardData]);

  const resetWizard = () => {
    const freshState = {
        ...initialState,
        idempotencyKey: `IDEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    setWizardData(freshState);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateWizard = (newData: any) => {
    setWizardData((prev: any) => ({ ...prev, ...newData }));
  };

  return { wizardData, updateWizard, resetWizard };
};
