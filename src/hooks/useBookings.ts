import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Booking {
  id: string;
  user_id: string;
  business_card_id: string;
  date_time: string;
  cost: number;
  status: "upcoming" | "completed" | "expired";
  created_at: string;
  business_card?: {
    id: string;
    name: string;
    image: string;
    address: string;
    category_id: string | null;
  } | null;
}

export const useBookings = (status?: "upcoming" | "completed" | "expired") => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bookings", user?.id, status],
    queryFn: async () => {
      let query = supabase
        .from("bookings")
        .select("*, business_card:business_cards(id, name, image, address, category_id)")
        .eq("user_id", user!.id)
        .order("date_time", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!user,
  });
};

export const useCreateBooking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (booking: { business_card_id: string; date_time: string; cost: number }) => {
      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...booking, user_id: user!.id, status: "upcoming" as const })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }),
  });
};
