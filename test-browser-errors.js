const puppeteer = require('puppeteer');

async function checkForErrors(url, name) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  const logs = [];
  
  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      errors.push(text);
    }
    logs.push(`[${type}] ${text}`);
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    errors.push(error.toString());
  });
  
  console.log(`\nChecking ${name} at ${url}...`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for any delayed errors
    
    // Check if GravyJS is loaded
    const hasGravyEditor = await page.evaluate(() => {
      return document.querySelector('.gravy-editor') !== null;
    });
    
    console.log(`Page loaded: ✓`);
    console.log(`GravyJS editor found: ${hasGravyEditor ? '✓' : '✗'}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ JavaScript Errors Found:`);
      errors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log(`No JavaScript errors: ✓`);
    }
    
  } catch (e) {
    console.log(`❌ Failed to load page: ${e.message}`);
  }
  
  await browser.close();
  return errors.length === 0;
}

async function main() {
  console.log('🔍 Checking for JavaScript errors in running apps...\n');
  
  // Check demo
  const demoOk = await checkForErrors('http://localhost:5173', 'GravyJS Demo');
  
  // Check main app
  const appOk = await checkForErrors('http://localhost:6827', 'GravyPrompts App');
  
  console.log('\n' + '='.repeat(50));
  if (demoOk && appOk) {
    console.log('✅ Both apps load without JavaScript errors!');
  } else {
    console.log('❌ JavaScript errors detected!');
    process.exit(1);
  }
}

// Check if puppeteer is installed
try {
  require.resolve('puppeteer');
  main();
} catch(e) {
  console.log('Installing puppeteer...');
  require('child_process').execSync('npm install puppeteer', { stdio: 'inherit' });
  console.log('Please run this script again.');
}