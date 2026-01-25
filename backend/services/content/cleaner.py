from __future__ import annotations

import re
from trafilatura import extract


class ContentCleaner:
    """Clean and prepare content for TTS"""

    # Patterns to remove (promotional, navigation, etc.)
    REMOVE_PATTERNS = [
        r"subscribe\s+(to|for|now)",
        r"(un)?subscribe",
        r"sign\s+up\s+(for|to)",
        r"privacy\s+policy",
        r"terms\s+(of|and)\s+(service|use)",
        r"follow\s+us\s+on",
        r"share\s+(this|on)\s+(twitter|facebook|linkedin|x)",
        r"related\s+(articles?|posts?|stories)",
        r"(read\s+)?more\s+(articles?|stories)",
        r"comments?\s*\(\d+\)",
        r"advertisement",
        r"sponsored\s+content",
        r"partner\s+content",
        r"©\s*\d{4}",
        r"all\s+rights\s+reserved",
        r"cookie\s+(policy|preferences)",
        r"we\s+use\s+cookies",
        r"accept\s+(all\s+)?cookies",
        r"manage\s+(your\s+)?preferences",
        r"view\s+(this\s+)?(email\s+)?in\s+(your\s+)?browser",
        r"update\s+(your\s+)?subscription",
        r"click\s+here\s+to",
        r"tap\s+here\s+to",
        r"join\s+(our|the)\s+(newsletter|mailing\s+list)",
    ]

    def clean(self, text: str, source_url: str | None = None) -> str:
        """Main cleaning pipeline"""
        if not text:
            return ""

        # If HTML, extract text first
        if "<" in text and ">" in text:
            extracted = extract(
                text,
                include_comments=False,
                include_tables=False,
                include_images=False,
                url=source_url,
            )
            text = extracted or text

        # Remove promotional patterns
        text = self._remove_promo_content(text)

        # Clean up formatting
        text = self._normalize_text(text)

        # Format for TTS
        text = self._format_for_tts(text)

        return text

    def _remove_promo_content(self, text: str) -> str:
        """Remove promotional and boilerplate content"""
        for pattern in self.REMOVE_PATTERNS:
            # Remove sentences containing promotional patterns
            text = re.sub(
                rf"[^.!?\n]*{pattern}[^.!?\n]*[.!?]?\s*",
                "",
                text,
                flags=re.IGNORECASE,
            )
        return text

    def _normalize_text(self, text: str) -> str:
        """Normalize whitespace and formatting"""
        # Collapse multiple newlines
        text = re.sub(r"\n{3,}", "\n\n", text)

        # Collapse multiple spaces
        text = re.sub(r" {2,}", " ", text)

        # Remove leading/trailing whitespace per line
        text = "\n".join(line.strip() for line in text.split("\n"))

        # Remove empty lines at start/end
        return text.strip()

    def _format_for_tts(self, text: str) -> str:
        """Format text for natural TTS output"""
        # Expand common abbreviations
        expansions = {
            r"\be\.g\.": "for example",
            r"\bi\.e\.": "that is",
            r"\betc\.": "and so on",
            r"\bvs\.?": "versus",
            r"\bw/": "with",
            r"\bw/o": "without",
            r"\baka\b": "also known as",
            r"\basap\b": "as soon as possible",
            r"\bFYI\b": "for your information",
            r"\bIMO\b": "in my opinion",
            r"\bIMHO\b": "in my humble opinion",
            r"\bTL;?DR\b": "in summary",
            r"\bFAQ\b": "frequently asked questions",
        }

        for pattern, replacement in expansions.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # Handle URLs - replace with [link]
        text = re.sub(r"https?://\S+", "[link]", text)

        # Handle email addresses
        text = re.sub(r"\S+@\S+\.\S+", "[email]", text)

        # Format currency
        text = re.sub(r"\$(\d+(?:,\d{3})*(?:\.\d{2})?)", r"\1 dollars", text)
        text = re.sub(r"€(\d+(?:,\d{3})*(?:\.\d{2})?)", r"\1 euros", text)
        text = re.sub(r"£(\d+(?:,\d{3})*(?:\.\d{2})?)", r"\1 pounds", text)

        # Format percentages
        text = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"\1 percent", text)

        # Remove markdown formatting
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)  # Bold
        text = re.sub(r"\*(.+?)\*", r"\1", text)  # Italic
        text = re.sub(r"`(.+?)`", r"\1", text)  # Code
        text = re.sub(r"#{1,6}\s*", "", text)  # Headers

        # Format bullet points
        text = re.sub(r"^[-*•]\s+", "Item: ", text, flags=re.MULTILINE)

        # Format numbered lists
        text = re.sub(r"^(\d+)[.)]\s+", r"Number \1: ", text, flags=re.MULTILINE)

        # Remove excessive punctuation
        text = re.sub(r"[!?]{2,}", "!", text)
        text = re.sub(r"\.{4,}", "...", text)

        return text
