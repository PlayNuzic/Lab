const values = { Lg: 0, V: 0, T: 0 };
const buttons = {
  Lg: document.getElementById('lg-btn'),
  V: document.getElementById('v-btn'),
  T: document.getElementById('t-btn')
};
const inputs = {
  Lg: document.getElementById('lg-input'),
  V: document.getElementById('v-input'),
  T: document.getElementById('t-input')
};
const timeline = document.getElementById('timeline');
const pulsesPanel = document.getElementById('pulses-panel');
const pulsesToggle = document.getElementById('pulses-toggle');
let pulses = [];

// Initialize inputs
Object.keys(inputs).forEach(key => {
  inputs[key].addEventListener('change', () => {
    setValue(key, inputs[key].value);
  });
});

// Top buttons behavior
Object.keys(buttons).forEach(key => {
  buttons[key].addEventListener('click', () => {
    const current = values[key];
    const input = prompt(`Introdueix valor per ${key}:`, current);
    if (input !== null && input !== '') {
      setValue(key, input);
      inputs[key].value = values[key];
    }
  });
});

function setValue(key, val) {
  let num = 0;
  if (key === 'Lg') {
    num = parseInt(val) || 0;
  } else {
    num = parseFloat(val) || 0;
  }
  values[key] = num;
  buttons[key].querySelector('.value').textContent = Math.round(num);
  inputs[key].value = num;
  renderTimeline();
}

function renderTimeline() {
  timeline.innerHTML = '';
  const lg = values.Lg;
  if (lg > 0) {
    const endLabel = document.createElement('span');
    endLabel.className = 'end-label';
    endLabel.textContent = lg;
    timeline.appendChild(endLabel);
  }
  const beats = (values.V > 0 || values.T > 0) ? 10 : 0;
  for (let i = 1; i < beats; i++) {
    const mark = document.createElement('div');
    mark.className = 'beat';
    mark.style.left = (i / beats) * 100 + '%';
    timeline.appendChild(mark);
  }
  pulses.forEach(p => {
    const marker = document.createElement('div');
    marker.className = 'pulse-marker';
    marker.style.left = p * 100 + '%';
    timeline.appendChild(marker);
  });
}

timeline.addEventListener('click', e => {
  const rect = timeline.getBoundingClientRect();
  const pos = (e.clientX - rect.left) / rect.width;
  pulses.push(pos);
  updatePulsesPanel();
  renderTimeline();
});

function updatePulsesPanel() {
  pulsesPanel.innerHTML = '';
  pulses.forEach((p, idx) => {
    const entry = document.createElement('div');
    entry.className = 'pulse-entry';
    entry.textContent = `Pulso ${idx + 1}: ${(p * 100).toFixed(1)}%`;
    pulsesPanel.appendChild(entry);
  });
}

pulsesToggle.addEventListener('click', () => {
  pulsesPanel.classList.toggle('open');
});

// initial render
renderTimeline();
