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
run('prisma migrate deploy', true);
run('next build');
