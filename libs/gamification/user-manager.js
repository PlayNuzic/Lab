/**
 * User Manager - Client-side user management
 * Simple 2-user system without authentication
 */

export class UserManager {
  constructor() {
    this.currentUser = null;
    this.users = [
      { id: 1, username: 'tester', displayName: 'Usuario de Prueba' },
      { id: 2, username: 'user', displayName: 'Usuario Normal' }
    ];
    this.loadCurrentUser();
  }

  /**
   * Load current user from localStorage
   */
  loadCurrentUser() {
    const stored = localStorage.getItem('gamification_current_user_id');
    this.currentUser = stored ? parseInt(stored) : 1; // Default: user 1 (tester)

    console.log(`Usuario actual cargado: ${this.getUserDisplayName()}`);
  }

  /**
   * Switch to a different user (console-based, no authentication)
   * @param {number} userId - User ID (1 or 2)
   * @returns {boolean} Success status
   */
  switchUser(userId) {
    if (userId !== 1 && userId !== 2) {
      console.error('❌ Solo existen user_id 1 (tester) y 2 (user)');
      return false;
    }

    this.currentUser = userId;
    localStorage.setItem('gamification_current_user_id', userId.toString());

    const user = this.getUserInfo(userId);
    console.log(`✅ Usuario cambiado a: ${user.displayName} (${user.username})`);

    // Trigger event for UI updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('userChanged', {
        detail: { userId, user }
      }));
    }

    return true;
  }

  /**
   * Get current user ID
   * @returns {number} Current user ID
   */
  getCurrentUserId() {
    return this.currentUser;
  }

  /**
   * Get user info by ID
   * @param {number} userId - User ID
   * @returns {object|null} User info
   */
  getUserInfo(userId) {
    return this.users.find(u => u.id === userId) || null;
  }

  /**
   * Get current user info
   * @returns {object|null} Current user info
   */
  getCurrentUserInfo() {
    return this.getUserInfo(this.currentUser);
  }

  /**
   * Get current user display name
   * @returns {string} Display name
   */
  getUserDisplayName() {
    const user = this.getCurrentUserInfo();
    return user ? user.displayName : 'Unknown';
  }

  /**
   * Get all available users
   * @returns {array} List of users
   */
  getAvailableUsers() {
    return [...this.users];
  }

  /**
   * Fetch user stats from API
   * @param {number} userId - User ID (optional, defaults to current)
   * @returns {Promise<object>} User stats
   */
  async fetchUserStats(userId = null) {
    const targetUserId = userId || this.currentUser;

    try {
      const response = await fetch(`http://localhost:3000/api/users/${targetUserId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const stats = await response.json();
      return stats;
    } catch (err) {
      console.error('Error fetching user stats:', err);
      return null;
    }
  }

  /**
   * Fetch user attempts from API
   * @param {number} limit - Number of attempts to fetch
   * @returns {Promise<array>} User attempts
   */
  async fetchUserAttempts(limit = 10) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/users/${this.currentUser}/attempts?limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const attempts = await response.json();
      return attempts;
    } catch (err) {
      console.error('Error fetching user attempts:', err);
      return [];
    }
  }

  /**
   * Check if server is available
   * @returns {Promise<boolean>} Server availability
   */
  async isServerAvailable() {
    try {
      const response = await fetch('http://localhost:3000/api/health', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      return response.ok;
    } catch (err) {
      return false;
    }
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

  console.log('👤 User Manager inicializado');
  console.log('   Comandos disponibles en consola:');
  console.log('   - window.__USER_MANAGER.switchUser(1)  // Cambiar a tester');
  console.log('   - window.__USER_MANAGER.switchUser(2)  // Cambiar a user');
  console.log('   - window.__USER_MANAGER.getCurrentUserId()  // Ver usuario actual');
  console.log('   - await window.__USER_MANAGER.fetchUserStats()  // Ver estadísticas (async)');
}
