import re


class ProsodyFormatter:
    """Prepare text for natural-sounding TTS output with prosody hints"""

    def format(self, text: str) -> str:
        """Apply all formatting rules for TTS"""
        text = self._add_pauses(text)
        text = self._handle_lists(text)
        text = self._clean_for_speech(text)
        return text

    def _add_pauses(self, text: str) -> str:
        """Add pause markers for natural rhythm"""
        # Pause before transition words
        transition_words = [
            "however",
            "therefore",
            "furthermore",
            "moreover",
            "nevertheless",
            "consequently",
            "meanwhile",
            "additionally",
            "alternatively",
            "subsequently",
        ]

        for word in transition_words:
            text = re.sub(
                rf"([.!?])\s+({word})",
                rf"\1 ... \2",
                text,
                flags=re.IGNORECASE,
            )

        # Add slight pause after colons
        text = re.sub(r":\s+", ": ... ", text)

        return text

    def _handle_lists(self, text: str) -> str:
        """Format lists for clear speech"""
        # Add "first", "second", etc. for numbered lists
        def replace_number(match):
            num = int(match.group(1))
            ordinals = {
                1: "First",
                2: "Second",
                3: "Third",
                4: "Fourth",
                5: "Fifth",
                6: "Sixth",
                7: "Seventh",
                8: "Eighth",
                9: "Ninth",
                10: "Tenth",
            }
            ordinal = ordinals.get(num, f"Number {num}")
            return f"{ordinal}: "

        text = re.sub(r"^(\d+)[.)]\s+", replace_number, text, flags=re.MULTILINE)

        return text

    def _clean_for_speech(self, text: str) -> str:
        """Final cleanup for TTS"""
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace("'", "'").replace("'", "'")

        # Remove parenthetical asides that might confuse TTS
        # Keep short ones, remove very long ones
        def shorten_parenthetical(match):
            content = match.group(1)
            if len(content) > 100:
                return ""
            return f"({content})"

        text = re.sub(r"\(([^)]+)\)", shorten_parenthetical, text)

        return text

    def chunk_for_streaming(self, text: str, max_chars: int = 500) -> list[str]:
        """Split text into chunks for streaming TTS"""
        # Split by sentence boundaries
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunks = []
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) < max_chars:
                current_chunk += sentence + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                # Handle very long sentences
                if len(sentence) > max_chars:
                    # Split by commas or other natural break points
                    parts = re.split(r"(?<=[,;:])\s+", sentence)
                    sub_chunk = ""
                    for part in parts:
                        if len(sub_chunk) + len(part) < max_chars:
                            sub_chunk += part + " "
                        else:
                            if sub_chunk:
                                chunks.append(sub_chunk.strip())
                            sub_chunk = part + " "
                    current_chunk = sub_chunk
                else:
                    current_chunk = sentence + " "

        if current_chunk:
            chunks.append(current_chunk.strip())

        return chunks
