/**
 * Random Sub-Package
 *
 * Consolidated random/randomization functionality including:
 * - Basic randomization (legacy randomize function)
 * - Random configuration management (config.js)
 * - Random menu UI (menu.js)
 * - Fractional randomization (fractional.js)
 */

// Core randomization (extracted to avoid circular dependency)
export { randomize, DEFAULT_RANGES } from './core.js';

// Random configuration management
export { applyBaseRandomConfig, updateBaseRandomConfig } from './config.js';

// Random menu UI
export { mergeRandomConfig, initRandomMenu } from './menu.js';

// Fractional randomization
export { randomizeFractional } from './fractional.js';
