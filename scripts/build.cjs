'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json')));
for (const browser of ['chrome', 'firefox']) {
  const dest = path.join(root, 'dist', browser);
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(path.join(root, 'extension'))) fs.copyFileSync(path.join(root, 'extension', file), path.join(dest, file));
  const config = structuredClone(manifest);
  if (browser === 'firefox') {
    config.background = { scripts: ['core.js', 'background.js'] };
    config.browser_specific_settings = { gecko: {
      id: 'fix-my-feed@local', strict_min_version: '140.0',
      data_collection_permissions: { required: ['none'] }
    } };
  }
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(config, null, 2) + '\n');
  for (const name of ['README.md', 'ORIGINS.md', 'LICENSE']) fs.copyFileSync(path.join(root, name), path.join(dest, name));
  const zip = path.join(root, 'dist', `fix-my-feed-${browser}.zip`);
  execFileSync('python', [path.join(root, 'scripts/package.py'), dest, zip], { stdio: 'inherit' });
  console.log(`${browser}: ${dest}`);
}
