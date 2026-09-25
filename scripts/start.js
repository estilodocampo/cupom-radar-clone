const { spawn } = require('child_process');

const mode = process.env.SERVICE_MODE || 'web';
const child =
  mode === 'wa'
    ? spawn('node', ['worker/index.js'], { stdio: 'inherit' })
    : spawn('npx', ['next', 'start'], { stdio: 'inherit', shell: true });

child.on('exit', (code) => process.exit(code ?? 0));
