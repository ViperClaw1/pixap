# AI Booking Chat — архитектурный аудит

## 1. Текущий поток PixAI Smart Booking

Экран: [`src/pages/ai-booking/ui/AIBookingPage.tsx`](../src/pages/ai-booking/ui/AIBookingPage.tsx).

Шаги (`FlowStep`):

1. `city` — выбор города  
2. `category` — категория или «Restaurant table», опциональный комментарий  
3. `scope` — nearby vs city, затем `runFlow` → `pixai-orchestrate`  
4. `places` — список предложенных мест (`AIBookingSuggestedPlaces`)  
5. `booking` — выбор места (уже сделан при переходе), календарь и слоты (`AIBookingSlotPicker`), затем форма клиента (`AIBookingCustomerForm`)

Источник списка мест: последнее сообщение ассистента в [`usePixAI`](../src/entities/pixai/api/usePixAI.ts) с полем `toolResult.places` (`latestToolResult?.places` → `placeOptions`). Это **не** отдельный React Query — массив живёт в состоянии хука PixAI после успешного поиска.

Слоты: [`useAvailableSlots`](../src/entities/booking/api/useAvailableSlots.ts) (TanStack Query) по `selectedPlace.id` и `bookingDateYmd`. Чат **не должен** подменять или инвалидировать этот запрос без смены места/даты.

Транскрипт диалога PixAI (`AIBookingTranscript`) отражает историю **оркестратора** (поиск по flow). Новый чат консьержа — **отдельный** канал сообщений, без записи в `usePixAI.messages`.

## 2. Точка интеграции (вставка)

- **Шаг**: `currentStep === "booking" && selectedPlace != null` (пользователь уже на этапе даты/слота).  
- **UX**: компактная кнопка / FAB «AI» у нижней зоны (над футером или внутри секции слотов), открывающая **нижнюю панель** (~половина экрана) с `pointerEvents`, чтобы верх (календарь, контекст бронирования) оставался видимым.  
- **Навигация**: без новых экранов React Navigation — оверлей внутри страницы.

## 3. Источник истины для рекомендаций

- **Канонический каталог**: массив `PixAIPlace[]` из `placeOptions` (последний успешный поиск).  
- **Представление для UI**: производная — исключения и порядок по **id** в состоянии активной вкладки чата (`excludedPlaceIds`, `rerankedPlaceIds`), без хранения дубликатов полных карточек на каждую вкладку.  
- **Ревизия каталога**: монотонный счётчик `catalogRevision` на странице, инкремент после успешного `runFlow`. При смене ревизии store сбрасывает per-tab view рекомендаций (сообщения вкладок сохраняются).

## 4. Сетевая модель

- Ключ Gemini **только** на сервере: Edge Function `pixai-booking-chat`.  
- Клиент: `supabase.functions.invoke` с JWT; перед вызовом — тот же паттерн обновления сессии, что для [`invokePixaiOrchestrateWithAuth`](../src/entities/pixai/api/invokePixaiOrchestrate.ts) (избежание 401).  
- Тело запроса: укороченные поля мест + контекст бронирования + история чата + новая реплика пользователя.

## 5. Владение состоянием

| Область | Владелец |
|--------|----------|
| Шаги wizard, город, категория, место, дата, слот, форма | `AIBookingPage` (useState) |
| Сообщения чата, вкладки, view рекомендаций по вкладке | Zustand: `src/features/ai-booking-chat/model/bookingChatStore.ts` |
| Слоты / корзина / бронь | существующие entities + hooks |
| Список мест после поиска | `usePixAI` (неизменённый контракт) |

## 6. Риски

| Риск | Митигация |
|------|-----------|
| Утечка API ключа | Только `GEMINI_API_KEY`; опционально `GEMINI_MODEL` + цепочка fallback в `pixai-booking-chat/index.ts` |
| Раздутый payload | Лимит полей мест, разумный размер истории |
| Ре-рендер всего `ScrollView` | Селекторы Zustand, мемо строк, панель изолирована |
| Галлюцинации заведений | Промпт + валидация id на edge + клиентский откат |
| Исключено текущее `selectedPlace` | Сброс выбора места/слота + пользовательское уведомление |
| Расхождение вкладки и нового поиска | `catalogRevision` + сброс recommendation view |

## 7. Риски рендеринга

- Не подписывать всю страницу на весь store — точечные селекторы.  
- Список сообщений: `FlashList` при росте истории.  
- Стабильные колбэки через actions store.

## 8. Стратегия списка на шагах `places` и `booking`

Единая логика `effectivePlaces` для обоих шагов (когда чат уже менял порядок), чтобы порядок карточек не «прыгал» между шагами. До первого ответа AI используется исходный `placeOptions`.

## 9. Расширяемость провайдера

Интерфейс `AiBookingChatProvider` без упоминания Gemini; адаптер вызывает edge. Опциональный контракт для будущего стрима (`sendTurnStream`) без использования в v1.

## 10. Регрессии (что не ломаем)

- Цепочка `runFlow` → `places` → `booking` → `createBooking` / `createCartItem`.  
- Paywall и auth redirect на странице.  
- Поведение `useAvailableSlots` при смене места/даты.
