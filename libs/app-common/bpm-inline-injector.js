/**
 * Injects BPM inline control into .inputs and moves it near the grid.
 * Also sets up sound group labels (Metrónomo + Subdivisión slot).
 *
 * Shared by Apps 32-35.
 */

const BPM_HTML = `
<div class="bpm-inline visible" id="bpmParam">
  <span class="abbr">BPM</span>
  <div class="circle">
    <input id="inputBpm" type="number" min="50" max="150" value="90" />
    <div class="spinner">
      <button id="bpmUp" class="spin up" type="button" aria-label="Incrementar BPM"></button>
      <button id="bpmDown" class="spin down" type="button" aria-label="Decrementar BPM"></button>
    </div>
  </div>
</div>`;

function placeBpmNearGrid() {
  const bpmParam = document.getElementById('bpmParam');
  const gridContainer = document.getElementById('gridContainer');
  if (!bpmParam || !gridContainer) return false;
  if (bpmParam.parentElement !== gridContainer) {
    gridContainer.prepend(bpmParam);
  }
  gridContainer.classList.add('grid-container--bpm-left');
  // Move .controls under BPM (inside gridContainer, after bpmParam)
  const controls = document.querySelector('.controls');
  if (controls && controls.parentElement !== gridContainer) {
    bpmParam.insertAdjacentElement('afterend', controls);
    // Group random + reset into a horizontal row
    const randomBtn = controls.querySelector('.random');
    const randomMenu = controls.querySelector('.random-menu');
    const resetBtn = controls.querySelector('.reset');
    if (randomBtn && resetBtn) {
      const row = document.createElement('div');
      row.className = 'ctrl-secondary-row';
      controls.appendChild(row);
      row.appendChild(randomBtn);
      if (randomMenu) row.appendChild(randomMenu);
      row.appendChild(resetBtn);
    }
  }
  return true;
}

/**
 * Inject BPM control + setup sound group labels.
 * Call after renderApp() in index.html.
 */
export function injectBpmAndSoundGroup() {
  // Inject BPM into .inputs
  const inputsDiv = document.querySelector('.inputs');
  if (inputsDiv) {
    inputsDiv.innerHTML = BPM_HTML;
  }

  // Move BPM near grid (observe if grid not ready yet)
  if (!placeBpmNearGrid()) {
    const observer = new MutationObserver(() => {
      if (placeBpmNearGrid()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Setup sound groups: rename Pulso → Metrónomo, add Subdivisión slot
  const soundGroup = document.querySelector('.sound-group');
  if (soundGroup) {
    const labels = soundGroup.querySelectorAll('p');
    const pulsoLabel = labels?.[2];
    if (pulsoLabel) pulsoLabel.textContent = 'Metrónomo';

    const cycleTitle = document.createElement('p');
    cycleTitle.textContent = 'Subdivisión';
    soundGroup.appendChild(cycleTitle);

    const cycleRow = document.createElement('div');
    cycleRow.className = 'preview-row';

    const hiddenLabel = document.createElement('label');
    hiddenLabel.setAttribute('for', 'cycleSoundSelect');
    hiddenLabel.style.display = 'none';
    cycleRow.appendChild(hiddenLabel);

    const slot = document.createElement('div');
    slot.id = 'cycleSoundSelect';
    cycleRow.appendChild(slot);
    soundGroup.appendChild(cycleRow);
  }
}
