const { execSync } = require('child_process');

function run(cmd, allowFail = false) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    if (!allowFail) throw e;
    console.warn(`[build] aviso: falhou (ignorado): ${cmd}`);
  }
}

run('prisma generate');
// Schema aplicado manualmente via `prisma db push` (banco Railway já sincronizado).
// Ao alterar o schema: rode `prisma db push` local com a DATABASE_URL pública e faça deploy.
run('next build');
