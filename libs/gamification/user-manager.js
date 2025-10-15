/**
 * User Manager - Client-side user management (Simplified)
 * Single user system without authentication - all data in localStorage
 */

export class UserManager {
  constructor() {
    this.loadCurrentUser();
  }

  /**
   * Load current user from localStorage
   */
  loadCurrentUser() {
    const stored = localStorage.getItem('gamification_username');
    if (!stored) {
      // Set default username
      localStorage.setItem('gamification_username', 'Usuario');
    }
    console.log(`👤 Usuario cargado: ${this.getUserDisplayName()}`);
  }

  /**
   * Get current user display name
   * @returns {string} Display name
   */
  getUserDisplayName() {
    return localStorage.getItem('gamification_username') || 'Usuario';
  }

  /**
   * Set user display name
   * @param {string} name - New display name
   */
  setUserDisplayName(name) {
    if (!name || typeof name !== 'string') {
      console.error('❌ Nombre inválido');
      return false;
    }
    localStorage.setItem('gamification_username', name);
    console.log(`✅ Nombre cambiado a: ${name}`);

    // Trigger event for UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('userNameChanged', {
        detail: { name }
      }));
    }

    return true;
  }

  /**
   * Get user info (simplified)
   * @returns {object} User info
   */
  getUserInfo() {
    return {
      displayName: this.getUserDisplayName(),
      createdAt: this.getUserCreatedAt()
    };
  }

  /**
   * Get user creation timestamp
   * @returns {number|null} Timestamp
   */
  getUserCreatedAt() {
    const stored = localStorage.getItem('gamification_user_created_at');
    if (!stored) {
      const now = Date.now();
      localStorage.setItem('gamification_user_created_at', now.toString());
      return now;
    }
    return parseInt(stored);
  }

  /**
   * Reset user data (for testing)
   */
  resetUser() {
    localStorage.removeItem('gamification_username');
    localStorage.removeItem('gamification_user_created_at');
    this.loadCurrentUser();
    console.log('🔄 Datos de usuario reseteados');
  }
}

// Singleton instance
let userManagerInstance = null;

/**
 * Get or create UserManager singleton
 * @returns {UserManager} UserManager instance
 */
export function getUserManager() {
  if (!userManagerInstance) {
    userManagerInstance = new UserManager();
  }
  return userManagerInstance;
}

// Auto-initialize and expose globally for console access
if (typeof window !== 'undefined') {
  window.__USER_MANAGER = getUserManager();
  // Los comandos están documentados en CONSOLE_COMMANDS.md
}
