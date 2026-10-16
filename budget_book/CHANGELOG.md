# Changelog

## 1.2.6 (ctes fork)

- Add optional meal/channel inputs for dining transactions, with a separate description.
- Preserve unchanged legacy notes and keep dining metadata when editing descriptions.
- Keep draft content across category/type switches and clear it when reopening a form.
- Validate edited dining metadata and keep Save accessible on mobile.
- Share all changes across HACS and add-on; storage format is unchanged.

## 1.2.5 (ctes fork)

- Add monthly dining totals grouped and filtered by meal and optional channel.
- Recognize conservative legacy meal notes without rewriting stored transactions.
- Preserve the existing note/export/storage contract and render note/channel text safely.
- Share the new frontend helper across HACS and add-on, with codec and storage regression checks.

## 1.2.4 (ctes fork)

- Preserve the configured recurring day, falling back only to the actual month end.
- Refresh HA sensors at local midnight and use the configured HA calendar.
- Add explicit-book `budget_book.get_book` response action for independent clients.
- Bundle Chart.js for the HACS panel as well as the add-on.
- Refuse to overwrite invalid existing integration storage with an empty ledger.

## 1.2.3

- Add root-level HACS brand assets (`brand/icon.png`, `brand/icon@2x.png`, `brand/icon.svg`) so the HACS repository list can show the Budget Book icon.

## 1.2.2

- Allow the HACS integration and Supervisor Add-on to be installed together with shared data.
- Use the HACS integration's HA storage as the shared source of truth when both install targets are present.
- Automatically migrate existing add-on `/data/budget_book.json` data into the integration when the integration is empty.
- Preserve timestamped local add-on backups before adopting integration data, and keep old-format migration backups.
- Avoid overwriting integration-owned `sensor.budget_book_*` states when the integration is installed.

## 1.2.1

- Sync the Supervisor Add-on version with the HACS integration version.
- Align the add-on sidebar icon/title with the integration sidebar entry.
- Sync the Home Assistant sidebar entry title with Budget Book's Auto/English/繁中/简中 language mode while the panel is open.

## 0.3.0

- Move the add-on into the main `Home-Assistant_Budget-Book` repository so the same repo supports HACS integration and Supervisor Add-on installation.
- Add `shared/core/` plus `scripts/sync_shared_core.py` so shared UI, translations, analytics, sample data, data shape and migration logic are synced into both adapters.
- Keep the add-on ingress API and `/data/budget_book.json` persistence from 0.2.0.

## 0.2.0

- Port the original Budget Book integration (v1.1.4) instead of a rewrite: same panel UI, styles, translations, store, analytics and sample data.
- Restore all original features: multiple books, transaction edit/delete with time, categories, budgets and alerts, charts, recurring entries (daily 09:00 auto-insert), JSON import/export, sample data, Auto/English/繁中/简中 languages.
- Publish the original `sensor.budget_book_*` entities to Home Assistant for automations.
- Bundle Chart.js locally so the panel works offline.
- Migrate data saved by 0.1.0 automatically (backup kept as `budget_book.json.pre-migration`).

## 0.1.0

- Initial Supervisor Add-on release.
- Add public-ready add-on repository structure.
- Add `repository.yaml` and `budget_book/config.yaml`.
- Add standalone Python backend with persistent `/data/budget_book.json` storage.
- Add ingress web UI for basic transaction tracking.
- Add Add-on Store icon and logo assets.
- Add English, Traditional Chinese, and Simplified Chinese repository documentation.
