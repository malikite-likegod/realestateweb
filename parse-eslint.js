const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
  let found = 0;
  data.forEach(f => {
    f.messages.forEach(m => {
      console.log(`${f.filePath}:${m.line} - ${m.message} (${m.ruleId})`);
      found++;
    });
  });
  if (found === 0) console.log("No errors found!");
} catch(e) {
  console.error("Error reading or parsing:", e);
}
