const cp = require('child_process');
const fs = require('fs');
try {
  const result = cp.execSync('npx eslint .', {stdio: 'pipe', encoding: 'utf8'});
  fs.writeFileSync('lint-clean.txt', result);
} catch (error) {
  fs.writeFileSync('lint-clean.txt', error.stdout ? error.stdout.toString() : error.message);
  if (error.stderr) fs.appendFileSync('lint-clean.txt', '\nSTDERR:\n' + error.stderr.toString());
}
