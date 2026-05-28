import type { QueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { clearAllBookingStatusTrackers } from "@/entities/booking/lib/bookingDisplayStatusTracker";
import { clearStoriesFeedRealtimeDebounce } from "@/entities/story/lib/storyFeedRealtimeDebounce";

/**
 * Вызывается при потере сессии (logout / истёкший токен): сбрасывает React Query
 * и RAM-кэш изображений, чтобы не держать данные предыдущего пользователя и снизить давление на память.
 * Дисковый кэш expo-image не трогаем — очистка диска может быть долгой; при необходимости добавьте `clearDiskCache` точечно.
 */
export async function clearSessionCaches(queryClient: QueryClient): Promise<void> {
  clearStoriesFeedRealtimeDebounce();
  clearAllBookingStatusTrackers();
  queryClient.clear();
  try {
    await Image.clearMemoryCache();
  } catch {
    // no-op: web / неготовый native module
  }
}
