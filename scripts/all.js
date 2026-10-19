/**
 * Sobe web (Next) + worker (Baileys) no MESMO serviço do Render.
 *
 * Por que juntos? O worker precisa de disco persistente e de ficar sempre
 * acordado. Um único serviço Starter com disco entrega os dois por ~US$ 7,
 * em vez de pagar web + worker privado separados.
 *
 * - Web escuta na PORT do Render (injetada automaticamente).
 * - Worker escuta em 127.0.0.1:3001 (nunca exposto à internet).
 * - Se o worker cair, é reiniciado com backoff; se a web cair, o processo
 *   inteiro sai para o Render reiniciar o serviço.
 */
const { spawn } = require('child_process');
const path = require('path');

const WORKER_PORT = '3001';
const workerEntry = path.join(__dirname, '..', 'worker', 'index.js');
const nextBin = require.resolve('next/dist/bin/next');

let shuttingDown = false;
let workerAttempts = 0;
const children = new Set();

function launch(name, args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  children.add(child);

  child.on('error', (e) => {
    console.error(`[all] falha ao iniciar ${name}:`, e.message);
  });

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    if (name === 'web') {
      console.error(`[all] web encerrou (${code ?? signal})`);
      process.exit(code ?? 1);
    }

    workerAttempts += 1;
    const wait = Math.min(3000 * workerAttempts, 30000);
    console.error(`[all] worker encerrou (${code ?? signal}); reiniciando em ${wait / 1000}s`);
    setTimeout(() => {
      if (!shuttingDown) launch('worker', [workerEntry], { PORT: WORKER_PORT });
    }, wait);
  });

  return child;
}

console.log('[all] iniciando worker e web');
launch('worker', [workerEntry], { PORT: WORKER_PORT });
launch('web', [nextBin, 'start']);

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[all] ${signal} recebido; encerrando`);
  for (const child of children) {
    try { child.kill(signal); } catch { /* já encerrado */ }
  }
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
