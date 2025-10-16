/**
 * Character module for App5 gamification
 * Manages character SVG with dynamic mood-based color filters
 */

export class Character {
  constructor() {
    // SVG base del personaje proporcionado por el usuario
    this.svgBase = `<svg id="Capa_1" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 102 120">
      <polygon points="51 0 5.11 30.89 5.11 89.11 51 120 96.89 89.11 96.89 30.89 51 0" style="fill:#fbb03b;stroke:#000;stroke-miterlimit:10;stroke-width:3px"/>
      <line x1="51" y1="56.35" x2="51" y2="120" style="fill:none;stroke:#000;stroke-miterlimit:10;stroke-width:3px"/>
      <circle cx="51" cy="42.86" r="13.49" style="fill:#fff;stroke:#000;stroke-miterlimit:10;stroke-width:3px"/>
      <circle cx="51" cy="42.86" r="5.81" style="fill:#000"/>
      <line x1="34.77" y1="85.45" x2="20" y2="94.2" style="fill:none;stroke:#000;stroke-linecap:round;stroke-miterlimit:10;stroke-width:3px"/>
      <line x1="67.23" y1="85.45" x2="82" y2="94.2" style="fill:none;stroke:#000;stroke-linecap:round;stroke-miterlimit:10;stroke-width:3px"/>
      <line x1="51" y1="31.13" x2="51" y2="12.35" style="fill:none;stroke:#000;stroke-linecap:round;stroke-miterlimit:10;stroke-width:3px"/>
    </svg>`;

    // Generar hue base aleatoria para esta sesión
    this.sessionHue = Math.random() * 360;

    // Definir los moods con sus filtros CSS correspondientes
    this.moods = {
      neutral: `hue-rotate(${this.sessionHue}deg)`,
      happy: `hue-rotate(${(this.sessionHue + 120) % 360}deg) brightness(1.2) saturate(1.2)`,
      sad: `hue-rotate(${(this.sessionHue + 240) % 360}deg) brightness(0.8) saturate(0.7)`,
      thinking: `hue-rotate(${(this.sessionHue + 60) % 360}deg) sepia(0.3)`,
      celebrating: `hue-rotate(${(this.sessionHue + 180) % 360}deg) saturate(1.5) brightness(1.1)`,
      confused: `hue-rotate(${(this.sessionHue + 300) % 360}deg) contrast(0.9)`,
      focused: `hue-rotate(${(this.sessionHue + 90) % 360}deg) saturate(0.8) contrast(1.2)`
    };

    this.currentMood = 'neutral';
    this.element = null;
  }

  /**
   * Get SVG string with mood filter applied
   * @param {string} mood - One of the mood keys
   * @returns {string} SVG HTML string
   */
  getSVG(mood = 'neutral') {
    const filter = this.moods[mood] || this.moods.neutral;
    // Insert filter style into SVG
    const svgWithStyle = this.svgBase.replace(
      '<svg',
      `<svg style="filter: ${filter}"`
    );
    return svgWithStyle;
  }

  /**
   * Create DOM element for character
   * @param {string} mood - Initial mood
   * @returns {HTMLElement} Character container element
   */
  createElement(mood = 'neutral') {
    const container = document.createElement('div');
    container.className = 'game-character';
    container.innerHTML = this.getSVG(mood);
    this.element = container;
    this.currentMood = mood;
    return container;
  }

  /**
   * Update mood of existing DOM element
   * @param {string} mood - New mood to apply
   * @param {boolean} animate - Whether to animate the transition
   */
  setMood(mood, animate = true) {
    if (!this.element) {
      console.warn('Character element not created yet');
      return;
    }

    if (!this.moods[mood]) {
      console.warn(`Unknown mood: ${mood}`);
      return;
    }

    const svg = this.element.querySelector('svg');
    if (svg) {
      if (animate) {
        svg.style.transition = 'filter 0.5s ease-in-out';
      } else {
        svg.style.transition = 'none';
      }
      svg.style.filter = this.moods[mood];
      this.currentMood = mood;
    }
  }

  /**
   * Play a quick animation for the character
   * @param {string} animationType - Type of animation to play
   */
  animate(animationType = 'bounce') {
    if (!this.element) return;

    // Remove any existing animation class
    this.element.classList.remove('character-bounce', 'character-shake', 'character-pulse');

    // Force reflow to restart animation
    void this.element.offsetWidth;

    // Add new animation class
    switch(animationType) {
      case 'bounce':
        this.element.classList.add('character-bounce');
        break;
      case 'shake':
        this.element.classList.add('character-shake');
        break;
      case 'pulse':
        this.element.classList.add('character-pulse');
        break;
    }

    // Remove animation class after completion
    setTimeout(() => {
      this.element.classList.remove('character-bounce', 'character-shake', 'character-pulse');
    }, 1000);
  }

  /**
   * Get current mood
   * @returns {string} Current mood name
   */
  getMood() {
    return this.currentMood;
  }

  /**
   * Reset to neutral mood
   */
  reset() {
    this.setMood('neutral', true);
  }
}

// CSS animation definitions to be added to styles
export const CHARACTER_STYLES = `
.game-character {
  width: 102px;
  height: 120px;
  display: inline-block;
}

.game-character svg {
  width: 100%;
  height: 100%;
  transition: filter 0.5s ease-in-out;
}

@keyframes character-bounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-10px); }
  75% { transform: translateY(5px); }
}

@keyframes character-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes character-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.character-bounce {
  animation: character-bounce 1s ease-in-out;
}

.character-shake {
  animation: character-shake 0.5s ease-in-out;
}

.character-pulse {
  animation: character-pulse 0.8s ease-in-out;
}
`;