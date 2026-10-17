const { cpSync, mkdirSync } = require('node:fs');
const path = require('node:path');
module.exports = async function afterPack(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const destination = path.join(resources, 'server', 'node_modules');
  mkdirSync(destination, { recursive: true });
  // electron-builder filters nested node_modules from extraResources.
  // Preserve Next's traced pnpm layout explicitly, before signing.
  cpSync(path.join(context.packager.projectDir, 'desktop-server', 'node_modules'), destination, {
    recursive: true, verbatimSymlinks: true,
  });
};
