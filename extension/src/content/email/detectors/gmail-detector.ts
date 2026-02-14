import { BaseEmailDetector } from './base-detector';
import { EmailContent } from '../../../lib/types';

/**
 * Gmail-specific email detector
 * Handles detection and content extraction from Gmail's complex DOM structure
 *
 * Key Gmail Selectors:
 * - Inbox list row: .zA (each email row)
 * - Subject in list: .bog span
 * - Sender in list: .yP span (name), .yW span[email] (email address)
 * - Single email subject: .hP
 * - Single email sender: .gD (name), .gE span[email] (address)
 * - Single email body: .a3s.aiL (body container)
 * - Email header: .adn.ads (header area for floating button)
 */
export class GmailDetector extends BaseEmailDetector {
  readonly clientType = 'gmail';

  matches(url: string): boolean {
    return url.includes('mail.google.com');
  }

  isEmailListView(): boolean {
    // Check if we're in inbox (list of emails visible)
    // Gmail shows email rows with class .zA
    return document.querySelectorAll('.zA').length > 0;
  }

  isSingleEmailView(): boolean {
    // Check if single email is open (subject header visible)
    // Gmail shows subject in .hP element when viewing email
    return document.querySelector('.hP') !== null;
  }

  getEmailsInList(): EmailContent[] {
    const emailRows = document.querySelectorAll('.zA');
    console.log('[TTS Gmail] Found .zA email rows:', emailRows.length);

    const emails: EmailContent[] = [];

    emailRows.forEach((row, index) => {
      const subject = row.querySelector('.bog span')?.textContent?.trim();
      const sender = row.querySelector('.yP span')?.textContent?.trim();
      const senderEmail = row.querySelector('.yW span[email]')?.getAttribute('email');

      if (index === 0) {
        console.log('[TTS Gmail] First email row selectors:', {
          hasSubject: !!subject,
          hasSender: !!sender,
          hasSenderEmail: !!senderEmail,
          subject: subject?.substring(0, 30),
        });
      }

      if (subject && sender) {
        // In list view, we don't have full email body
        // Use subject as preview text
        emails.push({
          subject,
          sender,
          senderEmail: senderEmail || '',
          body: '', // Not loaded in list view
          textContent: subject, // Use subject as preview
          wordCount: 0,
          estimatedListenTime: 0,
          url: window.location.href,
          messageId: `list-${index}`, // Simple ID for tracking
        });
      }
    });

    return emails;
  }

