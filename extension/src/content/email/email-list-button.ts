import { EmailContent } from '../../lib/types';

/**
 * Small play button shown next to emails in inbox list view
 * Allows users to quickly play an email without opening it fully
 */
export class EmailListButton {
  private button!: HTMLElement;
  private email: EmailContent;

  constructor(email: EmailContent, anchorElement: HTMLElement) {
    this.email = email;
    this.createButton(anchorElement);
  }

  private createButton(anchorElement: HTMLElement): void {
    this.button = document.createElement('button');
    this.button.className = 'tts-email-list-btn';
    this.button.innerHTML = '🎧';
    this.button.title = `Listen to email from ${this.email.sender}`;

    // Prevent button from interfering with email row styles
    this.button.style.cssText = `
      all: initial;
      background: transparent !important;
      border: none !important;
      cursor: pointer !important;
      font-size: 16px !important;
      padding: 4px 8px !important;
      opacity: 0.6 !important;
      transition: opacity 0.2s !important;
      display: inline-block !important;
      margin-left: 8px !important;
    `;

    // Insert at the end of the email row
    anchorElement.appendChild(this.button);

    // Event listeners
    this.button.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent email from opening
      this.handleClick();
    });

    this.button.addEventListener('mouseenter', () => {
      this.button.style.opacity = '1';
    });

    this.button.addEventListener('mouseleave', () => {
      this.button.style.opacity = '0.6';
    });
  }

  private async handleClick(): Promise<void> {
    console.log('[TTS] Email list button clicked:', this.email.subject);

    // Since we don't have the full email body in list view,
    // we need to notify the user to open the email
    // In a future enhancement, we could programmatically open the email

    // Send a message to show notification
    this.showNotification('Please open the email to listen to its full content');

    // Optionally: We could open the email programmatically here
    // For now, we'll just wait for the user to open it
  }

  private showNotification(message: string): void {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.className = 'tts-email-notification';
    notification.textContent = message;
    notification.style.cssText = `
      all: initial;
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      background: #333 !important;
      color: white !important;
      padding: 12px 20px !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      z-index: 999999 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      font-size: 14px !important;
      animation: tts-fade-in 0.3s !important;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  destroy(): void {
    this.button.remove();
  }
}
