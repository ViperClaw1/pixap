import { supabase } from "@/shared/api/supabase/client";

export async function confirmAdminBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_confirm_booking", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
}
