#!/usr/bin/env python3
"""Test the enhanced formatter with comprehensive punctuation and header handling"""

import sys
sys.path.insert(0, '/Users/kinjal/Projects/personal-TTS-assistant/backend')

from services.processing.formatter import ProsodyFormatter

formatter = ProsodyFormatter()

# Test text with various features
test_text = """
# Main Topic: Advanced Features

This is an introduction. However, we need to explore more!

## Key Features

Here are the benefits:
• First benefit
• Second advantage
• Third point

Some examples include: cats, dogs, and/or birds; however, there are others.

### Technical Details

This works for ranges (2020-2025) and ratios (50/50). The result is amazing!

Questions arise: "What does this mean?" Well, it's simple...

Important notes (see documentation) include the following:
- Feature A -- very useful
- Feature B → leads to success
- Feature C

Final thoughts—this is great.
"""

print("=" * 80)
print("ORIGINAL TEXT:")
print("=" * 80)
print(test_text)
print()

print("=" * 80)
print("FORMATTED TEXT:")
print("=" * 80)
formatted = formatter.format(test_text)
print(formatted)
print()

print("=" * 80)
print("CHUNKED FOR STREAMING (first 3 chunks):")
print("=" * 80)
chunks = formatter.chunk_for_streaming(test_text)
for idx, chunk in chunks[:3]:
    print(f"\n--- Chunk {idx} ({len(chunk)} chars) ---")
    print(chunk[:200] + "..." if len(chunk) > 200 else chunk)

print(f"\n\nTotal chunks: {len(chunks)}")
