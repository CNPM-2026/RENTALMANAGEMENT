const path = require('path');
const dotenv = require('dotenv');
const { spawnSync } = require('child_process');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['vitest', 'run'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