  getCurrentEmail(): EmailContent | null {
    if (!this.isSingleEmailView()) return null;

    // Extract subject
    const subject = document.querySelector('.hP')?.textContent?.trim();

    // Extract sender info
    const senderName = document.querySelector('.gD')?.textContent?.trim();
    const senderEmail = document.querySelector('.gE span[email]')?.getAttribute('email');

    console.log('[TTS Gmail] =================================================');
    console.log('[TTS Gmail] DETAILED EXTRACTION DEBUG');
    console.log('[TTS Gmail] =================================================');

    // Get email body using multiple strategies for better content extraction
    let bodyHtml = '';
    let extractionMethod = 'none';
    let debugInfo: any = {};

    // First, let's try to click "Show trimmed content" if it exists
    const showTrimmedButton = document.querySelector('[aria-label*="Show trimmed content"]');
    if (showTrimmedButton) {
      console.log('[TTS Gmail] Found "Show trimmed content" button, clicking it...');
      (showTrimmedButton as HTMLElement).click();
      // Wait a bit for content to load
      setTimeout(() => {}, 500);
    }

    // Strategy 1: Get ALL message bodies from the email thread
    // Gmail uses div.nH for email message containers
    const allMessages = document.querySelectorAll('[data-message-id]');
    console.log('[TTS Gmail] Strategy 1: Found [data-message-id] containers:', allMessages.length);

    if (allMessages.length > 0) {
      // Get the last message (most recent)
      const lastMessage = allMessages[allMessages.length - 1];

      // Within each message, find the body container
      // Try multiple selectors
      let messageBody = lastMessage.querySelector('.ii.gt');
      if (!messageBody) messageBody = lastMessage.querySelector('.a3s.aiL');
      if (!messageBody) messageBody = lastMessage.querySelector('.a3s');

      if (messageBody) {
        bodyHtml = messageBody.innerHTML;
        extractionMethod = 'data-message-id-body';
        debugInfo.messageBodyClass = messageBody.className;
        debugInfo.messageBodyLength = bodyHtml.length;
      }
    }

    // Strategy 2: Try to get .ii.gt containers directly
    if (!bodyHtml) {
      const messageContainers = document.querySelectorAll('.ii.gt');
      console.log('[TTS Gmail] Strategy 2: Found .ii.gt containers:', messageContainers.length);

      if (messageContainers.length > 0) {
        const latestContainer = messageContainers[messageContainers.length - 1];
        bodyHtml = latestContainer.innerHTML;
        extractionMethod = 'ii-gt-container';
        debugInfo.containerLength = bodyHtml.length;
      }
    }

    // Strategy 3: Combine all .a3s elements
    if (!bodyHtml) {
      const bodyElements = document.querySelectorAll('.a3s');
      console.log('[TTS Gmail] Strategy 3: Found .a3s elements:', bodyElements.length);

      if (bodyElements.length > 0) {
        const bodyParts: string[] = [];
        bodyElements.forEach((el, idx) => {
          const html = el.innerHTML.trim();
          if (html) {
            bodyParts.push(html);
            if (idx < 3) {
              console.log(`[TTS Gmail] .a3s[${idx}] preview:`, html.substring(0, 100));
            }
          }
        });
        bodyHtml = bodyParts.join('\n\n');
        extractionMethod = 'a3s-elements';
        debugInfo.a3sCount = bodyParts.length;
        debugInfo.combinedLength = bodyHtml.length;
      }
    }

    // Strategy 4: Try the entire email body container
    if (!bodyHtml) {
      const emailBody = document.querySelector('.gs');
      console.log('[TTS Gmail] Strategy 4: Found .gs container:', !!emailBody);

      if (emailBody) {
        bodyHtml = emailBody.innerHTML;
        extractionMethod = 'gs-container';
        debugInfo.gsLength = bodyHtml.length;
      }
    }

    // Strategy 5: Get everything inside the message view
    if (!bodyHtml) {
      const messageView = document.querySelector('.nH.aHU');
      console.log('[TTS Gmail] Strategy 5: Found .nH.aHU container:', !!messageView);

      if (messageView) {
        bodyHtml = messageView.innerHTML;
        extractionMethod = 'message-view';
        debugInfo.messageViewLength = bodyHtml.length;
      }
    }

    if (!subject || !senderName || !bodyHtml) {
      console.log('[TTS Gmail] Missing email components:', {
        subject,
        senderName,
        hasBody: !!bodyHtml,
        extractionMethod,
        debugInfo
      });
      return null;
    }

    console.log('[TTS Gmail] Raw HTML length BEFORE cleaning:', bodyHtml.length);
    console.log('[TTS Gmail] Raw HTML preview (first 500 chars):', bodyHtml.substring(0, 500));

    // Clean email body (remove quoted replies, signatures)
    const cleanedHtml = this.cleanEmailBody(bodyHtml);
    console.log('[TTS Gmail] HTML length AFTER cleaning:', cleanedHtml.length);

    const textContent = this.extractPlainText(cleanedHtml);
    console.log('[TTS Gmail] Plain text length:', textContent.length);
    console.log('[TTS Gmail] Plain text preview (first 500 chars):', textContent.substring(0, 500));

    const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

    // Get message ID if available
    const messageElement = document.querySelector('[data-message-id]');
    const messageId = messageElement?.getAttribute('data-message-id') || undefined;

    console.log('[TTS Gmail] Final extraction results:', {
      subject: subject.substring(0, 50),
      wordCount,
      extractionMethod,
      debugInfo,
      estimatedMinutes: Math.ceil(wordCount / 150),
    });
    console.log('[TTS Gmail] =================================================');

    return {
      subject,
      sender: senderName,
      senderEmail: senderEmail || '',
      body: cleanedHtml,
      textContent,
      wordCount,
      estimatedListenTime: Math.ceil(wordCount / 150), // 150 WPM
      url: window.location.href,
      messageId,
    };
  }

  getListItemElement(email: EmailContent): HTMLElement | null {
    // Find the email row matching the subject
    const rows = document.querySelectorAll('.zA');

    for (const row of rows) {
      const rowSubject = row.querySelector('.bog span')?.textContent?.trim();
      if (rowSubject === email.subject) {
        return row as HTMLElement;
      }
    }

    return null;
  }

  getSingleEmailHeaderElement(): HTMLElement | null {
    // Return the email header area where floating button should be placed
    // Gmail has header container with class .adn.ads
    const headerElement = document.querySelector('.adn.ads');

    if (!headerElement) {
      // Fallback: try to find any header-like element
      const subjectElement = document.querySelector('.hP');
      if (subjectElement) {
        return subjectElement.parentElement as HTMLElement;
      }
    }

    return headerElement as HTMLElement;
  }
}
