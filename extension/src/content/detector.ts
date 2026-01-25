import { Readability, isProbablyReaderable } from '@mozilla/readability';
import { ArticleContent } from '../lib/types';

export function detectReadableContent(): ArticleContent | null {
  // Skip non-article pages
  if (!isProbablyReaderable(document)) {
    return null;
  }

  // Clone document to avoid modifying the original
  const documentClone = document.cloneNode(true) as Document;
  const article = new Readability(documentClone).parse();

  if (!article || !article.textContent) {
    return null;
  }

  const wordCount = article.textContent.split(/\s+/).filter(w => w.length > 0).length;

  // Skip very short content (likely not an article)
  if (wordCount < 100) {
    return null;
  }

  return {
    title: article.title || document.title || 'Untitled',
    content: article.content,
    textContent: article.textContent,
    wordCount,
    estimatedListenTime: Math.ceil(wordCount / 150), // ~150 wpm for TTS
    siteName: article.siteName || null,
    url: window.location.href,
  };
}
