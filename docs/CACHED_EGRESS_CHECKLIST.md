# Чеклист: снижение Cached Egress (Supabase Storage / CDN)

Контекст: на Free-плане **Cached Egress ~21.6 GB при лимите 5 GB** при ~18 MAU. Non-cached egress в норме — узкое место почти наверняка **публичный Storage + CDN**, а не БД/Realtime.

Этот документ привязан к текущей кодовой базе Pixap (май 2026).

---

## Как устроен трафик в проекте

| Источник | Бакет / путь | Публичный доступ |
|----------|----------------|------------------|
| Stories, посты, вложения в чатах | `stories` | Да (`stories_public_read`) |
| Аватары | `avatars` | Да |
| Фото заведений | `business-cards` | Да (через `resolveStoragePublicUrl`) |
| Лого в auth-email | `logo` (Edge Function) | Публичный URL в шаблоне |

Загрузка перед Storage уже сжимает файлы (`prepareImageForStorageUpload.ts`):

- посты: long edge **1600**, WebP ~0.73  
- stories: **1024**  
- аватары: **768**  

Но **без pregen + Image Transformations** клиент в UI часто запрашивает **полный объект** с CDN, даже для превью 128×128.

**Основной путь:** pre-generated WebP (`*_thumb.webp`, …) через `/object/public/` — **без transform quota**.

**Fallback:** `getOptimizedImageUrl` / `imagePresets.ts` — `/render/image/` только при `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1`, если pregen отсутствует, и включённой фиче в Supabase Dashboard.

Аудит missing pregen: `supabase/smoke/storage_pregen_missing_audit.sql`

---

## Приоритет P0 — максимальный эффект

### [x] 1. Включить Supabase Image Transformations (Pro + Dashboard)

- [x] Pro + Dashboard → Image Transformations.
- [x] `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` — `.env.example`, EAS Environment.
- [x] Fallback на `/object/public/` при 403 — `SmartImage`.
- [x] Smoke → **200**.

**Документация:** `docs/SUPABASE_IMAGE_TRANSFORMS_SETUP.md`

**Ожидаемый эффект:** thumb 128px вместо файла 1024–1600px → порядок **5–15×** меньше байт на показ в сетке.

---

### [x] 2. Чаты: вложения без ресайза (критичный пробел)

- [x] `MessageAttachmentBubble` + `getMessageAttachmentImageDisplayUri` (thumb/bleed + DPR).
- [x] `AttachmentViewerModal` — preset `large` через `getMessageAttachmentViewerImageUri`.

**Файлы:**  
`MessageThreadListItem.tsx`, `MessageAttachmentBubble.tsx`, `messageAttachmentDisplayUrl.ts`, `AttachmentViewerModal.tsx`

---

### [x] 3. Видео в чатах: полная загрузка MP4 для превью

- [x] При upload: poster `{msg-id}-poster.webp` рядом с видео в `stories`.
- [x] `MessageVideoThumbnail`: poster + transforms; **без** скачивания remote MP4 для thumb.
- [x] Локальные URI до отправки — превью через `VideoThumbnails` (как раньше).
- [ ] Старые сообщения без poster: иконка (без egress); опционально backfill постеров.

**Файлы:** `uploadMessageAttachmentToStories.ts`, `messageVideoPoster.ts`, `MessageVideoThumbnail.tsx`

---

### [ ] 4. Аудит в Supabase Dashboard (1 сессия)

- [ ] **Usage** → Cached Egress → убедиться, что доминирует **Storage** (не Auth/DB).
- [ ] **Logs Explorer** → Edge/Storage logs → топ путей (`/stories/`, `/avatars/`, `.mp4`).
- [ ] Проверить, нет ли внешнего hotlinking / ботов на публичные URL (см. P2).

---

## Приоритет P1 — заметное снижение трафика

### [x] 5. Prefetch: не качать «на опережение» лишнее

