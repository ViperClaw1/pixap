# Phase 14 — инструменты производительности

Проект **Expo SDK 54 / RN 0.81**: Hermes включён по умолчанию для production. Ниже — как подключать инструменты **без обязательной установки** тяжёлых пакетов в CI (безопасный минимум).

## 1. Hermes profiling

**Зачем:** CPU/allocations на JS thread (Hermes).

**Как:**

1. Сборка release или dev с Hermes (по умолчанию в Expo).
2. Metro: при необходимости `npx expo start` и подключение Chrome к Hermes (`jsc` не используется).
3. Документация: [React Native — Hermes](https://reactnative.dev/docs/hermes).

**Риск:** низкий; не требует изменений в репозитории.

## 2. Flipper

**Статус:** в новых версиях RN интеграция Flipper **опциональна** и часто отключена в шаблонах Expo.

**Рекомендация:** для Expo Dev Client использовать **React Native DevTools** и **native Xcode/Android Studio profilers** вместо полного Flipper, если нет явной потребности в плагинах Flipper.

**Риск добавления Flipper в приложение:** средний (нативные зависимости, размер, обслуживание).

## 3. React DevTools Profiler

**Как:** установить `react-devtools` глобально или `npx react-devtools`, запустить приложение, подключиться к bundler.

**Риск:** нулевой для продакшн-бандла (dev-only).

## 4. Reassure

**Назначение:** регрессионные замеры рендера в Jest.

**Статус в репозитории:** основной раннер тестов не унифицирован под Jest (`vitest` упоминается depcheck для отдельного файла).

**Безопасное действие:** не добавлять Reassure в CI до появления стабильного `jest`/`reassure` пайплайна; при необходимости — `npm i -D reassure` + конфиг по [документации Reassure](https://callstack.github.io/reassure/).

## 5. Sentry Performance

**Назначение:** транзакции, spans, релизы, ошибки.

**Безопасное внедрение:**

1. Завести проект Sentry, DSN только в `EXPO_PUBLIC_SENTRY_DSN` (или секрет EAS).
2. `npx expo install @sentry/react-native` и следовать [Sentry Expo wizard](https://docs.sentry.io/platforms/react-native/manual-setup/expo/).
3. Инициализация за флагом `if (!__DEV__ && Constants.expoConfig?.extra?.sentryDsn)` чтобы не шуметь в dev.

**Риск:** средний (нативный модуль, source maps, билд-тайм). **В этой фазе пакет не добавлен** — только инструкция.

## 6. Уже полезное в кодовой базе

- Отложенный старт тяжёлых задач: [`App.tsx`](App.tsx) (`InteractionManager` для deep links и т.д.).
- Bundle baseline: [`bundle-baseline.json`](../bundle-baseline.json) после `expo export`.

## 7. Рекомендуемый порядок внедрения

1. React DevTools Profiler на горячих экранах (лента, карта, сторис).
2. Hermes sampling при жалобах на jank.
3. Sentry при готовности к нативным изменениям и DSN.
4. Reassure — после стандартизации unit-тестов.
