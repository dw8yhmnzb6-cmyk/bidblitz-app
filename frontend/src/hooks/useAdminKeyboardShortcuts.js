import { useEffect, useCallback } from 'react';

export function useAdminKeyboardShortcuts({
  onSearch,
  onNavigate,
  onQuickAction,
  enabled = true
}) {
  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;
    
    // Ignore if user is typing in an input field
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow "/" to open search even in inputs if it's a quick press
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        // Only if input is empty or this is the search shortcut
        return;
      }
      return;
    }

    // Search shortcut: "/" or Ctrl+K
    if (event.key === '/' || (event.ctrlKey && event.key === 'k')) {
      event.preventDefault();
      if (onSearch) onSearch();
      return;
    }

    // Tab navigation shortcuts (without modifiers)
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      const shortcuts = {
        'd': 'dashboard',
        'a': 'auctions',
        'p': 'products',
        'u': 'users',
        'b': 'bots',
        's': 'stats',
        'v': 'voice',
        'i': 'influencers',
        'e': 'email',
        'g': 'game'
      };

      if (shortcuts[event.key.toLowerCase()] && onNavigate) {
        event.preventDefault();
        onNavigate(shortcuts[event.key.toLowerCase()]);
        return;
      }
    }

    // Quick action shortcuts with Ctrl/Cmd
    if (event.ctrlKey || event.metaKey) {
      const quickActions = {
        'n': 'new_auction',    // Ctrl+N: New auction
        'r': 'refresh',        // Ctrl+R: Refresh (override browser)
        'b': 'toggle_bots',    // Ctrl+B: Toggle bots
      };

      if (quickActions[event.key.toLowerCase()] && onQuickAction) {
        event.preventDefault();
        onQuickAction(quickActions[event.key.toLowerCase()]);
        return;
      }
    }

    // Escape to close modals
    if (event.key === 'Escape') {
      // Let this bubble up to close any open modals
      return;
    }
  }, [enabled, onSearch, onNavigate, onQuickAction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Shortcuts help component
export function KeyboardShortcutsHelp({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: ['D'], description: 'Dashboard' },
      { keys: ['A'], description: 'Auktionen' },
      { keys: ['P'], description: 'Produkte' },
      { keys: ['U'], description: 'Benutzer' },
      { keys: ['B'], description: 'Bots' },
      { keys: ['S'], description: 'Statistiken' },
      { keys: ['V'], description: 'Sprachbefehle' },
      { keys: ['I'], description: 'Influencer' },
    ]},
    { category: 'Aktionen', items: [
      { keys: ['/'], description: 'Suche öffnen' },
      { keys: ['Ctrl', 'K'], description: 'Suche öffnen' },
      { keys: ['Ctrl', 'N'], description: 'Neue Auktion' },
      { keys: ['Ctrl', 'R'], description: 'Aktualisieren' },
      { keys: ['Esc'], description: 'Modal schließen' },
    ]},
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-card rounded-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-xl">⌨️ Tastatur-Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-gray-400 text-sm font-medium mb-3">{section.category}</h3>
              <div className="grid grid-cols-2 gap-2">
                {section.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#181824] rounded-lg p-2">
                    <span className="text-gray-300 text-sm">{item.description}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key, kidx) => (
                        <kbd key={kidx} className="px-2 py-1 bg-[#252532] rounded text-xs text-white font-mono">
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-gray-500 text-xs mt-6 text-center">
          Drücken Sie <kbd className="px-1 bg-[#252532] rounded">?</kbd> um diese Hilfe zu öffnen
        </p>
      </div>
    </div>
  );
}
