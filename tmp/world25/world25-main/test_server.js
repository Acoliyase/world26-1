async function test() {
  try {
    const resp = await fetch('http://localhost:3000/health');
    const data = await resp.json();
    console.log('Server Health:', data);
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}
test();
