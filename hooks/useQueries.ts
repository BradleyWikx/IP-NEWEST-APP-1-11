
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  bookingRepo, calendarRepo, showRepo, customerRepo, 
  waitlistRepo, voucherRepo, voucherOrderRepo, invoiceRepo 
} from '../utils/storage';
import { Reservation, BookingStatus } from '../types';

// --- RESERVATIONS ---

export const useReservationsQuery = () => {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: async () => {
      // Simulate async network request
      // In a real app, this would be an API call
      return bookingRepo.getAllAsync(true);
    }
  });
};

export const useActiveReservationsQuery = () => {
  return useQuery({
    queryKey: ['reservations', 'active'],
    queryFn: async () => {
      const all = await bookingRepo.getAllAsync();
      return all.filter(r => 
        r.status !== BookingStatus.CANCELLED && 
        r.status !== BookingStatus.ARCHIVED
      );
    }
  });
};

export const useReservationMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<Reservation> }) => {
      // Logic wrapper to support partial updates via repo
      // Note: Repository update() method signature might need the full object in current implementation
      // We assume repo.update takes (id, updaterFn)
      await bookingRepo.update(id, (prev) => ({ ...prev, ...data }));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    }
  });
};

// --- EVENTS & SHOWS ---

export const useEventsQuery = () => {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => calendarRepo.getAllAsync()
  });
};

export const useShowsQuery = () => {
  return useQuery({
    queryKey: ['shows'],
    queryFn: async () => showRepo.getAllAsync()
  });
};

// --- CUSTOMERS ---

export const useCustomersQuery = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => customerRepo.getAllAsync()
  });
};

// --- OTHERS ---

export const useInvoicesQuery = () => {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => invoiceRepo.getAllAsync()
  });
};

export const useVouchersQuery = () => {
  return useQuery({
    queryKey: ['vouchers'],
    queryFn: async () => voucherRepo.getAllAsync()
  });
};
