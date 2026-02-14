import { ArticleContent, PlayerState } from '../lib/types';

const BUTTON_ID = 'tts-assistant-listen-btn';

export function showListenButton(article: ArticleContent, onClick: () => void): void {
  // Remove existing button if any
  removeListenButton();

  const button = document.createElement('div');
  button.id = BUTTON_ID;
  button.innerHTML = `
    <span class="tts-icon">🎧</span>
    <span class="tts-text">Listen (${article.estimatedListenTime} min)</span>
  `;

  // Apply styles
  Object.assign(button.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '25px',
    cursor: 'pointer',
    zIndex: '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    userSelect: 'none',
  });

  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.05)';
    button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
  });

  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  document.body.appendChild(button);
}

export function removeListenButton(): void {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) {
    existing.remove();
  }
}

export function updateButtonState(isPlaying: boolean): void {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  const textSpan = button.querySelector('.tts-text') as HTMLElement;
  if (textSpan) {
    textSpan.textContent = isPlaying ? 'Playing...' : 'Listen';
  }

  // Animate button during playback
  if (isPlaying) {
    button.style.background = 'linear-gradient(135deg, #e94560 0%, #d63447 100%)';
    button.style.animation = 'pulse 2s ease-in-out infinite';

    // Add keyframes if not already present
    if (!document.getElementById('tts-pulse-keyframes')) {
      const style = document.createElement('style');
      style.id = 'tts-pulse-keyframes';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4); transform: scale(1); }
          50% { box-shadow: 0 6px 25px rgba(233, 69, 96, 0.6); transform: scale(1.02); }
        }
      `;
      document.head.appendChild(style);
    }
  } else {
    button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    button.style.animation = 'none';
  }
}

export async function openExtensionPopup(): Promise<void> {
  // In Manifest V3, chrome.action.openPopup() requires user gesture
  // Since we're in a click handler, we can try to use it directly
  try {
    // First, try to open popup from background (requires user gesture context)
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });

    // Show a brief notification that popup is opening
    // showTemporaryNotification('Opening TTS Assistant...');
  } catch (error) {
    console.log('[TTS Assistant] Could not open popup automatically');
    showTemporaryNotification('Click the extension icon to start playback');
  }
}

function showTemporaryNotification(message: string): void {
  const notification = document.createElement('div');
  notification.textContent = message;

  Object.assign(notification.style, {
    position: 'fixed',
    bottom: '90px',
    right: '20px',
    padding: '12px 20px',
    background: '#16213e',
    color: '#eee',
    borderRadius: '8px',
    zIndex: '2147483646',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
    opacity: '0',
    transition: 'opacity 0.3s',
  });

  document.body.appendChild(notification);

  // Fade in
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);

  // Fade out and remove after 2 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

export function updateModalPlayer(state: PlayerState): void {
  // This function is kept for backward compatibility with content/index.ts
  // It now does nothing since we removed the modal
}

export function closeModalPlayer(): void {
  // This function is kept for backward compatibility
}
