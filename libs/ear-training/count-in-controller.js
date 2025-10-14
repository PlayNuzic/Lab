/**
 * Count-In Controller (Phase 2c)
 *
 * Provides visual and audio count-in before rhythm exercises
 * - Visual: Big numbers (4, 3, 2, 1) with pulse animation
 * - Visual: Progress bar with circles
 * - Audio: Click sound on each beat
 * - Synchronized timing using requestAnimationFrame
 */

/**
 * CountInController class
 * Manages count-in sequence with visual and audio feedback
 */
export class CountInController {
  constructor(config = {}) {
    this.config = {
      beats: config.beats || 4,
      bpm: config.bpm || 120,
      visualFeedback: config.visualFeedback !== false,
      audioFeedback: config.audioFeedback !== false,
      clickNote: config.clickNote || 76, // E5
      container: config.container || null,
      onBeat: config.onBeat || null
    };

    this.element = null;
    this.numberElement = null;
    this.progressElement = null;
    this.isPlaying = false;
  }

  /**
   * Play count-in sequence
   * @param {HTMLElement} container - Optional container (if not provided in constructor)
   * @returns {Promise<void>} Resolves when count-in completes
   */
  async play(container = null) {
    const targetContainer = container || this.config.container || document.body;

    // Calculate beat duration
    const beatDuration = (60 / this.config.bpm) * 1000; // in ms

    console.log(`⏱️  Count-in: ${this.config.beats} beats @ ${this.config.bpm} BPM (${Math.round(beatDuration)}ms per beat)`);

    // Create visual elements if enabled
    if (this.config.visualFeedback) {
      this.createVisualElements(targetContainer);
    }

    // Initialize audio if enabled
    if (this.config.audioFeedback) {
      await this.initializeAudio();
    }

    // Play the count-in
    this.isPlaying = true;

    return new Promise((resolve) => {
      let currentBeat = 0;

      const playBeat = () => {
        if (currentBeat >= this.config.beats) {
          this.isPlaying = false;
          if (this.config.visualFeedback) {
            this.removeVisualElements();
          }
          resolve();
          return;
        }

        const beatNumber = this.config.beats - currentBeat;

        // Visual feedback
        if (this.config.visualFeedback) {
          this.updateVisual(beatNumber, currentBeat);
        }

        // Audio feedback
        if (this.config.audioFeedback) {
          this.playClick();
        }

        // Callback
        if (this.config.onBeat) {
          this.config.onBeat(beatNumber, currentBeat);
        }

        console.log(`  ${beatNumber}`);

        currentBeat++;
        setTimeout(playBeat, beatDuration);
      };

      playBeat();
    });
  }

  /**
   * Initialize audio system
   */
  async initializeAudio() {
    try {
      const { init, ensureToneLoaded } = await import('../sound/index.js');
      await ensureToneLoaded();
      await init();
    } catch (error) {
      console.error('⚠️  Failed to initialize audio for count-in:', error);
      this.config.audioFeedback = false;
    }
  }

  /**
   * Play click sound
   */
  async playClick() {
    try {
      // Use global Tone (already loaded)
      /* global Tone */
      if (typeof Tone === 'undefined') {
        return;
      }

      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0,
          release: 0.1
        }
      }).toDestination();

      const note = Tone.Frequency(this.config.clickNote, 'midi').toFrequency();
      synth.triggerAttackRelease(note, '16n');

      // Dispose after playing
      setTimeout(() => synth.dispose(), 200);
    } catch (error) {
      console.error('⚠️  Error playing click:', error);
    }
  }

  /**
   * Create visual elements
   * @param {HTMLElement} container - Container element
   */
  createVisualElements(container) {
    // Main count-in container
    this.element = document.createElement('div');
    this.element.id = 'count-in-overlay';
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Number display
    this.numberElement = document.createElement('div');
    this.numberElement.id = 'count-in-number';
    this.numberElement.style.cssText = `
      font-size: 120px;
      font-weight: bold;
      margin-bottom: 40px;
      transition: transform 0.1s ease-out;
    `;

    // Progress bar
    this.progressElement = document.createElement('div');
    this.progressElement.id = 'count-in-progress';
    this.progressElement.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    for (let i = 0; i < this.config.beats; i++) {
      const circle = document.createElement('div');
      circle.className = 'count-in-circle';
      circle.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transition: background 0.2s ease;
      `;
      this.progressElement.appendChild(circle);
    }

    this.element.appendChild(this.numberElement);
    this.element.appendChild(this.progressElement);
    container.appendChild(this.element);
  }

  /**
   * Update visual display for current beat
   * @param {number} beatNumber - Beat number (4, 3, 2, 1)
   * @param {number} beatIndex - Beat index (0, 1, 2, 3)
   */
  updateVisual(beatNumber, beatIndex) {
    if (!this.element || !this.numberElement || !this.progressElement) {
      return;
    }

    // Update number with pulse animation
    this.numberElement.textContent = beatNumber;
    this.numberElement.style.transform = 'scale(1.3)';
    setTimeout(() => {
      if (this.numberElement) {
        this.numberElement.style.transform = 'scale(1.0)';
      }
    }, 100);

    // Update progress circles
    const circles = this.progressElement.querySelectorAll('.count-in-circle');
    if (circles[beatIndex]) {
      circles[beatIndex].style.background = 'rgba(255, 255, 255, 1.0)';
    }
  }

  /**
   * Remove visual elements
   */
  removeVisualElements() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.numberElement = null;
    this.progressElement = null;
  }

  /**
   * Stop count-in (cancel)
   */
  stop() {
    this.isPlaying = false;
    this.removeVisualElements();
  }
}

/**
 * Factory function to create and play count-in
 * @param {object} config - Configuration
 * @returns {Promise<void>}
 */
export async function playCountIn(config) {
  const controller = new CountInController(config);
  return await controller.play();
}
