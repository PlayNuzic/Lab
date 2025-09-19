// Shared UI header for Lab: mirrors App1 header behavior

import { setVolume, getVolume, TimelineAudio, ensureAudio } from '../sound/index.js';
import { initSoundDropdown } from './sound-dropdown.js';

// --- Scheduling helpers (look-ahead y updateInterval) ---

function detectDeviceProfile() {
    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
    const isSmallScreen = (typeof window !== 'undefined')
        ? Math.min(window.innerWidth, window.innerHeight) <= 600
        : false;
    return (isMobileUA || isSmallScreen) ? 'mobile' : 'desktop';
}

// TODO[audit]: reason=validate Tone.js context exposes lookAhead/updateInterval on all supported builds
function applySchedulingProfile(profile) {
    const profiles = {
        desktop: { lookAhead: 0.02, updateInterval: 0.01 },
        balanced: { lookAhead: 0.03, updateInterval: 0.015 },
        mobile: { lookAhead: 0.06, updateInterval: 0.03 },
    };
    const p = profiles[profile] || profiles.balanced;
    try {
        const ctx = (typeof Tone !== 'undefined')
            ? (typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context)
            : null;
        if (ctx) {
            if (typeof ctx.lookAhead !== 'undefined') ctx.lookAhead = p.lookAhead;
            if (typeof ctx.updateInterval !== 'undefined') ctx.updateInterval = p.updateInterval;
        }
    } catch {}
    window.dispatchEvent(new CustomEvent('sharedui:scheduling', { detail: { profile, ...p } }));
}

function applyTheme(value) {
    const v = value || 'system';
    if (v === 'system') {
        const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.dataset.theme = dark ? 'dark' : 'light';
    } else {
        document.body.dataset.theme = v;
    }
    window.dispatchEvent(new CustomEvent('sharedui:theme', { detail: { value: document.body.dataset.theme, raw: v } }));
}

function setSelectionColor(value) {
    const v = value || '#FFBB97';
    document.documentElement.style.setProperty('--selection-color', v);
    window.dispatchEvent(new CustomEvent('sharedui:selectioncolor', { detail: { value: v } }));
}

function setMute(value) {
    const v = !!value;
    try {
        if (typeof Tone !== 'undefined' && Tone.Destination) {
            Tone.Destination.mute = v;
        }
    } catch {}
    window.dispatchEvent(new CustomEvent('sharedui:mute', { detail: { value: v } }));
}

function wireMenu(detailsEl) {
    if (!detailsEl) return;
    const content = detailsEl.querySelector('.options-content');
    if (!content) return;
    
    let lastPointerDownInside = false;
    const trackPointerDown = (event) => {
        lastPointerDownInside = detailsEl.contains(event.target);
    };

    const attachPointerTracker = () => {
        document.addEventListener('pointerdown', trackPointerDown, true);
    };

    const detachPointerTracker = () => {
        document.removeEventListener('pointerdown', trackPointerDown, true);
        lastPointerDownInside = false;
    };

    const handleFocusOut = (e) => {
        // Do not close the whole options menu when focus leaves a non-focusable
        // child (e.relatedTarget can be null on clicks to <li>, etc.).
        const next = e.relatedTarget;
        if (!detailsEl.open) return;
        if (next && detailsEl.contains(next)) return; // still inside the menu
        if (!next && lastPointerDownInside) return; // interaction stayed inside
        detailsEl.removeAttribute('open');
        content.removeEventListener('focusout', handleFocusOut);
        detachPointerTracker();
    };
    
    function solidMenuBackground(panel){
        if(!panel) return;
        const theme = document.body?.dataset?.theme || 'light';
        const rootStyles = getComputedStyle(document.documentElement);
        const bgVar = theme === 'dark' ? '--bg-dark' : '--bg-light';
        const txtVar = theme === 'dark' ? '--text-dark' : '--text-light';
        const bg = rootStyles.getPropertyValue(bgVar).trim() || getComputedStyle(document.body).backgroundColor;
        const txt = rootStyles.getPropertyValue(txtVar).trim() || getComputedStyle(document.body).color;
        panel.style.backgroundColor = bg;
        panel.style.color = txt;
        panel.style.backgroundImage = 'none';
    }
    
    detailsEl.addEventListener('toggle', () => {
        if (detailsEl.open) {
            solidMenuBackground(content);
            content.classList.add('opening');
            content.classList.remove('closing');
            content.style.maxHeight = content.scrollHeight + 'px';
            content.addEventListener('focusout', handleFocusOut);
            attachPointerTracker();
            content.addEventListener('transitionend', () => {
                content.classList.remove('opening');
                content.style.maxHeight = '';
            }, { once: true });
        } else {
            content.classList.add('closing');
            content.classList.remove('opening');
            content.style.maxHeight = content.scrollHeight + 'px';
            content.offsetHeight;
            content.style.maxHeight = '0px';
            content.addEventListener('transitionend', () => {
                content.classList.remove('closing');
                content.style.maxHeight = '';
            }, { once: true });
            content.removeEventListener('focusout', handleFocusOut);
            detachPointerTracker();
        }
    });
    
    window.addEventListener('sharedui:theme', () => {
        if (detailsEl.open) solidMenuBackground(content);
    });

    content.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            detailsEl.removeAttribute('open');
            content.removeEventListener('focusout', handleFocusOut);
            detachPointerTracker();
        }
    });
}

