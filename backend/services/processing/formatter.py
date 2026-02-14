import re
from typing import List, Tuple
import html.parser


class HTMLToText(html.parser.HTMLParser):
    """Convert HTML to plain text with preserved structure"""
    def __init__(self):
        super().__init__()
        self.text = []
        self.in_script = False
        self.in_style = False

    def handle_starttag(self, tag, _attrs):
        # Skip script and style content
        if tag in ('script', 'style'):
            if tag == 'script':
                self.in_script = True
            elif tag == 'style':
                self.in_style = True
        # Paragraph breaks
        elif tag == 'p':
            self.text.append('\n\n')
        # Line breaks
        elif tag == 'br':
            self.text.append('\n')
        # List items
        elif tag == 'li':
            self.text.append('\n')
        # Divs often represent sections
        elif tag == 'div':
            self.text.append('\n')

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_script = False
        elif tag == 'style':
            self.in_style = False
        # Add line break after block elements
        elif tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li'):
            self.text.append('\n')

    def handle_data(self, data):
        # Ignore script/style content
        if not self.in_script and not self.in_style:
            self.text.append(data)

    def get_text(self):
        return ''.join(self.text)


class ProsodyFormatter:
    """Prepare text for natural-sounding TTS output with proper pauses and formatting"""

    # Pause placeholders (removed at the end, TTS relies on natural punctuation)
    # Using unique markers that won't be affected by text cleaning
    PAUSE_SHORT = ' XPAUSESHORTX '
    PAUSE_MEDIUM = ' XPAUSEMEDIUMX '
    PAUSE_LONG = ' XPAUSELONGX '
    PAUSE_PARAGRAPH = ' XPAUSEPARAGRAPHX '

    def format(self, text: str) -> str:
        """Apply all formatting rules for TTS"""
        # Convert HTML to text if input is HTML
        if '<' in text and '>' in text:
            parser = HTMLToText()
            parser.feed(text)
            text = parser.get_text()

        text = self._normalize_whitespace(text)
        text = self._format_headers(text)  # Handle headers before cleaning
        text = self._convert_bullets_to_numbers(text)
        text = self._handle_abbreviations(text)
        text = self._add_punctuation_pauses(text)
        text = self._handle_special_characters(text)
        text = self._add_transition_pauses(text)
        text = self._format_numbers(text)
        text = self._clean_for_speech(text)
        text = self._add_paragraph_pauses(text)
        text = self._convert_pauses_to_ssml(text)  # Clean up pause placeholders

        return text.strip()

    def _normalize_whitespace(self, text: str) -> str:
        """Normalize all whitespace"""
        # Replace multiple spaces with single space
        text = re.sub(r'[ \t]+', ' ', text)
        # Normalize line endings
        text = re.sub(r'\r\n', '\n', text)
        # Keep paragraph breaks (2+ newlines)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text

    def _format_headers(self, text: str) -> str:
        """Format headers for engaging TTS with announcements"""
        def replace_header(match):
            level = len(match.group(1))
            header_text = match.group(2).strip()

            # Different announcements based on header level
            if level == 1:  # h1 - main sections
                return f"\n\nNext section. {self.PAUSE_MEDIUM} {header_text}.\n\n"
            elif level == 2:  # h2 - subsections
                return f"\n\nNext. {self.PAUSE_SHORT} {header_text}.\n\n"
            else:  # h3+ - minor headers
                return f"\n\n {self.PAUSE_SHORT} {header_text}.\n\n"

        # Match markdown headers (# Header, ## Header, etc.)
        text = re.sub(r'^(#{1,6})\s+(.+)$', replace_header, text, flags=re.MULTILINE)

        # Also handle HTML-style headers if present
        text = re.sub(r'<h[1-2][^>]*>(.+?)</h[1-2]>',
                     lambda m: f"\n\nNext section. {self.PAUSE_MEDIUM} {m.group(1)}.\n\n",
                     text, flags=re.IGNORECASE)
        text = re.sub(r'<h[3-6][^>]*>(.+?)</h[3-6]>',
                     lambda m: f"\n\n{m.group(1)}.\n\n",
                     text, flags=re.IGNORECASE)

        # Detect plain text headers (lines without ending punctuation, followed by blank line)
        # Pattern: Short line (< 100 chars), no ending punctuation, followed by paragraph break
        def fix_plain_header(match):
            header_line = match.group(1).strip()
            # Add period to ensure pause
            return f"{header_line}.\n\n"

        # Match lines that:
        # - Don't end with punctuation (.!?;:,)
        # - Are followed by blank line (paragraph break)
        # - Are relatively short (< 100 chars, typical header length)
        text = re.sub(
            r'^(.{1,100}[^.!?;:,\s])\s*\n\n',
            fix_plain_header,
            text,
            flags=re.MULTILINE
        )

        return text

    def _convert_bullets_to_numbers(self, text: str) -> str:
        """Convert bullet points to numbered list for clear TTS"""
        lines = text.split('\n')
        result = []
        bullet_count = 0
        in_list = False

        bullet_patterns = [
            r'^[\s]*[•●○◦▪▸►‣⁃]\s*',  # Unicode bullets
            r'^[\s]*[-*]\s+',            # Dash or asterisk bullets
            r'^[\s]*[→⇒➤➜]\s*',         # Arrow bullets
        ]

        for line in lines:
            is_bullet = any(re.match(p, line) for p in bullet_patterns)

            if is_bullet:
                if not in_list:
                    bullet_count = 0
                    in_list = True
                bullet_count += 1

                # Remove bullet character
                clean_line = line
                for pattern in bullet_patterns:
                    clean_line = re.sub(pattern, '', clean_line)

                # Convert to ordinal
                ordinal = self._get_ordinal(bullet_count)
                result.append(f"{ordinal}, {clean_line.strip()}")
            else:
                if line.strip():
                    in_list = False
                result.append(line)

        return '\n'.join(result)

    def _get_ordinal(self, num: int) -> str:
        """Get ordinal word for number"""
        ordinals = {
            1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth",
            6: "Sixth", 7: "Seventh", 8: "Eighth", 9: "Ninth", 10: "Tenth",
            11: "Eleventh", 12: "Twelfth"
        }
        return ordinals.get(num, f"Item {num}")

    def _handle_abbreviations(self, text: str) -> str:
        """Expand common abbreviations for clearer speech"""
        abbreviations = {
            r'\be\.g\.\s*': 'for example ',
            r'\bi\.e\.\s*': 'that is ',
            r'\betc\.\s*': 'etcetera ',
            r'\bvs\.\s*': 'versus ',
            r'\bDr\.\s+': 'Doctor ',
            r'\bMr\.\s+': 'Mister ',
            r'\bMrs\.\s+': 'Missus ',
            r'\bMs\.\s+': 'Miss ',
            r'\bProf\.\s+': 'Professor ',
            r'\bSt\.\s+': 'Saint ',
            r'\bw/\s*': 'with ',
            r'\bw/o\s*': 'without ',
            r'\bb/c\s*': 'because ',
            r'\bmin\.\s*': 'minutes ',
            r'\bsec\.\s*': 'seconds ',
            r'\bhrs?\.\s*': 'hours ',
            r'\bapprox\.\s*': 'approximately ',
            r'\bFYI\b': 'for your information',
            r'\bASAP\b': 'as soon as possible',
            r'\bTBD\b': 'to be determined',
            r'\bTL;?DR\b': 'too long, didn\'t read',
            r'\bIMO\b': 'in my opinion',
            r'\bIMHO\b': 'in my humble opinion',
            r'\bAFAIK\b': 'as far as I know',
        }

        for abbr, expansion in abbreviations.items():
            text = re.sub(abbr, expansion, text, flags=re.IGNORECASE)

        return text

    def _add_punctuation_pauses(self, text: str) -> str:
        """Add appropriate pauses for all English punctuation marks"""

        # Special handling for "and/or" before general slash handling
        text = re.sub(r'\band\s*/\s*or\b', 'and or', text, flags=re.IGNORECASE)

        # Numeric ratios (e.g., "50/50"): keep as-is, TTS handles naturally
        # Already handled by not matching digits in the pattern below

        # Forward slash between words: say "or" (but not in URLs or numeric ratios)
        # Skip if preceded/followed by http, https, or digits only
        text = re.sub(r'(?<!/)(?<!\d)(\b[a-zA-Z]+)\s*/\s*([a-zA-Z]+\b)(?!\d)(?!/)', r'\1 or \2', text)

        # Dot: short pause (lighter for natural flow)
        text = re.sub(r'\.(\s+)', rf'. {self.PAUSE_SHORT} \1', text)

        # Comma: short pause (lighter for natural flow)
        text = re.sub(r',\s+', f', {self.PAUSE_SHORT} ', text)

        # Semicolon: short-medium pause
        text = re.sub(r';\s+', f'; {self.PAUSE_SHORT} ', text)

        # Colon: short-medium pause (for explanations and lists)
        text = re.sub(r':\s+', f': {self.PAUSE_SHORT} ', text)

        # Em dash or en dash: short pause for interruption/aside
        text = re.sub(r'\s*[—–]\s*', f' {self.PAUSE_SHORT} ', text)
        text = re.sub(r'\s*--\s*', f' {self.PAUSE_SHORT} ', text)

        # Parentheses: very brief pause for asides
        # Opening parenthesis
        text = re.sub(r'\(\s*', f'( {self.PAUSE_SHORT} ', text)
        # Closing parenthesis (pause after)
        text = re.sub(r'\s*\)', f' {self.PAUSE_SHORT} )', text)

        # Question mark and exclamation: ensure medium pause (more emphasis)
        text = re.sub(r'([!?])\s+', rf'\1 {self.PAUSE_SHORT} ', text)

        # Period: handled naturally by TTS, just ensure clean spacing
        text = re.sub(r'\.(\s+)', r'. \1', text)

        # En dash in ranges (e.g., "2020-2025"): say "to"
        text = re.sub(r'(\d+)\s*[-–]\s*(\d+)', r'\1 to \2', text)

        # Ellipsis: medium pause (thinking/trailing off)
        text = re.sub(r'\.\.\.+', f' {self.PAUSE_MEDIUM} ', text)

        return text

    def _handle_special_characters(self, text: str) -> str:
        """Convert special characters to speakable text"""
        replacements = {
            '&': ' and ',
            '@': ' at ',
            '#': ' number ',
            '%': ' percent ',
            '+': ' plus ',
            '=': ' equals ',
            '<': ' less than ',
            '>': ' greater than ',
            '→': f' {self.PAUSE_SHORT} then ',
            '←': ' from ',
            '↔': ' and ',
            '✓': ' check ',
            '✗': ' cross ',
            '★': ' star ',
            '©': ' copyright ',
            '®': ' registered ',
            '™': ' trademark ',
            '°': ' degrees ',
            '×': ' times ',
            '÷': ' divided by ',
            '≈': ' approximately ',
            '≠': ' not equal to ',
            '≤': ' less than or equal to ',
            '≥': ' greater than or equal to ',
        }

        for char, replacement in replacements.items():
            text = text.replace(char, replacement)

        return text

    def _add_transition_pauses(self, text: str) -> str:
        """Add pauses before transition words for better comprehension"""
        transition_words = [
            'however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
            'consequently', 'meanwhile', 'additionally', 'alternatively',
            'subsequently', 'nonetheless', 'accordingly', 'hence', 'thus',
            'otherwise', 'instead', 'likewise', 'similarly', 'conversely',
            'in contrast', 'on the other hand', 'in addition', 'as a result',
            'for example', 'for instance', 'in fact', 'indeed', 'notably',
            'specifically', 'particularly', 'importantly', 'significantly',
            'finally', 'lastly', 'in conclusion', 'to summarize', 'overall',
        ]

        for word in transition_words:
            # Add pause after sentence-ending punctuation before transition
            pattern = rf'([.!?])\s+({word})'
            replacement = rf'\1 {self.PAUSE_MEDIUM} \2'
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        return text

    def _format_numbers(self, text: str) -> str:
        """Format numbers for clearer speech"""
        # Handle numbered lists (1. or 1))
        def replace_list_number(match):
            num = int(match.group(1))
            ordinal = self._get_ordinal(num)
            return f"{ordinal}, "

        text = re.sub(r'^(\d{1,2})[.)]\s+', replace_list_number, text, flags=re.MULTILINE)

        # Format large numbers with word separators
        def format_large_number(match):
            num_str = match.group(0).replace(',', '')
            try:
                num = int(num_str)
                if num >= 1000000000:
                    return f"{num / 1000000000:.1f} billion"
                elif num >= 1000000:
                    return f"{num / 1000000:.1f} million"
                elif num >= 10000:
                    return f"{num / 1000:.1f} thousand"
            except ValueError:
                pass
            return match.group(0)

        text = re.sub(r'\b\d{1,3}(?:,\d{3})+\b', format_large_number, text)

        # Format years to be spoken naturally (keep as-is, TTS handles well)
        # Format percentages
        text = re.sub(r'(\d+(?:\.\d+)?)\s*%', r'\1 percent', text)

        return text

    def _clean_for_speech(self, text: str) -> str:
        """Final cleanup for TTS"""
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace("'", "'").replace("'", "'")

        # Remove URLs - replace with "link"
        text = re.sub(r'https?://[^\s]+', ' link ', text)
        text = re.sub(r'www\.[^\s]+', ' link ', text)

        # Remove email addresses - replace with "email address"
        text = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', ' email address ', text)

        # Remove code blocks and inline code
        text = re.sub(r'```[\s\S]*?```', ' code block ', text)
        text = re.sub(r'`[^`]+`', ' code ', text)

        # Remove markdown formatting
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # Bold
        text = re.sub(r'\*([^*]+)\*', r'\1', text)      # Italic
        text = re.sub(r'__([^_]+)__', r'\1', text)      # Bold
        text = re.sub(r'_([^_]+)_', r'\1', text)        # Italic
        # Headers are handled in _format_headers() earlier in the pipeline

        # Remove very long parenthetical content
        def shorten_parenthetical(match):
            content = match.group(1)
            if len(content) > 100:
                return ''
            return f'({content})'

        text = re.sub(r'\(([^)]+)\)', shorten_parenthetical, text)

        # Remove brackets entirely
        text = re.sub(r'\[[^\]]*\]', '', text)

        # Clean up multiple spaces
        text = re.sub(r' +', ' ', text)

        return text

    def _add_paragraph_pauses(self, text: str) -> str:
        """Add longer pauses between paragraphs and line breaks"""
        # First, ensure all lines end with punctuation before line breaks
        # This creates natural pauses at every line break

        # For single line breaks: ensure line ends with period
        def ensure_line_punctuation(match):
            line_content = match.group(1).rstrip()
            # Check if line already ends with punctuation
            if line_content and not line_content[-1] in '.!?;:,':
                return f"{line_content}...\n"  # Use ellipsis for pause effect
            return match.group(0)

        # Match lines followed by single newline (not paragraph break)
        text = re.sub(r'^(.+?)(\n)(?!\n)', ensure_line_punctuation, text, flags=re.MULTILINE)

        # For paragraph breaks (double newlines): add ellipsis for longer pause
        text = re.sub(r'\n\n+', '...\n\n', text)

        return text

    def _convert_pauses_to_ssml(self, text: str) -> str:
        """Remove pause placeholders - Edge TTS doesn't support SSML, relies on natural punctuation"""
        # Simply remove the placeholders since punctuation is already present
        # TTS engines naturally pause at periods, commas, etc.
        text = text.replace(' XPAUSESHORTX ', ' ')
        text = text.replace(' XPAUSEMEDIUMX ', ' ')
        text = text.replace(' XPAUSELONGX ', ' ')
        text = text.replace(' XPAUSEPARAGRAPHX ', '\n\n')  # Keep paragraph breaks
        return text

    def chunk_for_streaming(self, text: str, target_chars: int = 800) -> List[Tuple[int, str]]:
        """
        Split text into chunks optimized for streaming TTS.
        Returns list of (chunk_index, chunk_text) tuples.

        Aims for ~800 chars per chunk which is roughly 1-2 paragraphs,
        about 30-45 seconds of audio at normal speed.
        """
        # First format the text
        formatted = self.format(text)

        # Split by paragraphs first
        paragraphs = re.split(r'\n+', formatted)

        chunks = []
        current_chunk = ""
        chunk_index = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            # If adding this paragraph exceeds target, save current and start new
            if current_chunk and len(current_chunk) + len(para) > target_chars:
                chunks.append((chunk_index, current_chunk.strip()))
                chunk_index += 1
                current_chunk = para + "\n\n"
            # If single paragraph is too long, split by sentences
            elif len(para) > target_chars:
                if current_chunk:
                    chunks.append((chunk_index, current_chunk.strip()))
                    chunk_index += 1
                    current_chunk = ""

                # Split long paragraph by sentences
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) > target_chars:
                        if current_chunk:
                            chunks.append((chunk_index, current_chunk.strip()))
                            chunk_index += 1
                        current_chunk = sentence + " "
                    else:
                        current_chunk += sentence + " "
            else:
                current_chunk += para + "\n\n"

        # Don't forget the last chunk
        if current_chunk.strip():
            chunks.append((chunk_index, current_chunk.strip()))

        return chunks

    def get_first_chunks(self, text: str, num_chunks: int = 2) -> Tuple[List[Tuple[int, str]], List[Tuple[int, str]]]:
        """
        Get first N chunks for immediate playback, and remaining chunks for queuing.
        Returns (first_chunks, remaining_chunks)
        """
        all_chunks = self.chunk_for_streaming(text)
        first = all_chunks[:num_chunks]
        remaining = all_chunks[num_chunks:]
        return first, remaining
