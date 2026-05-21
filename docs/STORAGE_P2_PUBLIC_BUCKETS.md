# P2: Storage — публичные бакеты и защита

## Решение по п. 9 (публичные бакеты)

**Оставляем `public: true`** для `stories`, `avatars`, `business-cards`, `logo`.

| Альтернатива | Почему не сейчас |
|--------------|------------------|
| Signed URL only | Нужен рефактор всех `getPublicUrl`, Image Transform URLs, deep links; выше latency |
| Private + RLS read | Ломает CDN cache hits без custom edge |

**Снижаем egress без смены модели:**

1. **Image Transformations** (P0.1) — меньший размер ответа CDN.
2. **Cache-Control** на upload (`storageUploadOptions.ts`) — повторные просмотры с устройства/CDN.
3. **Уникальные пути** (`Date.now()` в имени) + `immutable` — безопасно кэшировать год.

### Дальше (по росту MAU)

- Custom Storage domain + мониторинг аномального трафика в Logs.
- Referrer restrictions (если появятся в плане / Cloudflare перед Supabase).
- Rate limit на уровне edge — только с внешним прокси.

## П. 10 — business-cards

- Миграция: `20260525120000_storage_p2_buckets_cache.sql`
- Mobile: `uploadBusinessCardImage` — WebP, long edge 1600, bucket `business-cards`
- `AdminImageUploadPage` подключён к upload

Web-админка вне этого репозитория: при загрузке использовать те же лимиты (WebP, max 1600px, `cacheControl: public, max-age=31536000, immutable`).

## П. 11 — logo в auth email

- Bucket `logo` в миграции + `cacheControl` на `icon.png`
- URL в `authEmailTemplates.ts` без изменений

## Smoke после миграции

```powershell
.\scripts\smoke-supabase-image-transform.ps1   # 200
```
