# Egress weekly log — Pixap

Копируйте строку раз в неделю. Источник: [Supabase Usage](https://supabase.com/dashboard/org/_/usage) (проект pix).

| Week ending | Cached egress (GB) | Non-cached egress (GB) | MAU | GB cached / MAU | Storage (GB) | Notes |
|-------------|-------------------|------------------------|-----|-----------------|--------------|-------|
| 2026-05-20 (baseline) | 21.6 | ~1 | 18 | 1.20 | 0.04 | до P0, Free grace |
| | | | | | | |
| | | | | | | |

## Dev snapshot (optional)

Дата сессии: __________  
`transformFlagEnabled`: __________  
`renderSharePercent`: __________  
`totalRequests` (dev session): __________  
Top buckets: __________  

Metro log tag: `[storage-egress] snapshot`

## Actions this week

- [ ] Cached egress < 2 GB?
- [ ] render share > 70% in dev?
- [ ] Any `.mp4` thumb downloads in chat?
- [ ] PostgREST spike? → feed/messages polling
