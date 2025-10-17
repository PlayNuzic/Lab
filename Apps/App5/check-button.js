// Quick script to check button in console
console.log('🔍 Checking for Game button...');

const btn = document.getElementById('gamificationToggleBtn');
console.log('Button element:', btn);

if (btn) {
  console.log('✅ Button found!');
  console.log('Button parent:', btn.parentElement);
  console.log('Button classes:', btn.className);
  console.log('Button styles:', window.getComputedStyle(btn).display);
  console.log('Button visibility:', window.getComputedStyle(btn).visibility);
  console.log('Button aria-pressed:', btn.getAttribute('aria-pressed'));
  console.log('Button text:', btn.textContent);
  console.log('Button innerHTML:', btn.innerHTML);
} else {
  console.log('❌ Button NOT found in DOM');
  console.log('Searching for similar buttons...');
  const allButtons = document.querySelectorAll('button');
  console.log('Total buttons found:', allButtons.length);
  allButtons.forEach((b, i) => {
    console.log(`Button ${i}:`, b.id, b.className, b.textContent.substring(0, 20));
  });
}

// Check if renderApp was called
console.log('\nChecking app root...');
const appRoot = document.getElementById('app-root');
console.log('App root:', appRoot);
if (appRoot) {
  console.log('App root children:', appRoot.children.length);
  console.log('Header:', appRoot.querySelector('header.top-bar'));
}
