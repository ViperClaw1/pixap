# App Store Connect и Google Play — чеклист перед первой подачей

Документ для действий **вне кодовой базы**. Кодовые требования (Report/Block, EULA, AI consent, targetSdk 35) реализованы в репозитории.

---

## App Store Connect

### 1. App Review Information — demo-аккаунт

1. Создайте тестовый аккаунт **после** деплоя миграций UGC/EULA (иначе signup flow может отличаться).
2. Email/пароль без 2FA на период ревью.
3. Заполните профиль: avatar, username, имя.
4. Создайте контент: 2–3 stories, 2–3 posts, комментарии, 1 DM, 1 бронирование.
5. В **App Review Information**:
   - Sign-in required: **Yes**
   - Username + Password
   - Notes (English):

     ```
     Open app → Sign In with provided credentials.
     Feed tab: posts and stories with Report/Block (⋯ menu).
     Messages tab: Support chat at top; direct messages with swipe-to-report.
     Profile tab: subscription, privacy, terms links.
     AI Booking: from home/booking flow; first AI use shows Google Gemini consent.
     ```

### 2. App Privacy (Nutrition Labels)

Заполните декларацию строго по фактическому поведению:

| Категория | Linked to user | Purpose |
|-----------|----------------|---------|
| Contact Info (email, username) | Yes | App Functionality |
| User Content (posts, messages, comments) | Yes | App Functionality |
| Photos/Videos | Yes | App Functionality |
| Location (approximate, geocoding) | Yes | App Functionality |
| Identifiers (push token, device token) | Yes | App Functionality |
| Purchases (IAP subscription) | Yes | App Functionality |

**SDK:** Supabase (backend), Expo (push, media picker), react-native-iap. Проверьте privacy manifests в артефакте EAS build.

**AI disclosure:** в Privacy Policy указать передачу текста бронирования в Google Gemini.

### 3. Support contact

- **Support URL / Marketing URL:** `https://pixapp.kz` или dedicated support page
- **Support email:** мониторимый адрес (например `support@pixapp.kz`)
- In-app support chat уже есть в Messages → Support

### 4. Restore Purchases

Уже реализовано на экране Subscription Paywall — дополнительных действий не требуется.

---

## Google Play Console

### 1. Target API Level

В коде зафиксировано `targetSdkVersion: 35` в `app.config.ts`. После `eas build --platform android` проверьте `android/build.gradle` в артеfact.

### 2. UGC declaration

- Report + Block реализованы в UI
- Назначьте 1–2 admin (`profiles.account_role = admin`)
- SLA: проверка `content_reports` со status `pending` в Supabase Dashboard в течение 24–48 ч
- Play Console → App content → заполните UGC policy declaration

### 3. Generative AI

- AI-ответы помечены badge «AI-generated»
- Report AI response через меню на assistant bubbles
- Consent modal перед первым использованием PixAI (Google Gemini)

---

## Юридические документы на сайте (pixapp.kz)

Опубликовать **до** сабмита:

| URL | Содержание |
|-----|------------|
| `https://pixapp.kz/privacy` | Privacy Policy (RU): данные, AI sharing, регион Supabase/AWS, права пользователя |
| `https://pixapp.kz/terms` | Terms of Service / EULA: запрещённый контент, модерация 24–48h |
| `https://pixapp.kz/community-guidelines` | Community Guidelines |

Приложение ссылается на эти URL из signup, profile и Terms gate.

---

## География и право (без кода)

| Рынок | Действие |
|-------|----------|
| **KZ (основной)** | Privacy/Terms на RU; юридическое заключение по transborder data (Supabase/AWS); kk — отдельная фаза |
| **RU** | Не таргетировать без локализации данных |
| **CN** | Не таргетировать |
| **EU** | Подписать DPA с Supabase; GDPR-раздел в Privacy Policy |
| **AU** | На старте не таргетировать или указать 17+ в review notes |

---

## После деплоя миграций

```bash
supabase db push
# или apply migrations через CI
```

Проверьте smoke-test:

- [ ] Report → запись в `content_reports`
- [ ] Block → контент исчезает из feed/inbox
- [ ] Signup без checkbox EULA блокируется
- [ ] OAuth/login без `terms_accepted_at` → Terms gate modal
- [ ] AI booking без consent → modal; decline скрывает чат
- [ ] Android build targetSdk 35
