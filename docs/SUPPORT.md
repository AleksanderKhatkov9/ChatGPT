# CareerBot — руководство для поддержки

CareerBot — локальное приложение для практики технических собеседований. Пользователь пишет в чат, фронтенд стримит ответ бэкенда, бэкенд вызывает модель в Ollama и хранит чаты в MySQL.

Авторизации нет. Таблицы `users`, `roles` и `user_role` есть в схеме, но приложение их не использует.

## Состав

| Часть | Где | Порт по умолчанию |
| --- | --- | --- |
| Интерфейс | `frontend/`, Next.js 15 | 3000 |
| API | `backend/app/`, FastAPI | 8000 |
| Модель | Ollama на той же машине | 11434 |
| Данные | MySQL 8 | 3306 |

Запуск UI: `frontend/app/page.tsx` рендерит `ChatScreen`. Состояние чата живёт в `frontend/hooks/useChatApp.ts`. Запросы к API — в `frontend/lib/api.ts`.

Точка входа API: `backend/app/main.py`, приложение `app`. Маршруты — `backend/app/api/routes.py`.

```text
браузер :3000
  -> frontend/lib/api.ts
  -> FastAPI :8000  (routes -> ChatService)
       -> MySQL          chats, chat_logs
       -> Ollama :11434  /api/tags, /api/chat
```

## Запуск

Нужны Python 3.11+, Node.js 18+, MySQL 8 и запущенный Ollama.

1. Скопировать `backend/.env.example` в `backend/.env` и заполнить доступ к MySQL и URL Ollama. Файл `.env` содержит пароль — в репозиторий его не класть и в тикеты не вставлять.
2. Создать базу скриптом `backend/database/chat.sql`. Скрипт создаёт базу `chatBot`. В `.env.example` и текущем `.env` указано `DB_NAME=careerbot`. Имя в `.env` и имя реальной базы должны совпадать, иначе API отвечает 500 с текстом про подключение к MySQL.
3. Бэкенд, из каталога `backend/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

4. Фронтенд, из каталога `frontend/`:

```bash
npm i
npm run dev
```

Открыть http://localhost:3000. Проверка API: http://127.0.0.1:8000/api/health.

Модель должна быть скачана в Ollama (`ollama pull deepseek-coder:6.7b` или то имя, которое стоит в `DEFAULT_MODEL`). Список моделей в сайдбаре берётся из `GET /api/models`. Имена с суффиксом `:cloud` или `-cloud` отфильтровываются и в чат не принимаются.

## Конфигурация

Читается один раз при старте процесса в `backend/app/config.py` (`load_dotenv` на `backend/.env`). Смена `.env` требует перезапуска uvicorn.

| Переменная | Назначение | Значение по умолчанию в коде |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | Базовый URL Ollama | `http://127.0.0.1:11434` |
| `DEFAULT_MODEL` | Модель, если клиент её не передал | `deepseek-coder:6.7b` |
| `DB_NAME` | Имя базы | `careerbot` |
| `DB_HOST` | Хост MySQL | `127.0.0.1` |
| `DB_USER` | Пользователь MySQL | `root` |
| `DB_PASSWORD` | Пароль MySQL | пустая строка |

Фронтенд ходит на `NEXT_PUBLIC_API_URL`, иначе на `http://127.0.0.1:8000` (`frontend/lib/config.ts`). Переменная читается на этапе сборки Next.js. Выбранная модель пишется в `localStorage` под ключом `careerbot.model`.

CORS на бэкенде открыт для любого origin (`allow_origins=["*"]` в `main.py`).

## Поток сообщения

1. Если чата ещё нет, UI создаёт его через `POST /api/chats`.
2. `POST /api/chats/{id}/messages` с телом `{ "content", "model", "temperature" }`.
3. `ChatService.prepare_user_turn` проверяет текст, пишет сообщение пользователя в `chat_logs` и, если тема ещё «Новый чат» / `new chat` / пустая, переименовывает чат по первой строке (до 80 символов).
4. В модель уходят последние 40 сообщений с ролями `system`, `user`, `assistant`.
5. Ответ идёт как SSE: события `data: {"type":"token","text":"..."}`, затем `{"type":"done"}`. Ошибка до первого токена — `{"type":"error","detail":"..."}`.
6. Накопленный ответ ассистента сохраняется в `chat_logs`, в том числе если поток оборвался после частичного текста.

Ограничения в `chat_service.py`: пустое сообщение — 400; длиннее 32 000 символов — 400; температура по умолчанию `0.7`. Таймаут чтения ответа Ollama — 300 секунд (`backend/app/llm/ollama.py`).

## HTTP API

Живой контракт для UI — пути `/api/chats...`. Старые пути оставлены и фронтендом не вызываются.

| Метод | Путь | Что делает |
| --- | --- | --- |
| `GET` | `/` и `/api/health` | `status`, `message`, `model`, `ollama` |
| `GET` | `/api/models` | Локальные модели Ollama |
| `GET` | `/api/chats` | Список чатов, новые сверху |
| `POST` | `/api/chats` | Создать чат. Тело: `topic`, необязательный `user_id` |
| `PATCH` | `/api/chats/{id}` | Переименовать. Тело: `topic` |
| `DELETE` | `/api/chats/{id}` | Удалить чат, ответ 204 |
| `GET` | `/api/chats/{id}/messages` | История |
| `POST` | `/api/chats/{id}/messages` | Отправить сообщение, ответ `text/event-stream` |
| `POST` | `/api/chat/create` | Устаревшее создание, ответ `{ chat_id, topic }` |
| `POST` | `/api/chat` | Устаревший запрос целиком, ответ `{ reply }` без стрима |
| `GET` | `/api/chat/{id}/logs` | Устаревшая история |