function wireControls(root) {
    const volumeSlider = root.querySelector('#volumeSlider');
    const themeSelect = root.querySelector('#themeSelect');
    const hoverToggle = root.querySelector('#hoverToggle');
    const muteBtn = root.querySelector('#muteBtn');
    const selectColor = root.querySelector('#selectColor');
    const schedSelect = root.querySelector('#schedProfileSelect');
    const soundWrapper = root.querySelector('.sound-wrapper');
    const baseSoundSelect = root.querySelector('#baseSoundSelect');
    const accentSoundSelect = root.querySelector('#accentSoundSelect');
    const startSoundSelect = root.querySelector('#startSoundSelect');
    const cycleSoundSelect = root.querySelector('#cycleSoundSelect');

    let soundAudio;
    async function getAudio(){
        if(!soundAudio){
            await ensureAudio();
            soundAudio = new TimelineAudio();
            await soundAudio.ready();
        }
        return soundAudio;
    }

    initSoundDropdown(baseSoundSelect, {
        storageKey: 'baseSound',
        eventType: 'baseSound',
        getAudio,
        apply: (a, val) => a.setBase(val)
    });
    initSoundDropdown(accentSoundSelect, {
        storageKey: 'accentSound',
        eventType: 'accentSound',
        getAudio,
        apply: (a, val) => a.setAccent(val)
    });
    initSoundDropdown(startSoundSelect, {
        storageKey: 'startSound',
        eventType: 'startSound',
        getAudio,
        apply: (a, val) => a.setStart(val)
    });

    initSoundDropdown(cycleSoundSelect, {
        storageKey: 'cycleSound',
        eventType: 'cycleSound',
        getAudio,
        apply: (a, val) => a.setCycle(val)
    });


    // Variables para gestionar el estado del volumen
    let previousVolume = 1;
    let hideTimeout = null;
    let muted = false;
    
    // ICONOS ORIGINALES (movidos aquí para estar disponibles globalmente)
    const speakerOn = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M-1.6,148.8h121.4L302.4,0v512L119.8,363.2H-1.6V148.8z M371.1,124.6c35.9,35.9,54.2,79.5,54.9,130.9 c0,49.3-18.3,91.5-54.9,126.7l-36.9-38c25.3-25.3,38-55.2,38-89.7c0-35.2-12.7-65.8-38-91.8L371.1,124.6z M434.4,62.3 c52.8,52.8,79.2,116.5,79.2,191.1c0,74.6-26.4,138.6-79.2,192.1l-39.1-39.1c42.2-41.5,63.3-92.4,63.3-152.5 c0-60.2-21.1-111.4-63.3-153.6L434.4,62.3z"/></svg>`;
    const speakerOff = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M32.78,5.62c-7.5-7.5-19.65-7.5-27.15,0c-7.5,7.5-7.5,19.66,0,27.15l107.98,107.99H57.6 c-31.81,0-57.6,25.79-57.6,57.6v115.15c0,31.81,25.79,57.6,57.6,57.6h94.2c4.7,0,9.24,1.72,12.76,4.85L279.54,478.2 c20.64,18.35,53.26,3.7,53.26-23.91v-94.33l146.42,146.42c7.5,7.5,19.66,7.5,27.15,0c7.5-7.5,7.5-19.66,0-27.15L32.78,5.62z M387.61,306.16l29.13,29.13c11.82-23.92,18.46-50.86,18.46-79.29c0-30.8-7.79-59.84-21.51-85.2c-5.05-9.32-16.7-12.79-26.02-7.74 c-9.33,5.05-12.79,16.7-7.75,26.03c10.76,19.88,16.89,42.66,16.89,66.92C396.8,273.69,393.55,290.59,387.61,306.16z M445.13,363.68 l27.99,27.99C497.76,352.33,512,305.81,512,256c0-56.99-18.64-109.68-50.16-152.23c-6.31-8.52-18.34-10.31-26.86-4 c-8.52,6.31-10.31,18.33-4,26.86c26.78,36.16,42.62,80.89,42.62,129.37C473.6,295.19,463.25,331.93,445.13,363.68z M192.51,111.05 L332.8,251.34V57.6c0-27.61-32.63-42.26-53.26-23.91L192.51,111.05z"/></svg>`;

    // Función de actualización de icono (movida aquí para estar disponible globalmente)
    function updateMuteIcon() {
        if (muteBtn) {
            muteBtn.innerHTML = muted ? speakerOff : speakerOn;
        }
    }

    if (volumeSlider) {
        const initial = typeof getVolume === 'function' ? getVolume() : 1;
        volumeSlider.value = initial;
        setVolume(initial);
        previousVolume = initial;

        function showSlider() {
            clearTimeout(hideTimeout);
            volumeSlider.style.display = 'block';
            // Forzar reflow antes de aplicar la animación
            volumeSlider.offsetHeight;
            volumeSlider.classList.remove('hide');
            volumeSlider.classList.add('show');
        }

        function hideSlider() {
            volumeSlider.classList.remove('show');
            volumeSlider.classList.add('hide');
            setTimeout(() => {
                if (volumeSlider.classList.contains('hide')) {
                    volumeSlider.style.display = 'none';
                }
            }, 300);
        }

        function scheduleHide() {
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hideSlider, 500);
        }

        if (soundWrapper) {
            soundWrapper.addEventListener('mouseenter', showSlider);
            soundWrapper.addEventListener('mouseleave', scheduleHide);
            soundWrapper.addEventListener('focusin', showSlider);
            soundWrapper.addEventListener('focusout', scheduleHide);
        }

        volumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            
            // Si estaba muteado y ahora se mueve el slider desde 0, activar sonido
            if (muted && v > 0) {
                muted = false;
                setMute(false);
                // Actualizar icono inmediatamente
                updateMuteIcon();
            }

            if (!muted) {
                previousVolume = v;
            }
            setVolume(v);
            window.dispatchEvent(new CustomEvent('sharedui:volume', { detail: { value: v } }));
        });

        volumeSlider.addEventListener('mouseup', scheduleHide);
        volumeSlider.addEventListener('touchend', scheduleHide);

        const handleVolumeEvent = (event) => {
            const detail = event?.detail;
            if (!detail || typeof detail.value !== 'number') return;
            const v = Math.max(0, Math.min(1, detail.value));
            if (volumeSlider) {
                volumeSlider.value = v;
            }
            if (!muted) {
                previousVolume = v;
            }
        };

        const handleMuteEvent = (event) => {
            const value = !!(event?.detail?.value);
            muted = value;
            updateMuteIcon();
            if (volumeSlider) {
                if (muted) {
                    const current = parseFloat(volumeSlider.value);
                    if (!Number.isNaN(current) && current > 0) {
                        previousVolume = current;
                    }
                    volumeSlider.value = 0;
                } else {
                    volumeSlider.value = previousVolume;
                }
            }
        };

        window.addEventListener('sharedui:volume', handleVolumeEvent);
        window.addEventListener('sharedui:mute', handleMuteEvent);

    } else {
        setVolume(1);
    }

    if (themeSelect) {
        applyTheme(themeSelect.value);
        themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    } else {
        applyTheme('system');
    }

    if (hoverToggle) {
        window.__hoversEnabled = hoverToggle.checked;
        hoverToggle.addEventListener('change', (e) => {
            window.__hoversEnabled = e.target.checked;
            if (!e.target.checked) {
                document.querySelectorAll('.hover-tip').forEach(t => t.classList.remove('show'));
            }
            window.dispatchEvent(new CustomEvent('sharedui:hover', { detail: { value: e.target.checked } }));
        });
    } else {
        window.__hoversEnabled = true;
    }

    if (selectColor) {
        const initial = selectColor.value || getComputedStyle(document.documentElement).getPropertyValue('--selection-color').trim() || '#FFBB97';
        selectColor.value = initial;
        setSelectionColor(initial);
        selectColor.addEventListener('input', (e) => setSelectionColor(e.target.value));
    }

    if (muteBtn) {
        updateMuteIcon(); // Inicializar el icono

        muteBtn.addEventListener('click', () => {
            muted = !muted;
            
            if (muted) {
                if (volumeSlider && volumeSlider.value > 0) {
                    previousVolume = parseFloat(volumeSlider.value);
                }
                if (volumeSlider) {
                    volumeSlider.value = 0;
                }
                setVolume(0);
            } else {
                if (volumeSlider) {
                    volumeSlider.value = previousVolume;
                }
                setVolume(previousVolume);
            }
            
            setMute(muted);
            updateMuteIcon();
            
            if (volumeSlider && soundWrapper) {
                scheduleHide();
            }
        });
    }

    if (schedSelect) {
        const def = detectDeviceProfile();
        schedSelect.value = def;
        applySchedulingProfile(def);
        schedSelect.addEventListener('change', (e) => applySchedulingProfile(e.target.value));
    } else {
        applySchedulingProfile(detectDeviceProfile());
    }
}

