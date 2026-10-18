# Release validation

Desktop preview validation includes TypeScript, unit tests for moderation rules/webhooks/credential encryption, desktop session/navigation tests, embedded database migration and persistence tests, and a production build.

Still required before a general release:

- Validate live Instagram permissions, token refresh, pagination coverage, and reversible moderation against a dedicated test account.
- Automated fixture tests now cover creator decisions during classification, bounded retries, and interrupted platform calls. Live network ambiguity and platform-side outcomes still need dedicated-account validation.
- Complete signed and notarized macOS distribution, and native testing on Windows/Linux before distributing those builds.
- Automatic pre-upgrade backups, downgrade refusal, and database reopen/migration are tested locally. Real upgrades across installed releases still need user acceptance checks.
- Review the full creator onboarding flow with nontechnical users; Meta’s developer registration remains an external setup requirement.

No live Instagram account was used for automated validation. Passing local tests does not establish live platform compatibility or moderation quality.
