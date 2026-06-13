# Railway: persistent uploads (аватары, картинки лендинга)

Volume на **Postgres** (`/var/lib/postgresql/data`) хранит только БД. Файлы лежат отдельно.

## Настройка

1. Сервис **API** (DEMO studio / AIDA backend) → **Settings → Volumes**.
2. Создать volume, **Mount path:** `/aida_volume` (как у вас).
3. **Variables** того же сервиса:
   ```
   UPLOAD_DIR=/aida_volume
   BASE_URL=https://demo-studio-production.up.railway.app
   ```
   (`BASE_URL` — ваш публичный URL API без слэша в конце.)
4. **Redeploy** сервиса API.

## Проверка

1. Загрузить фото (аватар мастера или `POST /upload/landing`).
2. Открыть URL из ответа → **200**.
3. Ещё раз **Redeploy** → тот же URL снова **200** (файл не пропал).

## Старые файлы

После ephemeral-диска старые URL в БД могут отдавать **404** — аватары нужно **перезалить** в CRM.

## Локальная разработка

`UPLOAD_DIR` не задавать — файлы в `./uploads`.
