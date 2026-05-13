import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase/client";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  user_id: string;
  business_card_id: string | null;
  text: string;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications.list(user?.id),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });
};

export const useUnreadCount = () => {
  const { user } = useAuth();
  const unreadCountQuery = useQuery({
    queryKey: queryKeys.notifications.unread(user?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 15 * 1000,
  });
  return unreadCountQuery.data ?? 0;
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.listPrefix });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadPrefix });
    },
  });
};
