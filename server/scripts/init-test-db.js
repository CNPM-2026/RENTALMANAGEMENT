const path = require('path');
const dotenv = require('dotenv');
const { spawnSync } = require('child_process');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
process.env.NODE_ENV = 'test';

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const prismaArgs = ['prisma', 'db', 'push', '--skip-generate'];
const push = spawnSync(command, prismaArgs, { stdio: 'inherit', env: process.env, shell: true });

if (push.status !== 0) {
  process.exit(push.status || 1);
}

const seed = spawnSync(command, ['ts-node', 'prisma/seed.ts'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(seed.status || 0);
