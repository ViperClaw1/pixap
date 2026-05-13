# IMAGE_RUNTIME_LATENCY_REPORT

## Executive summary

На устройстве POCO C71 по сценарию из [`LIST_PERFORMANCE_REPORT.md`](./LIST_PERFORMANCE_REPORT.md) метрики кадров уже в здоровом диапазоне: узкое место воспринимаемой «тяжести» смещено к **медиа-пайплайну** (сеть, decode, попадание в кэш expo-image, момент prefetch и длительность `transition`), а не к виртуализации списков.

Эта фаза разводит **метрики рендера списков** (FPS, frame pacing) и **метрики медиа-латентности** (cache key стабильность, размер payload, prefetch до смены слайда, короче fade-in). Ниже — правила и аудит; в код внесены точечные правки без архитектурных переписываний и без массовой миграции на FlashList.

## Cache-hit analysis

### Правила

- Для `expo-image` без кастомного `cacheKey` ключ кэша совпадает с **фактической строкой URI** после нормализации в компоненте (см. комментарий в `SmartImage`).
- Любое изменение query string (`width`, `height`, `quality`, параметры Unsplash) даёт **новый ключ** → отдельная загрузка и decode.
- Переход с оптимизированного transform на **сырой** `fallbackUri` — это **другой** запрос и другой ключ, даже если визуально картинка та же.

### Риски из кода (до правок)

- Дробные `width`/`height` в логических пикселях без квантования → при микродвижениях layout/DPR строка render-URL меняется → лишние cache miss на Supabase `render/image` и Unsplash.
- Разные поверхности с разными парами размеров для одной и той же роли медиа → дубли в кэше.
- Длинный `transition` на каруселях списка и fullscreen → ощущение «картинка появилась поздно», даже при быстром decode.

### Рекомендации (принятые в коде)

- Единый helper **`quantizeDecodePx`** в [`src/shared/lib/imageUtils.ts`](./src/shared/lib/imageUtils.ts) для бакетизации decode-размеров (шаг 64, минимум 128 по умолчанию в helper).
- Лента постов уже квантовала размеры VM; **StorySlide** и **PlaceGallery** переведены на **DPR × layout + quantize** для стабильных URL на fullscreen-путях.
- Архив сетки использует тот же экспорт `quantizeDecodePx` (раньше была локальная копия с `min=96` — унификация снижает расхождение правил).

## Payload analysis

| Поверхность | Источник размеров / quality | Примечание |
|-------------|-----------------------------|------------|
| Feed card — карусель / одно фото | `optimizedPostImageSize` из `width`×`sliderHeight`×DPR + `quantizeDecodePx`, quality **78** | URL стабильны в рамках бакета. |
| FeedStoryViewer (лента stories) | Фиксированно **1080×1920**, quality **78** | Стабильный ключ для fullscreen в viewer. |
| Story viewer (`StorySlide`) | `max(720, width×DPR)` × `max(1200, height×DPR)` после `quantizeDecodePx`, quality **78** | Замена сырых layout px на бакеты по DPR. |
| Архив — thumb | `gridTileWidth/Height` × DPR + `quantizeDecodePx`, quality **72** | Как в `StoriesArchivePage` / `gridItems`. |
| Place gallery | `max(960, quantize(width×DPR))` × `max(1600, quantize(height×DPR))`, quality **78** | Вместо жёстких 1280×2200 — ближе к экрану, стабильнее ключ при смене ориентации/инсетов. |

### Пути без transform

В [`getOptimizedImageUrl`](./src/shared/lib/imageUtils.ts): для URL **не** из Supabase public storage и **не** `images.unsplash.com` возвращается исходная строка — без изменения query. Видео по расширению в path также возвращается исходный URL (без render API).

## Preload strategy report

### Текущая реализация `preloadSmartImages`

[`SmartImage.tsx`](./src/shared/ui/smart-image/SmartImage.tsx): жёсткий cap **12** URI, параллельность **4** (`Promise.allSettled` батчами).

### Где вызывается prefetch

| Место | Поведение после правок |
|-------|-------------------------|
| **StoriesFeedPage** — hero первых постов | `InteractionManager.runAfterInteractions` — не конкурирует с первым кадром после открытия модалки/экрана. |
| **PostMediaCarousel** | При смене `activeIndex` — соседи **±1** (и raw при отличии от primary), после interactions. |
| **FeedStoryViewerPage** | По-прежнему **±2** плоских сторис; обёрнуто в **`runAfterInteractions`**. |
| **StoriesArchivePage** | Только при **`tab === "grid"`**; near-visible **`viewportRows + 2`** строк × 3 колонки; после interactions. |
| **PlaceGalleryPage** | Новый prefetch **activeIndex ±1** с теми же decode-размерами, после interactions. |

Цель: следующий слайд/ряд **успевает** попасть в очередь prefetch до жеста, не блокируя при этом первый committed frame.

## Decode / transition tuning

| Компонент | Было (ориентир) | Стало |
|-----------|------------------|-------|
| Карусель медиа в ленте (`PostMediaCarousel`) | `transition={200}` | **85** ms |
| Одно фото в карточке ленты | `transition={200}` | **85** ms |
| `FeedStoryViewerPage` — основной слайд | не задано (дефолт expo-image) | **90** ms |
| Модалка превью в FeedStoryViewer | не задано | **100** ms |
| `StorySlide` | **120** ms | **80** ms |
| `PlaceGalleryPage` | **220** ms | **100** ms |

**Placeholders / blurhash:** в типичных story/post данных blurhash в цепочке не протаскивался — отдельное подключение без поля в API не делалось; миниатюры архива по-прежнему с `transition={0}` в `StoryArchiveGridThumb`.

## Perceptual before / after

### Шаблон субъективной оценки (POCO C71, release)

Оценить по шкале 1–5 (1 — плохо, 5 — отлично) **до** и **после** сборки с изменениями этой фазы.

| Критерий | Before (заполнить на устройстве) | After (заполнить на устройстве) |
|----------|----------------------------------|----------------------------------|
| Blank flash при свайпе карусели в ленте | | |
| Задержка fade до полного кадра (feed carousel) | | |
| Отзывчивость свайпа в FeedStoryViewer | | |
| Появление thumb при быстром скролле архива (grid) | | |
| Первый кадр Place Gallery при открытии и свайпе | | |

### Smoke checklist (без регрессии list FPS)

Повторить сценарий из [`LIST_PERFORMANCE_REPORT.md`](./LIST_PERFORMANCE_REPORT.md): **30 s агрессивный скролл ленты + переходы в stories** — убедиться, что `avg_frame_ms` / `p95_frame_ms` не хуже baseline более чем на шум измерения.

### Кодовые изменения (кратко)

- `src/shared/lib/imageUtils.ts` — экспорт `quantizeDecodePx`.
- `src/pages/stories-feed/ui/StoriesFeedPage.tsx` — hero preload и carousel neighbor preload через `InteractionManager`; transition **85**.
- `src/pages/stories-archive/ui/StoriesArchivePage.tsx` — preload только grid, **`+2`** строки, `InteractionManager`; импорт общего `quantizeDecodePx`.
- `src/pages/feed-story-viewer/ui/FeedStoryViewerPage.tsx` — preload после interactions; transition на слайде и в модалке.
- `src/components/stories/StorySlide.tsx` — стабильные decode размеры (DPR + quantize); transition **80**.
- `src/pages/place-gallery/ui/PlaceGalleryPage.tsx` — decode размеры по экрану, preload ±1, transition **100**.
