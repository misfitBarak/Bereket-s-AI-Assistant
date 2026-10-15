const { spawnSync } = require('child_process');
const path = require('path');

const tsScript = path.join(__dirname, 'verify_system.ts');
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const result = spawnSync(npxCmd, ['tsx', tsScript], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
});

process.exit(result.status || 0);
