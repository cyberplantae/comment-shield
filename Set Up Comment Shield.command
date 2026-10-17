#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
printf '\nComment Shield — create your keeper’s key\n\n'
if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is missing. Ask the person who installed Comment Shield to install Node.js 22 or newer, then open this file again.\n'
elif [[ ! -d node_modules ]]; then
  printf 'Comment Shield needs its dependencies installed first. Ask the person who installed it to run pnpm install in this folder, then open this file again.\n'
else
  node scripts/setup-local.mjs
fi
printf '\nPress Return when you are done.\n'
read -r
