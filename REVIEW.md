# Release validation

Desktop preview validation includes TypeScript, unit tests for moderation rules/webhooks/credential encryption, desktop session/navigation tests, embedded database migration and persistence tests, and a production build.

Still required before a general release:

- Validate live Instagram permissions, token refresh, pagination coverage, and reversible moderation against a dedicated test account.
- Automated fixture tests now cover creator decisions during classification, bounded retries, and interrupted platform calls. Live network ambiguity and platform-side outcomes still need dedicated-account validation.
- Complete public-distribution signing and macOS notarization. Native packaged startup checks now pass on Windows x64, Ubuntu x64, Intel Mac and Apple Silicon Mac. These checks do not replace full installer/UI acceptance tests.
- Automatic pre-upgrade backups, downgrade refusal, and database reopen/migration are tested locally. Real upgrades across installed releases still need user acceptance checks.
- Review the full creator onboarding flow with nontechnical users; Meta’s developer registration remains an external setup requirement.

No live Instagram account was used for automated validation. Passing local tests does not establish live platform compatibility or moderation quality.

## 0.1.1 preview evidence

[Native build run](https://github.com/cyberplantae/comment-shield/actions/runs/39169498159) passed on all four targets for commit `c8a93db24dfc6753eeffe49ae880d1810adb0fd5`. Each target ran TypeScript checks, 47 unit/integration tests and 4 desktop tests, then built and launched its packaged engine with isolated data and moderation disabled.

## Restart and upgrade-backup acceptance

On October 20, 2026, the published Apple Silicon 0.1.1 DMG passed an isolated executable check directly from its read-only mounted image. The check opens the app three times: first launch, restart with a saved local-model selection, and a simulated version upgrade. It verifies key reuse, settings persistence, and a readable backup containing the matching encrypted key and settings. Moderation stays disabled throughout.

The native CI smoke script now runs this same sequence on each platform. The simulated upgrade uses the current database with an older version marker; it does not replace an upgrade test from an actual older release, installer acceptance, or visual onboarding tests.
