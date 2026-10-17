# Release validation

Desktop preview validation includes TypeScript, unit tests for moderation rules/webhooks/credential encryption, desktop session/navigation tests, embedded database migration and persistence tests, and a production build.

Still required before a general release:

- Validate live Instagram permissions, token refresh, pagination coverage, and reversible moderation against a dedicated test account.
- Verify worker/manual-action concurrency and failure recovery under interrupted platform requests.
- Complete signed and notarized macOS distribution, and native testing on Windows/Linux before distributing those builds.
- Test upgrades from each shipped database schema with backups.
- Review the full creator onboarding flow with nontechnical users; Meta’s developer registration remains an external setup requirement.

No live Instagram account was used for automated validation. Passing local tests does not establish live platform compatibility or moderation quality.
