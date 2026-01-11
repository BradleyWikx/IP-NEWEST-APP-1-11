
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'grand_stage_wizard_progress';

export const useWizardPersistence = (initialState: any) => {
  const [wizardData, setWizardData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    let data = saved ? JSON.parse(saved) : initialState;
    
    // Generate idempotency key if missing (new session or restored session without one)
    if (!data.idempotencyKey) {
        data.idempotencyKey = `IDEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    return data;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
  }, [wizardData]);

  const resetWizard = () => {
    // Re-init with fresh idempotency key
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
