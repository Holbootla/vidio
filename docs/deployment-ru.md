# Запуск и деплой бэкенда Vidio (простая инструкция)

Это пошаговая инструкция: как запустить бэкенд **локально** и как **выложить в
прод** с автоматическим обновлением через GitHub (CI/CD).

Всё, что можно было сделать за вас (Dockerfile, docker-compose, конфиг Fly.io,
GitHub Actions), уже готово в репозитории. Ниже отмечено, что нужно сделать
**руками** (значок ✋) и что происходит **автоматически** (значок 🤖).

---

## Коротко: что уже готово в репозитории

- `Dockerfile` — собирает оба приложения (`vidio-api` и `vidio-worker`) в один
  маленький образ.
- `docker-compose.yml` — запуск локально или на своём сервере одной командой.
- `fly.toml` — конфиг для хостинга Fly.io (веб + воркер).
- `.github/workflows/ci.yml` — проверки на каждый push/PR (формат, линтер,
  сборка, тесты).
- `.github/workflows/deploy.yml` — автодеплой в dev/staging/prod.
- `.github/workflows/docker-image.yml` — публикация образа в GitHub Container
  Registry (для варианта «свой сервер»).

---

## Часть 1. Локальный запуск

### Вариант A. Через Docker (проще всего)

Нужен установленный **Docker** (с Docker Compose).

1. ✋ Сгенерируйте секрет для токенов (нужен один раз, минимум 32 байта):

   ```bash
   openssl rand -base64 48
   ```

2. ✋ Запустите бэкенд, подставив этот секрет:

   ```bash
   VIDIO_ACCESS_TOKEN_SECRET="сюда-вставьте-секрет" docker compose up --build
   ```

3. 🤖 Соберётся образ и поднимутся два сервиса: `api` (порт 8080) и `worker`.

4. ✋ Проверьте, что работает:

   ```bash
   curl http://localhost:8080/health
   # Ответ: {"status":"ok"}
   ```

Остановить: `Ctrl+C`, затем при желании `docker compose down`.

### Вариант B. Без Docker (через Rust)

Нужен Rust нужной версии (он указан в `rust-toolchain.toml`, ставится сам через
`rustup`).

1. ✋ Запуск API:

   ```bash
   VIDIO_BIND_ADDR=127.0.0.1:8080 cargo run --bin vidio-api
   ```

   > Если не задать `VIDIO_ACCESS_TOKEN_SECRET`, для локальной разработки
   > используется небезопасный тестовый секрет — это нормально для локали, но
   > **нельзя** в проде.

2. ✋ (по желанию, в другом окне) Запуск воркера:

   ```bash
   cargo run --bin vidio-worker
   ```

### Быстрая проверка API (регистрация и вход)

```bash
# Регистрация
curl -X POST http://localhost:8080/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"supersecret"}'

# Вход (вернёт access_token и refresh_token)
curl -X POST http://localhost:8080/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"supersecret"}'
```

> Важно: сейчас данные хранятся **в памяти** (in-memory). После перезапуска они
> пропадают. Постоянное хранилище (PostgreSQL) — следующий шаг разработки.

---

## Часть 2. Прод: деплой с CI/CD из GitHub

### Как устроен CI/CD (архитектура)

Используем **три окружения** и простую схему «ветки + теги»:

| Что вы делаете в Git            | Куда деплоится   | Приложение на Fly.io |
| ------------------------------- | ---------------- | -------------------- |
| `git push` в ветку `develop`    | dev (тест)       | `vidio-dev`          |
| `git push` в ветку `main`       | staging (превью) | `vidio-staging`      |
| Создать тег `vX.Y.Z` (из `main`)| production (прод)| `vidio-prod`         |

Логика:

- **`develop`** — ежедневная работа, быстрый тест на живом сервере.
- **`main`** — стабильная версия для проверки перед продом (превью).
- **тег `v1.2.3`** — осознанный релиз в прод (прод обновляется только по тегу,
  случайно не сломать).

Что происходит 🤖 автоматически при каждом push/теге:

1. `ci.yml` — проверяет формат, линтер (clippy), сборку и тесты.
2. `deploy.yml` — Fly.io сам собирает Docker-образ (флаг `--remote-only`, ваш
   компьютер не нужен) и выкатывает его в нужное приложение методом «rolling»
   (без простоя).

Про **воркер и периодические задачи**: воркер (`vidio-worker`) запускается как
отдельная «process group» в том же приложении Fly и работает постоянно, со своим
внутренним таймером (сейчас раз в 60 секунд). Отдельный внешний cron не нужен.
Когда появятся конкретные задачи по расписанию (обновление манифестов,
очистка сессий), их можно добавить прямо в воркер или как «scheduled machines»
в Fly.

### Что нужно сделать РУКАМИ (один раз)

#### Шаг 1. ✋ Аккаунт Fly.io и установка flyctl

1. Зарегистрируйтесь на <https://fly.io> (Fly попросит привязать карту — есть
   недорогой мелкий тариф).
2. Установите консольную утилиту `flyctl`:

   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

3. Войдите:

   ```bash
   fly auth login
   ```

#### Шаг 2. ✋ Создайте три приложения