Ошибки приложения возвращаются как `{ "detail": "..." }`:

| Исключение | Код | Когда |
| --- | --- | --- |
| `InvalidChatRequest` | 400 | Пустой текст, слишком длинное сообщение, пустая тема, облачная модель |
| `ChatNotFound` | 404 | Нет чата с таким id |
| `UpstreamError` | 502 | Ollama недоступна, не 200 или пустой ответ на старом `POST /api/chat` |
| `DatabaseError` | 500 | Нет соединения или ошибка SQL |

Во время стрима та же ошибка может прийти событием SSE `type: error`, а не JSON-ответом. Фронтенд показывает её, только если токенов ещё не было (`frontend/lib/api.ts`).

## База

Схема: `backend/database/chat.sql`. Кодировка `utf8mb4`.

Рабочие таблицы приложения:

- `chats` — `id`, `user_id` (обычно `NULL`), `topic`, `created_at`. Колонки `updated_at` нет: список чатов считает её как `MAX(chat_logs.created_at)`, иначе `created_at`.
- `chat_logs` — `chat_id`, `role` (`system` / `user` / `assistant`), `content`, `created_at`. Удаление чата каскадом удаляет сообщения.

Подключение: `backend/app/db.py`, `mysql.connector`, `autocommit=False`. Успешный выход из сессии делает `commit`, исключение — `rollback`. Запросы собраны в `backend/app/repositories/chat_store.py`.

Пользователи и роли в схеме есть, регистрация и вход в коде отсутствуют. `user_id` при создании чата можно передать, но UI его не передаёт, и строки в `users` для этого не создаются. Внешний ключ `chats.user_id` сработает только если такой пользователь уже есть.

## Где менять поведение

| Задача | Файл |
| --- | --- |
| Промпт, лимит истории, фильтр облачных моделей, заголовок чата | `backend/app/services/chat_service.py` |
| Вызов Ollama, таймауты | `backend/app/llm/ollama.py` |
| SQL и форма ответов чата | `backend/app/repositories/chat_store.py` |
| Новые поля запроса | `backend/app/schemas.py`, затем `routes.py` |
| Коды ошибок | `backend/app/errors.py`, таблица `_STATUS` в `main.py` |
| Адрес API и ключ модели в браузере | `frontend/lib/config.ts` |
| Разбор SSE и тексты сетевых ошибок | `frontend/lib/api.ts` |
| Список чатов, отправка, отмена потока | `frontend/hooks/useChatApp.ts` |
| Вёрстка чата | `frontend/components/`, стили `chat.module.scss` |
| Подсветка кода в ответах | `frontend/components/CodeBlock.tsx`, `MessageBody.tsx` |

Слои бэкенда связаны протоколами в `backend/app/contracts.py`: хранилище (`ChatStore`) и клиент модели (`LlmClient`). Замена MySQL или Ollama делается новой реализацией этих протоколов и сборкой в `create_app()`.

## Что проверять при сбое

**«Не удалось связаться с сервером» в интерфейсе.** Фронтенд не достучался до `NEXT_PUBLIC_API_URL` (по умолчанию порт 8000). Проверить, что uvicorn запущен, и что адрес в браузере совпадает с тем, куда смотрит фронтенд (`127.0.0.1` и `localhost` для CORS не мешают, но это разные origin для cookie; cookie приложение не использует).

**500, в `detail` есть `Cannot connect to MySQL`.** MySQL не запущен, неверные `DB_HOST` / `DB_USER` / `DB_PASSWORD`, или `DB_NAME` не совпадает с созданной базой (`chatBot` в SQL и `careerbot` в `.env`).

**502, в тексте есть `Cannot reach Ollama`.** Процесс Ollama не слушает `OLLAMA_BASE_URL`. Проверка: открыть `{OLLAMA_BASE_URL}/api/tags`.

**502 или пустой ответ модели.** Модель из `DEFAULT_MODEL` не скачана, либо имя в запросе не совпадает с `ollama list`. Облачные имена отклоняются ещё на бэкенде с 400.

**Чат есть, ответ обрывается.** Смотреть, дошёл ли `type: done`. Частичный текст ассистента уже может лежать в `chat_logs`. Повторная отправка допишет новую пару user/assistant, старый обрывок не затирается.

**Список чатов пустой после перезапуска.** Данные в MySQL, не в браузере. Пустой список значит другая база, пустая таблица `chats` или ошибка `GET /api/chats` (её текст показывается в UI при загрузке).

**Модель в сайдбаре не та.** Приоритет: сохранённое в `localStorage` значение `careerbot.model`, если оно есть в списке Ollama; иначе `model` из `/api/health`; иначе первая локальная модель. Сброс — очистить этот ключ в браузере.

Быстрая проверка с машины, где крутится API:

```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/models
curl http://127.0.0.1:11434/api/tags
```

Логи запросов пишет uvicorn в консоль процесса бэкенда. Отдельного файла логов в проекте нет.

## Чего в проекте нет

- Входа пользователей, сессий и проверки `password_hash`.
- Ролей на уровне API.
- Очереди, воркеров и фоновых задач: ответ модели считается в том же процессе.
- Тестов и CI.
- Миграций: схема накатывается одним SQL-файлом. Повторный запуск `chat.sql` на существующей базе упрётся в уже созданные индексы.
- Прод-сборки в репозитории. Для UI: `npm run build` и `npm start` в `frontend/`. Для API тот же `uvicorn` без `--reload`, из каталога `backend/`.