/**
 * Initializes the shared header controls for an already rendered layout.
 *
 * @returns {{ header: HTMLElement, menu: HTMLDetailsElement } | undefined} References to the mounted header elements, if found.
 * @remarks Desencadena events `sharedui:*` (DOM) i crea àudios de prova via `TimelineAudio` quan s'obren els desplegables. Cap PulseMemory aquí; delega el re-sync a `computeNextZero` des d'App3. Es crida durant l'arrencada de cada app que ja té markup.
 */
export function initHeader() {
    const header = document.querySelector('header.top-bar');
    const menu = document.querySelector('header.top-bar details.menu');
    if (header && menu) {
        wireMenu(menu);
        wireControls(header);
        return { header, menu };
    }
    return renderHeader({ title: document.title || 'App' });
}

/**
 * Renders the shared header structure inside the provided container.
 *
 * @param {{ title?: string, mount?: HTMLElement }} [options] Configuration for the rendered header.
 * @returns {{ header: HTMLElement, menu: HTMLDetailsElement }} Created header references for further customization.
 * @remarks Depèn de DOM per injectar markup i d'Audio opcional quan els selects invoquen `TimelineAudio`. Sense efectes laterals fora del DOM i events `sharedui:*`. PulseMemory = 1..Lg-1; 0/Lg derivats gestionats per apps consumidores.
 */
