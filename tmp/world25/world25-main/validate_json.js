import fs from 'fs';
try {
  const data = fs.readFileSync('memory.json', 'utf8');
  JSON.parse(data);
  console.log('JSON is valid');
} catch (err) {
  console.error('JSON Error:', err.message);
  process.exit(1);
}
