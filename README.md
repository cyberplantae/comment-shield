# Comment Shield

A desktop spellbook for Instagram creators: choose your boundaries, let an AI reader flag hurtful comments, and review what happened.

**Free and open source.** Download the desktop preview below, or clone this repository to build it yourself. Builds are available for Windows, macOS, and Linux. The preview is unsigned, and live Instagram moderation still needs end-to-end validation; start carefully and review the results.

## Use the desktop app

1. Choose your download from the list below. You do not need GitHub’s **Code → Download ZIP** or the **Source code** files to use the app.
2. Install your download: on Mac, open the DMG and move Comment Shield to Applications; on Windows, open the EXE and follow the installer; on Debian/Ubuntu, open the DEB with your software installer. Linux AppImage users may need to enable “Allow executing as a program” in the file’s properties.
3. Open **My spellbook**. Follow **Connect Instagram**, **Set up comment reader**, and **Choose my boundaries**, in that order.
4. Test your reader, then choose **Start protection**. Leave the app open and your computer awake for checks to continue.

### Choose your download

- **Mac with Apple Silicon (M1 or newer):** [Download for Apple Silicon](https://github.com/cyberplantae/comment-shield/releases/download/v0.1.1-preview.1/Comment-Shield-0.1.1-mac-arm64.dmg).
- **Mac with an Intel processor:** [Download for Intel Mac](https://github.com/cyberplantae/comment-shield/releases/download/v0.1.1-preview.1/Comment-Shield-0.1.1-mac-x64.dmg). Find your Mac’s processor under **Apple menu → About This Mac**.
- **Windows, Intel or AMD 64-bit:** [Download the Windows installer](https://github.com/cyberplantae/comment-shield/releases/download/v0.1.1-preview.1/Comment-Shield-0.1.1-win-x64.exe). Windows ARM is not tested.
- **Ubuntu or Debian, Intel or AMD 64-bit:** [Download the Debian package](https://github.com/cyberplantae/comment-shield/releases/download/v0.1.1-preview.1/Comment-Shield-0.1.1-linux-amd64.deb).
- **Other Linux desktops, Intel or AMD 64-bit:** [Download the AppImage](https://github.com/cyberplantae/comment-shield/releases/download/v0.1.1-preview.1/Comment-Shield-0.1.1-linux-x86_64.AppImage). A working system keyring and graphical desktop are required; compatibility varies by distribution.

[All releases and file checksums](https://github.com/cyberplantae/comment-shield/releases). These downloads are unsigned previews. Your computer may show an unidentified-publisher warning or block opening the app. Signing is optional for this GitHub project, but would make installation smoother. Do not disable your computer’s security protections to use it.

Desktop builds include their own local database. You do not need Node, Postgres, a website, or a Terminal command to run a packaged app. The desktop app unlocks its own private local session automatically.

### Connecting Instagram

You need an Instagram Creator or Business account. Because this is independently run software, you must create your own app through Meta’s developer dashboard, add Instagram with Instagram Login, and generate an access token for your account. Meta may require developer registration and verification. The in-app guide links to the relevant sites and explains where to paste the code. This is not a one-click Instagram login.

The app checks recent posts directly; it does not need a webhook tunnel. Each check covers up to 20 recent posts and 500 comments per post, approximately once a minute. Older posts and larger comment threads are outside this preview’s coverage. Starting protection includes existing comments in that range. Access can expire and require reconnection.

### Choosing a reader

Use Ollama for a reader on your computer, or connect a supported online AI provider using your own paid API account. Ollama is a separate download; the app offers a model download button. Online providers receive comment text for classification and may charge for usage. AI can make mistakes: start with conservative boundaries and inspect results. Hiding can be reversed; deletion cannot.

### Manual updates

Quit Comment Shield and download the newer version. On Mac, replace the app in Applications. On Windows or Debian/Ubuntu, run the newer installer. For AppImage, replace the downloaded AppImage file. There is no automatic updater. Before an upgrade opens your database, the app makes a local backup in the saved-data folder. Older app versions refuse to open a database already used by a newer version. Settings and comments are stored separately in the operating system’s application-data folder. The app menu includes **Show saved-data folder**. Keep that folder and your operating-system keychain: both are needed to recover encrypted connection credentials. Moving the folder to another computer is not a supported credential-transfer method.

The current Mac preview is not notarized. Signing and notarization are a future distribution improvement, not a prerequisite for downloading or cloning this open-source project.

## Privacy and operation

Comment records and settings stay in the local database; Instagram requests and your selected AI provider still use the internet. Connection credentials are encrypted using a key protected by operating-system secure storage. The database itself is not encrypted. Closing the app stops checks. Do not run two installations against the same Instagram account at once.

## Build from source

This route is for people comfortable using a terminal. Everyone else should use the downloads above.

Install Git, Node.js 22, and pnpm 9.13.2, then run:

```sh
git clone https://github.com/cyberplantae/comment-shield.git
cd comment-shield
```

Install dependencies and make an installer:

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

## Release signing

Unsigned previews can show operating-system security warnings. For a future signed Mac release, use an Apple Developer ID Application certificate and Apple notarization credentials; an Apple Development certificate is insufficient. A signed Windows release needs a Windows code-signing identity. Signing is not required to clone, build, or share this project on GitHub. No signing credentials are included in this repository or its current CI configuration. See [RELEASING.md](RELEASING.md) for the maintainer workflow.