export function renderHeader({ title = 'App', mount } = {}) {
    const container = mount || document.body;
    const header = document.createElement('header');
    header.className = 'top-bar';
    header.innerHTML = `
        <details class="menu" id="optionsMenu">
            <summary>☰</summary>
            <div class="options-content">
                <label for="themeSelect">Tema:</label>
                <select id="themeSelect">
                    <option value="system" selected>Sistema</option>
                    <option value="light">Claro</option>
                    <option value="dark">Oscuro</option>
                </select>
                <label for="hoverToggle">Etiquetas de ayuda</label>
                <input type="checkbox" id="hoverToggle" checked>
                <label for="selectColor">Color selección</label>
                <input type="color" id="selectColor" value="#FFBB97">
                <details>
                  <summary>Sonidos</summary>
                  <div class="sound-group">
                    <p>Pulso</p>
                    <div class="preview-row">
                      <label for="baseSoundSelect" style="display:none"></label>
                      <select id="baseSoundSelect"></select>
                    </div>
                    <p>Acento</p>
                    <div class="preview-row">
                      <label for="accentSoundSelect" style="display:none"></label>
                      <select id="accentSoundSelect"></select>
                    </div>
                    <p>Inicio</p>
                    <div class="preview-row">
                      <label for="startSoundSelect" style="display:none"></label>
                      <select id="startSoundSelect"></select>
                    </div>
                  </div>
                </details>
                <hr class="menu-separator">
                <label for="schedProfileSelect">Rendimiento:</label>
                <select id="schedProfileSelect">
                    <option value="mobile">Móvil</option>
                    <option value="balanced">Equilibrado</option>
                    <option value="desktop">Escritorio</option>
                </select>
            </div>
        </details>
        <h1>${title}</h1>
        <div class="sound-wrapper">
            <button class="sound" id="muteBtn" aria-label="Alternar sonido">
                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M-1.6,148.8h121.4L302.4,0v512L119.8,363.2H-1.6V148.8z M371.1,124.6c35.9,35.9,54.2,79.5,54.9,130.9 c0,49.3-18.3,91.5-54.9,126.7l-36.9-38c25.3-25.3,38-55.2,38-89.7c0-35.2-12.7-65.8-38-91.8L371.1,124.6z M434.4,62.3 c52.8,52.8,79.2,116.5,79.2,191.1c0,74.6-26.4,138.6-79.2,192.1l-39.1-39.1c42.2-41.5,63.3-92.4,63.3-152.5 c0-60.2-21.1-111.4-63.3-153.6L434.4,62.3z"/></svg>
            </button>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1" aria-label="Control de volumen">
        </div>
    `;
    container.prepend(header);
    const menu = header.querySelector('details.menu');
    wireMenu(menu);
    wireControls(header);
    return { header, menu };
}
