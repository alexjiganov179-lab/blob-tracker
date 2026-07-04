# Security Policy

This file has two parallel versions: **English** first, **Русский** below.

---

## English

### Reporting a vulnerability

**Do not open a public GitHub issue for security problems.**

Use GitHub's private vulnerability reporting instead:

1. Go to the repository page on GitHub.
2. Click the **Security** tab.
3. Click **Report a vulnerability**.
4. Fill in the form. Only the maintainer can see it.

This keeps the report private until a fix is released, so attackers cannot
exploit it in the window before the patch.

You can also email the maintainer if GitHub reporting is unavailable, but
please prefer the private report flow — it tracks state and disclosure
timelines automatically.

### Supported versions

Only the latest `master` branch receives security fixes. There are no LTS
releases.

### What is a security issue here?

Blob Tracker is a **fully client-side** app: all video processing happens in
your browser. Nothing is uploaded to any server. Relevant categories:

- A way for a third-party script (loaded from a CDN) to read or exfiltrate a
  user's local video frames.
- Cross-site scripting (XSS) in the app's own HTML/JS.
- A compromised or typosquatted CDN dependency.

Performance issues (the app is slow on huge videos) and "I can crash my own
browser tab with a crafted video" are **not** security issues — they affect
only the local user and cannot be used against anyone else.

### Residual CDN supply-chain risk (accepted)

The app loads OpenCV.js, Mediabunny, and mp4-muxer from third-party CDNs
(jsDelivr, unpkg, docs.opencv.org) at runtime. This is standard for static
browser apps, but it means a compromised CDN could in theory serve malicious
code into the page that processes local video.

Mitigations already in place:

- **Pinned versions** — every CDN URL pins a specific package version
  (`mediabunny@1.49.0`, `@techstark/opencv-js@4.10.0-release.1`,
  `mp4-muxer@5.1.3`). No floating aliases on the primary path.
- **Subresource Integrity (SRI)** on the pinned OpenCV CDN entries — the
  browser refuses to run the script if the hash does not match.
- `docs.opencv.org/4.x/opencv.js` is kept **only** as a last-resort fallback
  (floating URL, no SRI). It triggers only when both pinned CDN entries fail.

Limitations that SRI cannot cover today:

- `<script type="importmap">` (used for Mediabunny) and dynamic `import()`
  (used for mp4-muxer) do **not** support SRI in current browsers. The
  versions are pinned, but not hash-verified.
- Full mitigation = self-hosting reviewed copies of these libraries in a
  `/vendor/` folder plus a strict Content Security Policy. This is tracked as
  a roadmap item, not a blocker for the current release.

---

## Русский

### Сообщение об уязвимости

**Не открывайте публичный GitHub issue для проблем безопасности.**

Используйте приватный отчёт через GitHub:

1. Откройте страницу репозитория на GitHub.
2. Перейдите на вкладку **Security**.
3. Нажмите **Report a vulnerability**.
4. Заполните форму. Сообщение видит только мейнтейнер.

Так отчёт остаётся приватным до выхода исправления, и злоумышленники не могут
воспользоваться им в окне до патча.

Если GitHub-отчёт недоступен, можно написать мейнтейнеру на почту — но
предпочтителен именно приватный отчёт: он сам ведёт таймлайн раскрытия.

### Поддерживаемые версии

Только последняя ветка `master` получает security-фиксы. LTS-релизов нет.

### Что считать проблемой безопасности

Blob Tracker — **полностью клиентское** приложение: вся обработка видео идёт
в вашем браузере, на сервер ничего не уходит. Релевантные категории:

- Способ для стороннего скрипта (с CDN) прочитать или украсть кадры
  локального видео пользователя.
- XSS в собственном HTML/JS приложения.
- Скомпрометированная или тайпосквоттинг-зависимость с CDN.

Тормоза на огромных видео и «могу уронить свою же вкладку хитрым видео» —
**не** security-проблемы: они затрагивают только локального пользователя и
не применимы против других людей.

### Остаточный CDN supply-chain риск (принят)

Приложение грузит OpenCV.js, Mediabunny и mp4-muxer со сторонних CDN
(jsDelivr, unpkg, docs.opencv.org) во время работы. Это стандарт для
статических браузерных приложений, но означает, что при компрометации CDN
вредоносный код теоретически может попасть на страницу, обрабатывающую
локальное видео.

Уже сделанные смягчения:

- **Зафиксированные версии** — каждый CDN-URL фиксирует конкретную версию
  пакета (`mediabunny@1.49.0`, `@techstark/opencv-js@4.10.0-release.1`,
  `mp4-muxer@5.1.3`). Плавающих алиасов на основном пути нет.
- **Subresource Integrity (SRI)** на закреплённых записях OpenCV CDN —
  браузер откажется выполнять скрипт, если хеш не совпал.
- `docs.opencv.org/4.x/opencv.js` оставлен **только** как последний фолбэк
  (плавающий URL, без SRI). Срабатывает лишь когда обе закреплённые
  CDN-записи упали.

Ограничения, которые SRI сегодня не покрывает:

- `<script type="importmap">` (для Mediabunny) и динамический `import()`
  (для mp4-muxer) **не** поддерживают SRI в текущих браузерах. Версии
  зафиксированы, но без проверки хешем.
- Полное закрытие = self-hosting проверенных копий этих библиотек в папке
  `/vendor/` плюс строгий Content Security Policy. Заведено как пункт
  роадмапа, не как блокер текущего релиза.
