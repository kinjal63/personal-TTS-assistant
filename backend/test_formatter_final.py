#!/usr/bin/env python3
"""Test the enhanced formatter with realistic article content"""

import sys
sys.path.insert(0, '/Users/kinjal/Projects/personal-TTS-assistant/backend')

from services.processing.formatter import ProsodyFormatter

formatter = ProsodyFormatter()

# Realistic article content with various features
article_text = """
# Understanding AI in 2025

Artificial intelligence has transformed how we work, communicate, and/or solve problems.

## Key Applications

The main use cases include:
• Healthcare diagnostics
• Financial forecasting
• Autonomous vehicles

### Market Growth

The AI market grew from $50 billion in 2020-2025. Revenue increased by a 40/60 split between software and hardware.

## Technical Considerations

Implementation requires careful planning: data quality, model selection, and deployment strategy. However, many teams rush this process.

What makes a good AI project? Three factors:
1. Clear objectives
2. Quality data
3. Expert oversight

### Best Practices

Important guidelines (see documentation):
- Start small -- test your assumptions
- Iterate quickly → improve continuously
- Monitor performance

As Prof. Smith noted, "AI is a tool, not magic." Therefore, realistic expectations are essential!

The future looks promising... but challenges remain (e.g., bias, privacy, cost). Organizations must address these concerns ASAP.

## Conclusion

In summary: AI offers tremendous value when implemented thoughtfully. Success requires both technical skill and business acumen; moreover, ethical considerations cannot be ignored.
"""

print("=" * 80)
print("FORMATTED ARTICLE:")
print("=" * 80)
formatted = formatter.format(article_text)
print(formatted)
print()

print("=" * 80)
print("SAMPLE CHUNKS (first 2):")
print("=" * 80)
chunks = formatter.chunk_for_streaming(article_text)
for idx, chunk in chunks[:2]:
    print(f"\n--- Chunk {idx} ---")
    print(chunk)
    print(f"({len(chunk)} chars, ~{len(chunk.split())} words)")

print(f"\n\nTotal chunks: {len(chunks)}")
print(f"Estimated audio duration: ~{sum(len(c[1].split()) for c in chunks) / 150:.1f} minutes")
