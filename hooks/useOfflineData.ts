
import { useState, useEffect } from 'react';
import { bookingRepo } from '../utils/storage';
import { Reservation } from '../types';

const OFFLINE_CACHE_KEY = 'grand_stage_offline_bookings';

export const useOfflineData = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [data, setData] = useState<Reservation[]>([]);
  const [lastSynced, setLastSynced] = useState<string | null>(localStorage.getItem(OFFLINE_CACHE_KEY + '_timestamp'));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial Load
    loadData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Logic
  useEffect(() => {
    if (isOnline) {
      const interval = setInterval(() => {
        syncData();
      }, 30000); // Sync every 30s when online
      
      syncData(); // Sync immediately on online
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  const syncData = () => {
    try {
      // In a real app, this would fetch from API. 
      // Here we treat localStorage 'bookingRepo' as the source of truth when online.
      const freshData = bookingRepo.getAll();
      
      // Update Cache
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(freshData));
      const now = new Date().toISOString();
      localStorage.setItem(OFFLINE_CACHE_KEY + '_timestamp', now);
      
      setData(freshData);
      setLastSynced(now);
    } catch (e) {
      console.error("Failed to sync offline cache", e);
    }
  };

  const loadData = () => {
    if (navigator.onLine) {
        syncData();
    } else {
        // Load from Cache
        const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
        if (cached) {
            setData(JSON.parse(cached));
        }
    }
  };

  return { isOnline, data, lastSynced, refresh: loadData };
};
