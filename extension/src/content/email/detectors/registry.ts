import { BaseEmailDetector } from './base-detector';

/**
 * Registry for email client detectors
 * Manages detection and routing to appropriate email client handler
 */
export class DetectorRegistry {
  private detectors: BaseEmailDetector[] = [];

  /**
   * Register a new email client detector
   * @param detector Email client detector instance
   */
  register(detector: BaseEmailDetector): void {
    this.detectors.push(detector);
  }

  /**
   * Get the appropriate detector for the current URL
   * @param url Current page URL
   * @returns Matching detector or null
   */
  getDetectorForUrl(url: string): BaseEmailDetector | null {
    return this.detectors.find(d => d.matches(url)) || null;
  }

  /**
   * Get all registered detectors
   * @returns Array of all detectors
   */
  getAllDetectors(): BaseEmailDetector[] {
    return [...this.detectors];
  }
}
