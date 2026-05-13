# Phase 13 — архитектура оркестрации (кандидаты на бэкенд)

Документ фиксирует **кандидатов** на вынос логики с клиента. Реализация бэкенда **не входит** в объём этой фазы.

## 1. Текущее состояние (фронт)

| Область | Где в коде | Что делает клиент |
|---------|------------|---------------------|
| PixAI / бронирование / вайб | [`src/entities/pixai/api/usePixAI.ts`](src/entities/pixai/api/usePixAI.ts), [`invokePixaiOrchestrate.ts`](src/entities/pixai/api/invokePixaiOrchestrate.ts), экраны [`AIBookingPage`](src/pages/ai-booking/ui/AIBookingPage.tsx), [`VibeMatchPage`](src/pages/vibe-match/ui/VibeMatchPage.tsx) | Вызовы Edge/API, склейка шагов UI, повторные запросы, обработка ошибок |
| Лента сторис / постов | [`useStoriesFeed`](src/entities/story/api/useStoriesFeed.ts), [`usePostsFeed`](src/entities/post/api/usePostsFeed.ts) | Несколько параллельных запросов к Supabase, агрегация `place_id`, реакций, комментариев на клиенте |
| Направления / геокодинг | [`DirectionsModal`](src/components/DirectionsModal.tsx), [`directionsApi`](src/shared/lib/directionsApi.ts) | Google Directions/Geocoding с клиента по `EXPO_PUBLIC_*` ключам |
| Архив карт | [`StoriesArchivePage`](src/pages/stories-archive/ui/StoriesArchivePage.tsx) | Кластеризация Supercluster на устройстве — **нормально** для UX; данные уже с бэка |

## 2. Кандидаты на BFF / агрегацию

### 2.1 BFF (Backend-for-Frontend) — узкий API под мобильное приложение

**Кандидат:** единый слой (Supabase Edge Functions, Cloudflare Workers, или маленький Node) между приложением и Supabase/Google.

**Зачем:** стабильные контракты, скрытие секретов (Google Web API, лимиты), версионирование, единая телеметрия.

**Влияние:** меньше гонок на клиенте, проще ротация ключей; +1 hop latency (обычно приемлемо при edge).

**Миграция:** завести `/v1/feed`, `/v1/directions`; клиент переводить по одному экрану; старые RPC оставить до полного cutover.

### 2.2 Сервис агрегации ленты (feed aggregation)

**Проблема:** [`useStoriesFeed`](src/entities/story/api/useStoriesFeed.ts) / посты тянут несколько таблиц и склеивают результат в JS — рост N+1 и сложность кэша на клиенте.

**Кандидат:** материализованное представление, Postgres function `get_feed_page(cursor)`, или Edge Function, возвращающая **готовую страницу** JSON.

**Влияние:** меньше работы на JS thread и меньше round-trips; проще пагинация и рейт-лимиты.

**Миграция:** дублировать ответ нового API рядом со старым запросом в dev; сравнить payload; переключить React Query `queryFn`; удалить клиентскую агрегацию после стабилизации.

### 2.3 AI orchestration backend

**Проблема:** цепочки PixAI (слоты, планы, вайб) размазаны по хукам и экранам — сложно менять промпты/модели без релиза приложения.

**Кандидат:** один оркестратор (Edge Function + очередь или отдельный сервис), клиент шлёт `intent + contextId`, получает `steps` или финальный `plan`.

**Влияние:** быстрее итерации по AI; секреты и биллинг не на устройстве; лучше observability.

**Миграция:** вынести `invokePixaiOrchestrate` за фичефлаг; сохранить fallback на текущий прямой вызов до метрик «успех/латентность».

### 2.4 Recommendation backend

**Сейчас:** явных «рекомендаций» в репозитории мало; есть связанные места (following, interacted places в фиде).

**Кандидат:** отдельный сервис или scheduled job + таблица `user_recommendations`, клиент только читает готовые id.

**Влияние:** тяжёлая логика и персонализация не блокируют UI.

**Миграция:** по мере появления продукта; начинать с read-only API и кэша React Query.

## 3. Что **не** выносить без замеров

- Кластеризация архива на клиенте (Supercluster) — дешёвая относительно сети; вынос имеет смысл только при очень больших наборах точек и общей карте «мира».
- Мелкие преобразования UI (сортировка видимого списка) — оставить на клиенте.

## 4. Риски миграции

- Расхождение схемы BFF и клиентских типов — решение: codegen из OpenAPI или zod на Edge.
- Холодный старт Edge — кэширование и keep-warm для критичных путей.
- Offline — BFF должен иметь те же семантики ошибок, что и сегодняшний Supabase.

---

**Итог:** приоритет выноса — **секреты/квоты Google**, **тяжёлая агрегация ленты**, **длинные цепочки PixAI**; остальное — по метрикам и продуктовым требованиям.
