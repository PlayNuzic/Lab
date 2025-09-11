// Shared UI header for Lab: mirrors App1 header behavior

import { setVolume, getVolume } from '../sound/index.js';

// --- Scheduling helpers (look-ahead y updateInterval) ---

function detectDeviceProfile() {
    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
    const isSmallScreen = (typeof window !== 'undefined')
        ? Math.min(window.innerWidth, window.innerHeight) <= 600
        : false;
    return (isMobileUA || isSmallScreen) ? 'mobile' : 'desktop';
}

function applySchedulingProfile(profile) {
    const profiles = {
        desktop: { lookAhead: 0.02, updateInterval: 0.01 },
        balanced: { lookAhead: 0.03, updateInterval: 0.015 },
        mobile: { lookAhead: 0.06, updateInterval: 0.03 },
    };
    const p = profiles[profile] || profiles.balanced;
    // Si Tone está disponible, aplicamos también al contexto global (opcional)
    try {
        const ctx = (typeof Tone !== 'undefined')
            ? (typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context)
            : null;
        if (ctx) {
            if (typeof ctx.lookAhead !== 'undefined') ctx.lookAhead = p.lookAhead;
            if (typeof ctx.updateInterval !== 'undefined') ctx.updateInterval = p.updateInterval;
        }
    } catch {}
    // Notificamos a las apps (cada app puede aplicarlo a su motor)
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
    
    // Close the menu if user interacts outside while it's open
    // Use pointerdown to avoid interfering with native popups
    const handleOutside = (e) => {
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        const inside = detailsEl.contains(e.target) || (path.length && path.includes(detailsEl));
        if (detailsEl.open && !inside) {
            detailsEl.removeAttribute('open');
        }
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
            document.addEventListener('pointerdown', handleOutside);
            solidMenuBackground(content);
            content.classList.add('opening');
            content.classList.remove('closing');
            content.style.maxHeight = content.scrollHeight + 'px';
            content.addEventListener('transitionend', () => {
                content.classList.remove('opening');
                content.style.maxHeight = '';
            }, { once: true });
        } else {
            document.removeEventListener('pointerdown', handleOutside);
            content.classList.add('closing');
            content.classList.remove('opening');
            content.style.maxHeight = content.scrollHeight + 'px';
            content.offsetHeight; // force reflow
            content.style.maxHeight = '0px';
            content.addEventListener('transitionend', () => {
                content.classList.remove('closing');
                content.style.maxHeight = '';
            }, { once: true });
        }
    });
    
    // Re-apply if theme changes while menu is open
    window.addEventListener('sharedui:theme', () => {
        if (detailsEl.open) solidMenuBackground(content);
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

    // Variables para gestionar el estado del volumen
    let previousVolume = 1;
    let hideTimeout = null;
    let muted = false;

    if (volumeSlider) {
        const initial = typeof getVolume === 'function' ? getVolume() : 1;
        volumeSlider.value = initial;
        setVolume(initial);
        previousVolume = initial;

        // Función para mostrar el slider con animación
        function showSlider() {
            clearTimeout(hideTimeout);
            volumeSlider.style.display = 'block';
            volumeSlider.classList.remove('hide');
            volumeSlider.classList.add('show');
        }

        // Función para ocultar el slider con animación
        function hideSlider() {
            volumeSlider.classList.remove('show');
            volumeSlider.classList.add('hide');
            setTimeout(() => {
                if (volumeSlider.classList.contains('hide')) {
                    volumeSlider.style.display = 'none';
                }
            }, 300); // Coincide con la duración de la transición CSS
        }

        // Función para programar ocultación con delay
        function scheduleHide() {
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(hideSlider, 500);
        }

        // Eventos para mostrar/ocultar el slider
        if (soundWrapper) {
            soundWrapper.addEventListener('mouseenter', showSlider);
            soundWrapper.addEventListener('mouseleave', scheduleHide);
            soundWrapper.addEventListener('focusin', showSlider);
            soundWrapper.addEventListener('focusout', scheduleHide);
        }

        // Evento para cambios de volumen
        volumeSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            if (!muted) {
                previousVolume = v; // Solo guardamos si no estamos muteados
            }
            setVolume(v);
            window.dispatchEvent(new CustomEvent('sharedui:volume', { detail: { value: v } }));
        });

        // Ocultar slider al soltar el ratón después de cambiar volumen
        volumeSlider.addEventListener('mouseup', scheduleHide);
        volumeSlider.addEventListener('touchend', scheduleHide);

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
        const speakerOn = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zm233.32-51.08c-11.17-7.33-26.18-4.24-33.51 6.95-7.34 11.17-4.22 26.18 6.95 33.51 66.27 43.49 105.82 116.6 105.82 195.58 0 78.98-39.54 152.09-105.82 195.58-11.17 7.32-14.29 22.34-6.95 33.5 7.04 10.71 21.93 14.56 33.51 6.95C528.27 439.58 576 351.33 576 256S528.27 72.43 448.35 19.97zM480 256c0-63.53-32.06-121.94-85.77-156.24-11.19-7.14-26.03-3.82-33.12 7.46s-3.78 26.21 7.41 33.36C408.27 165.97 432 209.11 432 256s-23.73 90.03-63.48 115.42c-11.19 7.14-14.5 22.07-7.41 33.36 6.51 10.36 21.12 15.14 33.12 7.46C447.94 377.94 480 319.53 480 256zm-96 0c0-33.92-17.18-64.62-45.85-82.42-11.09-6.89-25.82-3.69-32.73 7.43-6.91 11.12-3.67 25.98 7.42 32.88C329.87 222.85 336 238.93 336 256s-6.13 33.15-23.16 42.11c-11.09 6.9-14.33 21.76-7.42 32.88 6.95 11.16 21.69 14.32 32.73 7.43C366.82 320.62 384 289.92 384 256z"/></svg>`;
        
        const speakerOff = `<svg viewBox="0 0 576 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97zM461.64 256l45.64-45.64c6.3-6.3 6.3-16.52 0-22.82l-22.82-22.82c-6.3-6.3-16.52-6.3-22.82 0L416 210.36l-45.64-45.64c-6.3-6.3-16.52-6.3-22.82 0l-22.82 22.82c-6.3 6.3-6.3 16.52 0 22.82L370.36 256l-45.64 45.64c-6.3 6.3-6.3 16.52 0 22.82l22.82 22.82c6.3 6.3 16.52 6.3 22.82 0L416 301.64l45.64 45.64c6.3 6.3 16.52 6.3 22.82 0l22.82-22.82c6.3-6.3 6.3-16.52 0-22.82L461.64 256z"/></svg>`;

        const update = () => {
            muteBtn.innerHTML = muted ? speakerOff : speakerOn;
        };

        update();

        muteBtn.addEventListener('click', () => {
            muted = !muted;
            
            if (muted) {
                // Guardar volumen actual antes de mutear
                if (volumeSlider && volumeSlider.value > 0) {
                    previousVolume = parseFloat(volumeSlider.value);
                }
                // Actualizar slider visual a 0
                if (volumeSlider) {
                    volumeSlider.value = 0;
                }
                setVolume(0);
            } else {
                // Restaurar volumen anterior
                if (volumeSlider) {
                    volumeSlider.value = previousVolume;
                }
                setVolume(previousVolume);
            }
            
            setMute(muted);
            update();
            
            // Ocultar slider después de hacer clic en mute
            if (volumeSlider && soundWrapper) {
                scheduleHide();
            }
        });
    }

    // Scheduling profile (nuevo)
    if (schedSelect) {
        const def = detectDeviceProfile();
        // Després (força el valor per defecte segons dispositiu)
        schedSelect.value = def; // 'mobile' o 'desktop' segons detectDeviceProfile()
        applySchedulingProfile(def);
        schedSelect.addEventListener('change', (e) => applySchedulingProfile(e.target.value));
    } else {
        // Fallback: aplica perfil por defecto aunque el header no tenga el select
        applySchedulingProfile(detectDeviceProfile());
    }
}

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
                <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M215.03 71.05L126.06 160H24c-13.26 0-24 10.74-24 24v144c0 13.25 10.74 24 24 24h102.06l88.97 88.95c15.03 15.03 40.97 4.47 40.97-16.97V88.02c0-21.46-25.96-31.98-40.97-16.97z"/></svg>
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
