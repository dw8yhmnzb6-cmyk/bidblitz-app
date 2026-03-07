/**
 * BidBlitz Push Notification System
 * Handles browser notifications and in-app alerts
 */

class NotificationManager {
  constructor() {
    this.permission = 'default';
    this.subscribers = [];
    this.queue = [];
  }

  async init() {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    this.permission = Notification.permission;
    
    if (this.permission === 'default') {
      this.permission = await Notification.requestPermission();
    }
    
    return this.permission === 'granted';
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notify(title, options = {}) {
    const notification = {
      id: Date.now(),
      title,
      body: options.body || '',
      icon: options.icon || '⚡',
      type: options.type || 'info', // info, success, warning, error, reward
      timestamp: new Date(),
      read: false,
      ...options
    };

    // Notify all subscribers (for in-app display)
    this.subscribers.forEach(cb => cb(notification));

    // Show browser notification if permitted
    if (this.permission === 'granted' && options.browser !== false) {
      try {
        new Notification(title, {
          body: options.body,
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: options.tag || 'bidblitz',
          ...options
        });
      } catch (e) {
        console.log('Browser notification failed:', e);
      }
    }

    return notification;
  }

  // Convenience methods
  success(title, body) {
    return this.notify(title, { body, type: 'success', icon: '✅' });
  }

  error(title, body) {
    return this.notify(title, { body, type: 'error', icon: '❌' });
  }

  warning(title, body) {
    return this.notify(title, { body, type: 'warning', icon: '⚠️' });
  }

  reward(title, body) {
    return this.notify(title, { body, type: 'reward', icon: '🎁' });
  }

  info(title, body) {
    return this.notify(title, { body, type: 'info', icon: 'ℹ️' });
  }

  // Game-specific notifications
  coinEarned(amount) {
    return this.notify(`+${amount} Coins!`, { 
      body: 'Du hast Coins verdient!', 
      type: 'reward', 
      icon: '🪙' 
    });
  }

  levelUp(level) {
    return this.notify('Level Up! 🎉', { 
      body: `Du bist jetzt Level ${level}!`, 
      type: 'success', 
      icon: '⬆️' 
    });
  }

  dailyReward() {
    return this.notify('Tägliche Belohnung! 🎁', { 
      body: 'Hole dir jetzt deine täglichen Coins!', 
      type: 'reward', 
      icon: '🎁' 
    });
  }

  missionComplete(missionName) {
    return this.notify('Mission abgeschlossen! ✅', { 
      body: missionName, 
      type: 'success', 
      icon: '🏆' 
    });
  }

  leagueUpdate(rank) {
    return this.notify('Liga-Update! 🏆', { 
      body: `Du bist jetzt Rang #${rank}!`, 
      type: 'info', 
      icon: '📊' 
    });
  }
}

// Singleton instance
const notificationManager = new NotificationManager();

export default notificationManager;
