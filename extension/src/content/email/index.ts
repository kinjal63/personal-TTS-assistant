import { GmailDetector } from './detectors/gmail-detector';
import { DetectorRegistry } from './detectors/registry';
import { EmailListButton } from './email-list-button';
import { EmailPlayer } from './email-player';
import { PlayerState, MessageType, EmailContent } from '../../lib/types';

// Registry for email client detectors
const registry = new DetectorRegistry();
registry.register(new GmailDetector());

// Track active UI components
let currentEmailPlayer: EmailPlayer | null = null;
let listButtons: EmailListButton[] = [];

/**
 * Detect email client and inject appropriate UI
 * Handles both inbox list view and single email view
 */
export function detectAndInjectEmailUI(): void {
  console.log('[TTS Email] Detecting email UI...');
  console.log('[TTS Email] Current URL:', window.location.href);

  const detector = registry.getDetectorForUrl(window.location.href);

  if (!detector) {
    console.log('[TTS Email] No detector found for URL:', window.location.href);
    console.log('[TTS Email] URL must include "mail.google.com" for Gmail detection');
    return;
  }

  console.log('[TTS Email] ✓ Using detector:', detector.clientType);

  // Debug: Check what Gmail thinks
  const isListView = detector.isEmailListView();
  const isSingleView = detector.isSingleEmailView();
  console.log('[TTS Email] Detection results:', {
    isListView,
    isSingleView,
    emailRowsFound: document.querySelectorAll('.zA').length,
    singleEmailSubject: document.querySelector('.hP')?.textContent?.substring(0, 50),
  });

  // Handle single email view
  if (detector.isSingleEmailView()) {
    handleSingleEmailView(detector);
  } else {
    // Clean up single email player if navigating away
    if (currentEmailPlayer) {
      console.log('[TTS Email] Cleaning up email player');
      currentEmailPlayer.destroy();
      currentEmailPlayer = null;
    }
  }

  // Handle email list view
  if (detector.isEmailListView()) {
    handleEmailListView(detector);
  }
}

/**
 * Handle single email view - inject floating player
 */
function handleSingleEmailView(detector: any): void {
  const email = detector.getCurrentEmail();
  const headerElement = detector.getSingleEmailHeaderElement();

  if (email && headerElement) {
    console.log('[TTS Email] Found email:', email.subject);

    // Only create player if we don't already have one
    if (!currentEmailPlayer) {
      currentEmailPlayer = new EmailPlayer(email, headerElement);

      // Notify background service worker
      chrome.runtime.sendMessage({
        type: 'EMAIL_DETECTED',
        payload: email,
      } as MessageType).catch(err => {
        console.log('[TTS Email] Could not send EMAIL_DETECTED:', err);
      });
    }
  } else {
    console.log('[TTS Email] Missing email components:', {
      hasEmail: !!email,
      hasHeader: !!headerElement,
    });
  }
}

/**
 * Handle email list view - inject play buttons next to emails
 */
function handleEmailListView(detector: any): void {
  const emails = detector.getEmailsInList();

  console.log('[TTS Email] Found emails in list:', emails.length);

  // Clean up old buttons
  listButtons.forEach(btn => btn.destroy());
  listButtons = [];

  // Create new buttons (limit to first 20 to avoid performance issues)
  const emailsToShow = emails.slice(0, 20);

  emailsToShow.forEach((email: EmailContent) => {
    const rowElement = detector.getListItemElement(email);
    if (rowElement) {
      try {
        const button = new EmailListButton(email, rowElement);
        listButtons.push(button);
      } catch (err) {
        console.log('[TTS Email] Error creating list button:', err);
      }
    }
  });

  console.log('[TTS Email] Created list buttons:', listButtons.length);
}

/**
 * Update email player state when playback state changes
 * Called from content script when STATE_UPDATE messages arrive
 */
export function updateEmailPlayerState(state: PlayerState): void {
  if (currentEmailPlayer) {
    currentEmailPlayer.updateState(state);
  }
}

/**
 * Clean up all email UI components
 * Called when navigating away or extension is disabled
 */
export function cleanupEmailUI(): void {
  if (currentEmailPlayer) {
    currentEmailPlayer.destroy();
    currentEmailPlayer = null;
  }

  listButtons.forEach(btn => btn.destroy());
  listButtons = [];
}
