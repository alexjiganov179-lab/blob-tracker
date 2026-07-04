# Project Rules

## Cache Busting

- When changing `online-version/styles.css`, `online-version/app.js`, `online-version/effects.js`, or `online-version/export.js`, also update the matching `?v=...` query string in `online-version/index.html`.
- Browser cache can otherwise keep executing old JS/CSS while the new HTML is visible, which makes UI changes look broken.
- After a change, verify DevTools loads the expected version, for example `app.js?v=<new-version>` or `styles.css?v=<new-version>`.