Имена на Fly.io **глобально уникальны**. Если имя занято — придумайте своё
(например, `vidio-ivan-dev`) и тогда поправьте имена в файле
`.github/workflows/deploy.yml` (шаг «Resolve target app»).

```bash
fly apps create vidio-dev
fly apps create vidio-staging
fly apps create vidio-prod
```

#### Шаг 3. ✋ Задайте секреты для каждого приложения

Сгенерируйте **разные** секреты для каждого окружения:

```bash
fly secrets set VIDIO_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" --app vidio-dev
fly secrets set VIDIO_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" --app vidio-staging
fly secrets set VIDIO_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" --app vidio-prod
```

> Секреты хранятся у Fly и **не** попадают в код. Их не нужно нигде коммитить.

#### Шаг 4. ✋ Дайте GitHub право деплоить в Fly

1. Получите токен доступа:

   ```bash
   fly auth token
   ```

2. В GitHub-репозитории: **Settings → Secrets and variables → Actions →
   New repository secret**.
   - Имя: `FLY_API_TOKEN`
   - Значение: токен из предыдущей команды.

#### Шаг 5. ✋ (рекомендуется) Настройте окружения в GitHub

**Settings → Environments** — создайте три окружения: `dev`, `staging`,
`production`. Для `production` включите **Required reviewers** (тогда прод-деплой
пойдёт только после вашего подтверждения — защита от случайного релиза).

#### Шаг 6. ✋ Создайте ветку `develop`

```bash
git checkout main
git checkout -b develop
git push -u origin develop
```

### Как теперь обновлять прод (ежедневная работа)

🤖 После разовой настройки всё делается обычным git:

```bash
# 1) Работаете и льёте в develop -> автоматически едет в dev
git push origin develop

# 2) Проверили — сливаете в main -> автоматически едет в staging (превью)
git checkout main && git merge develop && git push origin main

# 3) Готовы к релизу -> ставите тег -> едет в прод
git tag v0.1.0
git push origin v0.1.0
```

Можно также запустить деплой вручную кнопкой: вкладка **Actions → Deploy →
Run workflow** и выбрать окружение.

### Проверка после деплоя

```bash
curl https://vidio-prod.fly.dev/health
```

Логи и статус:

```bash
fly logs --app vidio-prod
fly status --app vidio-prod
```

### Стоимость и масштабирование (полезно знать)

- В `fly.toml` для веба стоит `min_machines_running = 1` (всегда включён, без
  «холодного старта»). Для экономии на dev можно уменьшить до 0 — тогда сервис
  засыпает без трафика.
- Масштабировать число машин:

  ```bash
  fly scale count api=2 worker=1 --app vidio-prod
  ```

---

## Альтернатива: свой сервер (VPS) вместо Fly.io

Если хотите свой сервер, а не Fly.io:

1. 🤖 На каждый push в `main` и на теги в GitHub Container Registry публикуется
   готовый образ (workflow `docker-image.yml`):
   `ghcr.io/ВАШ_АккаунтGitHub/vidio:edge` (и `:vX.Y.Z`).
2. ✋ На сервере установите Docker и запустите образ, например через
   `docker compose` (файл уже есть в репозитории) или напрямую:

   ```bash
   docker run -d --name vidio-api -p 8080:8080 \
     -e VIDIO_ACCESS_TOKEN_SECRET="$(openssl rand -base64 48)" \
     ghcr.io/ВАШ_АккаунтGitHub/vidio:edge
   ```

3. ✋ Для автообновления на сервере можно поставить, например,
   [watchtower](https://containrrr.dev/watchtower/) — он будет сам подтягивать
   новый образ. Либо добавить в CI шаг деплоя по SSH.

> На Fly.io этот образ из ghcr не нужен — там Fly собирает образ сам.

---

## Итоговая таблица секретов и переменных

| Где                | Имя                          | Зачем                                   | Кто задаёт |
| ------------------ | ---------------------------- | --------------------------------------- | ---------- |
| Fly (каждое app)   | `VIDIO_ACCESS_TOKEN_SECRET`  | Подпись токенов входа (≥ 32 байт)       | ✋ вы       |
| GitHub (Actions)   | `FLY_API_TOKEN`              | Право GitHub деплоить в Fly             | ✋ вы       |
| GitHub (встроено)  | `GITHUB_TOKEN`               | Публикация образа в ghcr.io             | 🤖 авто    |

Прочие настройки (необязательные, со значениями по умолчанию) описаны в
`.env.example`: время жизни токенов, таймаут и лимит ответа аддонов и т.д.

---

## Короткий чеклист «сделать руками»

- [ ] Установить Docker (для локали) / Rust — по желанию.
- [ ] Зарегистрироваться на Fly.io, поставить `flyctl`, `fly auth login`.
- [ ] `fly apps create` для `vidio-dev`, `vidio-staging`, `vidio-prod`.
- [ ] `fly secrets set VIDIO_ACCESS_TOKEN_SECRET=...` для всех трёх.
- [ ] Добавить `FLY_API_TOKEN` в GitHub Secrets.
- [ ] (Рекомендуется) Создать GitHub Environments и защиту для `production`.
- [ ] Создать ветку `develop`.
- [ ] Дальше — просто `git push` (develop/main) и теги `vX.Y.Z` для прода.

Всё остальное (сборка образа, тесты, выкатка) делается автоматически. 🤖
