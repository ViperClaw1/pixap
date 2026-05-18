export type WaBookingQrPayload = {
  client_name: string;
  client_phone: string;
  place_name: string;
  booking_date: string;
  booking_slot: string;
  is_free: boolean;
  price: string | null;
};
