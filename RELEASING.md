# Maintainer release checklist

The Desktop builds workflow runs unit/database tests, builds on native Windows, Linux, Intel Mac and Apple Silicon runners, and launches each packaged engine with temporary data and moderation disabled. Its smoke check verifies OS-protected credential storage, database initialization, an authenticated first-run page, saved settings and key reuse after restart, and a readable backup after a simulated upgrade. This is not a live Instagram test or a full visual/accessibility audit.

Download the successful workflow artifacts and publish a prerelease with platform names and SHA-256 hashes. Do not publish a failed platform's files. Bump package.json before a new release so automatic upgrade backups run. The app never auto-downloads updates.

## macOS public distribution

A maintainer must provide a Developer ID Application certificate through `CSC_LINK` with its password in `CSC_KEY_PASSWORD`. Configure Apple notarization using the credentials documented by electron-builder (for example `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`). Keep these in a trusted secret store; never commit them or paste them into issues/chat. Build with identity auto-discovery enabled for the intended signing identity, and verify notarization and stapling before distributing. CI previews deliberately disable identity auto-discovery and remain unsigned.

Official instructions: https://www.electron.build/docs/notarization/

## Windows public distribution

Use an appropriate Windows signing certificate/service and electron-builder's documented signing configuration. Unsigned preview installers may trigger SmartScreen. Never recommend disabling OS security protections.

## Linux

The app requires working Secret Service storage (for example GNOME Keyring), a graphical desktop, and an Electron-compatible distribution. AppImage support varies by distribution. The Debian package is an alternative for Debian/Ubuntu systems. CI configures the standard Electron setuid sandbox helper on its ephemeral runner; the app does not disable its sandbox.

## Live account validation still required

Use only a dedicated Instagram Creator/Business test account and disposable comments. Validate access scopes, hide and restore, expired/revoked tokens, rate limiting and reconnect, and an app restart during a request. A network timeout can leave the platform action uncertain even when the local transaction rolls back; inspect the actual comment before retrying an irreversible deletion. Never use real creator comments for release tests.

Keep pause/close behavior clear: an already-sent platform request may finish after pause. Automatic checks cover the bounded recent-post range described in the app. Model quality needs separate labeled examples, including criticism, sarcasm, reclaimed language and the user's languages.

## Recovery

Quit the app before restoring a backup. Preserve a copy of the current saved-data folder, then restore the matching database and credential-key from one backup. Credentials require the same operating-system keychain. Do not delete or overwrite data while the app is open. Copying a database to another machine does not transfer its keychain credentials.

## Check a downloaded or installed application

Run `node scripts/smoke-desktop.cjs "/absolute/path/to/executable"` from a development checkout with dependencies installed. Omit the argument to check the native unpacked build in `desktop-dist`. On macOS, the executable is inside `Comment Shield.app/Contents/MacOS/Comment Shield`. The check creates and removes its own temporary profile; it does not use the owner's saved data or connect to Instagram. Run it as a normal desktop user with an unlocked keychain, not as root.

Before general release, also manually install and open each platform's download, complete the onboarding with a dedicated test account, close/reopen, and install the next version over it. Confirm that settings and the connection remain, and that uninstall behavior is explained. Record the exact versions and operating systems tested. Automated startup checks do not assert that an installer or every visible control works.
