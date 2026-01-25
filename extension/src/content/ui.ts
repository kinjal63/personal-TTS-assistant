import { ArticleContent } from '../lib/types';

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

  button.style.background = isPlaying
    ? 'linear-gradient(135deg, #e94560 0%, #d63447 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}