| Место | Поведение сейчас | Действие |
|-------|------------------|----------|
| `StoriesFeedPage` | До **+4** постов × **2** картинки, full decode size | Уменьшить окно (+1/+2) или prefetch только blurhash + первый слайд |
| `PostMediaCarousel` | Соседние слайды; при transform — **optimized + raw** | Prefetch **только** optimized URI |
| `FeedStoryViewerPage` | ±2 слайда @ **1080×1920** | Prefetch только следующий слайд @ medium preset |
| `StoriesArchiveView` | Батчи по 8 | Снизить `PREFETCH_BATCH_SIZE` или только видимые ячейки |
| `StoryViewerPage` | `Image.prefetch` 1080×1920 | Использовать `medium` / `large` preset |
| `preloadSmartImages` | hard cap **8**, concurrency **4** | Ок для лимита; не расширять cap без метрик |

**Файлы:**  
`src/pages/stories-feed/ui/StoriesFeedPage.tsx`,  
`src/widgets/feed-post-carousel/ui/PostMediaCarousel.tsx`,  
`src/pages/feed-story-viewer/ui/FeedStoryViewerPage.tsx`,  
`src/widgets/stories-archive/ui/StoriesArchiveView.tsx`,  
`src/pages/story-viewer/ui/StoryViewerPage.tsx`,  
`src/shared/ui/smart-image/SmartImage.tsx`

---

### [x] 6. Согласовать размеры decode с реальным UI

Сейчас `optimizedPostImageSize` = `width * DPR` и `sliderHeight * DPR` (через `quantizeDecodePx`) — на 3x устройствах запросы **очень крупные**.

- [ ] Для ленты: preset **`medium`** (720×420), не полный viewport×DPR.
- [ ] Fullscreen story viewer: preset **`large`** (1080×1920) — достаточно.
- [ ] Проверить `OnboardingVenueCard` (900px hero) — можно `medium` + DPR cap 2.

**Файлы:** `StoriesFeedPage.tsx`, `imagePresets.ts`, `OnboardingVenueCard.tsx`

---

### [ ] 7. Стабильные cache keys (уже частично есть)

`quantizeDecodePx` в `imageUtils.ts` — хорошо для CDN. После включения transforms:

- [ ] Не передавать «случайные» width в каждый вызов — только presets + DPR 2/3.
- [ ] Избегать уникальных query-параметров на URL (ломают cache hit).

---

### [ ] 8. Legacy-контент в Storage

Старые объекты могли быть загружены **до** WebP/resize pipeline.

- [x] SQL аудит missing pregen — `supabase/smoke/storage_pregen_missing_audit.sql`.
- [ ] Опционально: batch re-encode (отдельная задача, не в hot path).

---

## PostgREST (зелёный на графике, ~18% в пик 12 мая, рост 17–20 мая)

Анализ Usage: **Storage** давал пики до ~111 MB/день (cached CDN); **PostgREST** — второй по объёму и недавно вырос (сообщения, лента, polling).

### [x] 9b. Лента постов — меньше повторных SELECT

- [x] `FETCH_WINDOW_MULTIPLIER` 4 → 2, потолок **60** строк за запрос.
- [x] `useInteractedPlaceIds` — кэш 8 мин (3 запроса не на каждый `fetchNextPage`).
- [x] `post_comments` при hydrate: `.limit(min(400, N*8))`.
- [x] Polling ленты 25s → **45s** (если realtime off).

### [x] 9c. Inbox сообщений

- [x] Polling 25s → **45s**, staleTime 40s.

**Файлы:** `usePostsFeed.ts`, `useInteractedPlaceIds.ts`, `hydrateFeedPosts.ts`, `useMessagesInbox.ts`

---

## Приоритет P2 — инфраструктура и защита

### [x] 9. Публичные бакеты

- [x] Решение: оставить **public** + transforms + Cache-Control (см. `docs/STORAGE_P2_PUBLIC_BUCKETS.md`).
- [ ] Rate limiting / WAF / Custom Domain — по росту трафика.

---

### [x] 10. `business-cards` и web admin

