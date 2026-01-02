// libs/soundlines/index.js
// Exports unificats del mòdul soundlines

// Highlight system
export {
  createHighlightManager
} from './highlight-system.js';

// Connection renderer
export {
  drawConnectionLines,
  createConnectionManager
} from './connection-renderer.js';

// Playback utilities
export {
  sleep,
  setPlayIcon,
  createPlayButtonHTML,
  createPlaybackController,
  createEEDisplayHTML,
  updateEEDisplay
} from './playback-utils.js';
