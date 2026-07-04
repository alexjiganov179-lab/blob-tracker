# Contributing to blob-tracker

Thanks for your interest in the project! blob-tracker is a browser-based,
real-time contour/VFX overlay editor for videos. It is open source and free,
and contributions are welcome — under the maintainer's review.

This file has two parallel versions: **English** first, **Русский** below.

---

## English

### Ways to contribute

- **Report a bug** — open an issue using the *Bug report* template.
- **Suggest a feature** — open an issue using the *Feature request* template.
- **Improve code or docs** — open a pull request (PR) against the `master`
  branch. The maintainer reviews and merges every PR.

### Before you start coding

1. **Search existing issues** to avoid duplicates.
2. For anything beyond a small fix, **open an issue first** to discuss the
   approach. This avoids wasted work on changes that may not fit the roadmap.
3. The project has **no build step** — `online-version/` is plain HTML/CSS/JS.

### Local setup

Requirements: [Node.js](https://nodejs.org/) 18+ and Chrome or Edge.

```bash
git clone https://github.com/alexjiganov179-lab/blob-tracker.git
cd blob-tracker
cd tests/js
npm install
npx playwright install chromium
cd ../..
# Open the app:
#   just open online-version/index.html in Chrome/Edge, or serve the folder.
```

### Running the tests

The test suite covers 7 export scenarios (82 assertions):

```bash
node tests/js/run-online-tests.mjs --scenario all
```

Your PR **must keep this green**. CI runs the same command on every push.

### Code conventions

- **No build step, no transpiler, no framework.** Vanilla JS modules loaded
  via `<script>` and an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap).
- **Primary surface is `online-version/`.** The root `index.html` is the legacy
  single-file version and only receives critical fixes.
- **Bilingual UI strings** — new user-facing text needs both `en` and `ru` keys
  in the `TEXT` dictionary (`online-version/index.html`).
- **Cache-busting rule** (important): when you change `online-version/styles.css`,
  `app.js`, `effects.js`, or `export.js`, also bump the matching `?v=...` query
  string in `online-version/index.html`. Otherwise browsers keep running the
  old cached file and your change looks broken.
- **No comments** unless a non-obvious decision needs explaining.

### Pull request checklist

- [ ] Tests pass: `node tests/js/run-online-tests.mjs --scenario all`
- [ ] If you changed `styles.css` / `app.js` / `effects.js` / `export.js`, you
      bumped the `?v=...` string in `online-version/index.html`
- [ ] New UI text has both `en` and `ru` translations
- [ ] Commit message follows the existing style (`feat:`, `fix:`, `docs:`,
      `chore:`, `refactor:`)

### Licensing

By contributing, you agree your changes are licensed under the project's
[MIT license](./LICENSE). Third-party dependencies retain their own licenses
(Mediabunny is MPL-2.0; OpenCV.js is Apache-2.0).

---

## Русский

### Как можно помочь

- **Сообщить о баге** — откройте issue шаблоном *Bug report*.
- **Предложить фичу** — откройте issue шаблоном *Feature request*.
- **Улучшить код или доку** — откройте pull request (PR) в ветку `master`.
  Каждый PR ревьюит и мёрджит мейнтейнер.

### Перед тем как писать код

1. **Поищите среди существующих issues** — возможно, уже предложено.
2. Для чего-то крупнее мелкого фикса — **сначала откройте issue для обсуждения**,
   чтобы не делать работу, которая может не подойти по роадмапу.
3. Сборки **нет** — `online-version/` это чистый HTML/CSS/JS.

### Локальный запуск

Нужны [Node.js](https://nodejs.org/) 18+ и Chrome или Edge.

```bash
git clone https://github.com/alexjiganov179-lab/blob-tracker.git
cd blob-tracker
cd tests/js
npm install
npx playwright install chromium
cd ../..
# Приложение:
#   просто откройте online-version/index.html в Chrome/Edge.
```

### Запуск тестов

Тесты покрывают 7 сценариев экспорта (82 проверки):

```bash
node tests/js/run-online-tests.mjs --scenario all
```

PR **обязан оставаться зелёным**. CI запускает ту же команду на каждый пуш.

### Соглашения по коду

- **Без сборки, без транспилятора, без фреймворка.** Ванильные JS-модули через
  `<script>` и [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap).
- **Основная поверхность — `online-version/`.** Корневой `index.html` —
  устаревшая single-file версия, получает только критические фиксы.
- **Двуязычные строки** — новый текст интерфейса требует ключи `en` и `ru`
  в словаре `TEXT` (`online-version/index.html`).
- **Правило cache-busting** (важно): при изменении `online-version/styles.css`,
  `app.js`, `effects.js` или `export.js` также обновите `?v=...` в
  `online-version/index.html`. Иначе браузер гоняет старый закэшированный файл,
  и правка выглядит сломанной.
- **Без комментариев**, если решение не требует пояснения.

### Чеклист pull request

- [ ] Тесты зелёные: `node tests/js/run-online-tests.mjs --scenario all`
- [ ] Если меняли `styles.css` / `app.js` / `effects.js` / `export.js` —
      обновили `?v=...` в `online-version/index.html`
- [ ] Новый текст интерфейса есть на `en` и `ru`
- [ ] Коммит по стилю (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)

### Лицензирование

Внося вклад, вы соглашаетесь, что изменения лицензируются под
[MIT-лицензией](./LICENSE) проекта. Сторонние зависимости сохраняют свои
лицензии (Mediabunny — MPL-2.0; OpenCV.js — Apache-2.0).
