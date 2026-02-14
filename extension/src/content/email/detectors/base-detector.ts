import { EmailContent } from '../../../lib/types';

/**
 * Abstract base class for email client detectors
 * Provides interface and common utilities for detecting and extracting email content
 */
export abstract class BaseEmailDetector {
  /** Identifier for the email client (e.g., 'gmail', 'outlook') */
  abstract readonly clientType: string;

  /** Check if current URL matches this email client */
  abstract matches(url: string): boolean;

  /** Check if we're in email list view (inbox with multiple emails) */
  abstract isEmailListView(): boolean;

  /** Check if we're viewing a single email */
  abstract isSingleEmailView(): boolean;

  /** Extract all visible emails from list view */
  abstract getEmailsInList(): EmailContent[];

  /** Extract the currently open email in single view */
  abstract getCurrentEmail(): EmailContent | null;

  /** Get the DOM element for a specific email in list view */
  abstract getListItemElement(email: EmailContent): HTMLElement | null;

  /** Get the header element in single email view where player should be injected */
  abstract getSingleEmailHeaderElement(): HTMLElement | null;

  /**
   * Clean email body HTML by removing quoted replies and other noise
   * @param html Raw email body HTML
   * @returns Cleaned HTML
   */
  protected cleanEmailBody(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;

    console.log('[TTS Cleaner] Starting clean, initial HTML length:', html.length);

    // Remove Gmail's "Show trimmed content" button and hidden content markers
    div.querySelectorAll('.im, .gmail_extra').forEach(el => {
      console.log('[TTS Cleaner] Removing Gmail UI element:', el.className);
      el.remove();
    });

    // Remove quoted replies ONLY if they clearly look like replies (very conservative)
    const quotedReplies = div.querySelectorAll('.gmail_quote');
    console.log('[TTS Cleaner] Found .gmail_quote elements:', quotedReplies.length);
    quotedReplies.forEach((el, idx) => {
      const text = el.textContent || '';
      // Only remove if it contains clear reply markers
      if (text.includes('On ') && text.includes('wrote:')) {
        console.log(`[TTS Cleaner] Removing quoted reply ${idx}`);
        el.remove();
      } else {
        console.log(`[TTS Cleaner] Keeping element ${idx} (not a clear reply)`);
      }
    });

    // DO NOT remove blockquotes - they might be intentional content quotes in articles
    // DO NOT remove generic [class*="quote"] - too aggressive

    // Only remove very obvious email signatures
    const textContent = div.textContent || '';
    const obviousSignatures = [
      /Sent from my (iPhone|iPad|Android)/i,
      /Get Outlook for (iOS|Android)/i,
    ];

    obviousSignatures.forEach(pattern => {
      if (pattern.test(textContent)) {
        console.log('[TTS Cleaner] Found signature pattern:', pattern);
        // Only remove the specific node with signature, not everything after
        const nodes = Array.from(div.querySelectorAll('*'));
        nodes.forEach(node => {
          if (node.textContent && pattern.test(node.textContent)) {
            console.log('[TTS Cleaner] Removing signature node');
            node.remove();
          }
        });
      }
    });

    const cleanedLength = div.innerHTML.length;
    console.log('[TTS Cleaner] Cleaning complete, final HTML length:', cleanedLength);
    console.log('[TTS Cleaner] Removed:', html.length - cleanedLength, 'characters');

    return div.innerHTML;
  }

  /**
   * Extract plain text from HTML
   * @param html HTML content
   * @returns Plain text
   */
  protected extractPlainText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return (div.textContent || '').trim();
  }
}
