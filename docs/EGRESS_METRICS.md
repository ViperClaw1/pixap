# P3: метрики Cached Egress и PostgREST

Еженедельный мониторинг после оптимизаций P0–P2. Проект: **ylcyktbppowabnxuwdrr** (pix).

---

## 1. Supabase Dashboard (обязательно раз в неделю)

Откройте [Usage](https://supabase.com/dashboard/org/_/usage) → проект **pix**.

| Метрика | Где смотреть | Цель (18 MAU) |
|---------|----------------|---------------|
| **Cached Egress** | Usage → Cached Egress | **< 1–2 GB / мес** |
| **Egress (non-cached)** | Usage → Egress | стабильно < 5 GB |
| **MAU** | Usage → MAU | для расчёта GB/MAU |
| **Storage size** | Usage → Storage | справочно |

Заполните шаблон: [`scripts/egress-weekly-log.md`](../scripts/egress-weekly-log.md)

### Алерт 80% (п. 12)

1. Organization → **Billing** → убедитесь, что на **Pro** и Spend Cap настроен осознанно.
2. Usage → при **> 80%** cached quota — зафиксировать в логе и ускорить аудит Storage.
3. Email от Supabase — не игнорировать (grace / Fair Use).

**Spend Cap:**  
- **On** — при превышении квоты снова возможны restrictions.  
- **Off** — платите overage (~$0.09/GB cached сверх 250 GB на Pro).

---

## 2. Storage paths (топ потребители)

Dashboard → **Logs** → **Storage** (или Edge Logs с фильтром path).

Ищите частые префиксы:

- `/storage/v1/render/image/public/stories/` — OK после transforms  
- `/storage/v1/object/public/stories/` — полный размер (плохо в ленте)  
- `.mp4` — видео без poster  
- `/avatars/`, `/business-cards/`

Либо SQL (объём в бакете, не egress):

```bash
supabase db query --file supabase/smoke/storage_objects_size_audit.sql
```

---

## 3. Dev-сессия в приложении (`__DEV__`)

Счётчик в `storageEgressMetrics.ts` — все `SmartImage` + `preloadSmartImages` на Supabase URL.

### Как снять snapshot

1. `npx expo start` с `EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM=1` в `.env`.
2. Пройти сценарий: лента → сторис → чат с фото → профиль.
3. Свернуть приложение — в Metro появится `[storage-egress] snapshot` JSON.
4. Каждые ~80 запросов — промежуточный snapshot.

### Поля snapshot

| Поле | Значение |
|------|----------|
| `transformFlagEnabled` | должен быть `true` |
| `renderSharePercent` | **> 70%** в ленте после P0.1 |
| `prefetchRequests` | следить за ростом при скролле |
| `byBucket` | stories / avatars / business-cards |

Если `renderSharePercent` низкий при `transformFlagEnabled: true` — пересоберите bundle (`expo start -c`) или проверьте 403/fallback.

### Программный сброс

В Dev Menu / консоли: импорт `resetStorageEgressMetrics()` из `@/shared/lib/storageEgressMetrics`.

---

## 4. Smoke-скрипты

```powershell
# Transforms (ожидается 200)
.\scripts\smoke-supabase-image-transform.ps1
```

---

## 5. Ориентиры «до / после»

| Период | Cached Egress | MAU | GB/MAU | Примечание |
|--------|---------------|-----|--------|------------|
| До P0 (май 2026) | ~21.6 GB | 18 | ~1.2 | превышение Free |
| После P0–P2 | _заполнить_ | _ | _ | transforms + prefetch + cache |

**GB/MAU** = Cached Egress GB ÷ MAU — удобно сравнивать недели.

---

## 6. Быстрый health-check в прод-сборке

Transforms и метрики dev-only. В production проверяйте только Dashboard Usage.

При регрессии egress:

1. Usage breakdown (Storage vs PostgREST)  
2. `render` vs `object` в логах Storage  
3. Чеклист [`CACHED_EGRESS_CHECKLIST.md`](./CACHED_EGRESS_CHECKLIST.md)