- [x] `uploadBusinessCardImage` (WebP, 1600px, immutable cache).
- [x] `AdminImageUploadPage` — рабочий upload.
- [x] Миграция bucket + RLS `20260525120000_storage_p2_buckets_cache.sql`.
- [ ] Web-админка (вне репо): те же лимиты и `cacheControl`.

---

### [x] 11. Edge Function: статический logo

- [x] Bucket `logo` + metadata cacheControl в миграции для `icon.png`.
- [x] Новые upload в app: `buildStorageUploadOptions` на всех бакетах.

---

## Приоритет P3 — план, мониторинг, UX при лимитах

### [x] 12. Pro ($25) — когда имеет смысл

Документировано в [`docs/EGRESS_METRICS.md`](./EGRESS_METRICS.md) §1 (Spend Cap, алерт 80%).

- [x] Таблица целей Pro vs оптимизации кода.
- [ ] Spend Cap: зафиксировать решение в Billing (вручную).
- [ ] Настроить email/привычку проверять Usage при 80%.

---

### [x] 13. Метрики «до/после» (раз в неделю)

- [x] Шаблон лога: [`scripts/egress-weekly-log.md`](../scripts/egress-weekly-log.md)
- [x] Инструкция: [`docs/EGRESS_METRICS.md`](./EGRESS_METRICS.md)
- [x] Dev-счётчик `render` vs `object`: `storageEgressMetrics.ts` + Metro `[storage-egress]`
- [x] SQL аудит объектов: `supabase/smoke/storage_objects_size_audit.sql`

**Целевой ориентир:** cached egress **< 1–2 GB/мес** при ~18 MAU.

---

## Карта покрытия `getOptimizedImageUrl` в UI

| Экран / виджет | Оптимизация URL | Заметка |
|----------------|-----------------|--------|
| Stories feed, карусель постов | Да (если transform on) | Aggressive prefetch |
| Feed story viewer, story viewer | Да | Prefetch 1080p |
| Stories strip, archive | Pregen `_story.webp` + render fallback | Archive uses `getFeedStoryPreviewImageUrl` |
| Profile, edit profile, search, favorites | Да | |
| Message thread attachments | Да | P0.2 |
| Create post modal (local `photo.uri`) | N/A | Локальные файлы |
| Place gallery, vibe match, bookings | Да | |
| Comment preview avatars | `resolveStoragePublicUrl` only | Мелкие — добавить thumb preset |

---

## Быстрая диагностика «что режет бюджет сейчас»

1. В DevTools / Charles: открыть ленту → фильтр `supabase.co/storage` → смотреть **размер** ответа на thumb 128px.  
   - Если **> 200 KB** на превью → transforms выключены или не применяются.  
2. Открыть чат с фото/видео → повторить. Видео-превью с **MB** на запрос → пункт P0.3.  
3. Пролистать 20 постов без остановки → число уникальных Storage URL ≈ prefetch window.

---

## Рекомендуемый порядок работ (1–2 спринта)

1. **P0.1** transforms + env flag + smoke  
2. **P0.2** optimize message images  
3. **P0.3** video poster strategy  
4. **P1.5–6** prefetch + preset sizing  
5. **P0.4** dashboard audit  
6. **P2.9** public bucket review (если трафик всё ещё высокий)

---

## Связанные файлы (справочник)

```
src/shared/lib/imageUtils.ts
src/shared/lib/imagePresets.ts
src/shared/lib/prepareImageForStorageUpload.ts
src/shared/lib/resolveStoragePublicUrl.ts
src/shared/lib/storyMediaUrls.ts
src/shared/ui/smart-image/SmartImage.tsx
src/entities/story/lib/uploadStoriesBucketMedia.ts
src/entities/messages/lib/uploadMessageAttachmentToStories.ts
supabase/migrations/20260422_profiles_and_avatars_rls.sql
supabase/migrations/20260424_stories_bucket_rls.sql
```

---

*Документ для внутреннего использования. Обновляйте чекбоксы по мере выполнения.*
