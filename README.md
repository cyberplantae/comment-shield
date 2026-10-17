# Comment Shield

A desktop spellbook for Instagram creators: choose your boundaries, let an AI reader flag hurtful comments, and review what happened.

**Desktop preview.** The app builds for macOS, but live Instagram moderation and release signing/notarization still need validation. Do not rely on this preview as your only moderation tool.

## Use the desktop app

1. Download a build for your computer from [Releases](https://github.com/cyberplantae/comment-shield/releases). The initial preview is for Apple Silicon Macs.
2. Open the download and move Comment Shield into Applications.
3. Open **My spellbook**. Follow **Connect Instagram**, **Set up comment reader**, and **Choose my boundaries**, in that order.
4. Test your reader, then choose **Start protection**. Leave the app open and your computer awake for checks to continue.

Desktop builds include their own local database. You do not need Node, Postgres, a website, or a Terminal command to run a packaged app. The desktop app unlocks its own private local session automatically.

### Connecting Instagram

You need an Instagram Creator or Business account. Because this is independently run software, you must create your own app through Meta’s developer dashboard, add Instagram with Instagram Login, and generate an access token for your account. Meta may require developer registration and verification. The in-app guide links to the relevant sites and explains where to paste the code. This is not a one-click Instagram login.

The app checks recent posts directly; it does not need a webhook tunnel. Each check covers up to 20 recent posts and 500 comments per post, approximately once a minute. Older posts and larger comment threads are outside this preview’s coverage. Starting protection includes existing comments in that range. Access can expire and require reconnection.

### Choosing a reader

Use Ollama for a reader on your computer, or connect a supported online AI provider using your own paid API account. Ollama is a separate download; the app offers a model download button. Online providers receive comment text for classification and may charge for usage. AI can make mistakes: start with conservative boundaries and inspect results. Hiding can be reversed; deletion cannot.

### Manual updates

Quit Comment Shield, download the newer version, and replace the app in Applications. There is no automatic updater. Settings and comments are stored separately in the operating system’s application-data folder. The app menu includes **Show saved-data folder**. Keep that folder and your operating-system keychain: both are needed to recover encrypted connection credentials. Moving the folder to another computer is not a supported credential-transfer method.

The current Mac preview is not notarized for public distribution. A smooth public install requires a Developer ID signing certificate and Apple notarization; development signing is not equivalent.

## Privacy and operation

Comment records and settings stay in the local database; Instagram requests and your selected AI provider still use the internet. Connection credentials are encrypted using a key protected by operating-system secure storage. The database itself is not encrypted. Closing the app stops checks. Do not run two installations against the same Instagram account at once.

## Build from source

Use Node.js and pnpm. From the project folder:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm desktop:test
pnpm desktop:dist
```

Build on the target operating system. Installers appear in `desktop-dist/`. `pnpm desktop:prepare` builds the bundled server; `pnpm desktop:dev` opens it in Electron. For isolated first-run testing, set `SHIELD_TEST_USER_DATA` to a temporary directory and `SHIELD_TEST_MODE=1` to disable the moderation worker.

The desktop bundle excludes `.env` files. Never commit access tokens, provider keys, local databases, or generated installers. `desktop/security.test.cjs` tests session signing, navigation restrictions, and database persistence across migrations/reopening.

### Optional web deployment (developers)

The web deployment is a separate advanced path. Copy `.env.example` to `.env`, configure PostgreSQL and credentials, run `pnpm db:migrate`, then run the web server and `pnpm worker` separately. Web deployments need owner authentication, HTTPS, Meta app configuration, and webhooks. These requirements do not apply to the packaged desktop setup.

## License and typography

MIT; see [LICENSE](LICENSE). Bicubik is requested as a locally installed font, with fallback fonts. Its font binary is not distributed with this repository.
