
import { useState, useEffect, useCallback } from 'react';
import { Reservation } from '../types';
import { bookingRepo } from '../utils/storage';

export const useReservations = () => {
  const [data, setData] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0); // Trigger for re-fetch

  const refresh = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Using the new async method
        const reservations = await bookingRepo.getAllAsync(true);
        
        if (isMounted) {
          setData(reservations);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Failed to fetch reservations:", err);
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    // Listen to global updates to keep in sync if other components modify LS
    const handleStorageUpdate = () => refresh();
    window.addEventListener('storage-update', handleStorageUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('storage-update', handleStorageUpdate);
    };
  }, [version, refresh]);

  return { data, isLoading, error, refresh };
};
