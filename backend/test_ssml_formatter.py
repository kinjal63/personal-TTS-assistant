#!/usr/bin/env python3
"""Test the SSML-enabled formatter"""

import sys
sys.path.insert(0, '/Users/kinjal/Projects/personal-TTS-assistant/backend')

from services.processing.formatter import ProsodyFormatter

formatter = ProsodyFormatter()

# Test text with various features
test_text = """
# Getting Started

Welcome! Here are the key features:
• Easy setup
• Fast performance
• Great results

For more info: visit our website. However, you should read the docs first.
"""

print("=" * 80)
print("ORIGINAL TEXT:")
print("=" * 80)
print(test_text)
print()

print("=" * 80)
print("FORMATTED TEXT WITH SSML:")
print("=" * 80)
formatted = formatter.format(test_text)
print(formatted)
print()

# Check if SSML tags are present
if '<break' in formatted:
    print("✓ SSML break tags detected!")
else:
    print("✗ No SSML tags found - something is wrong")

# Check if bullet points were converted
if 'First,' in formatted and 'Second,' in formatted:
    print("✓ Bullet points converted to ordinals!")
else:
    print("✗ Bullet points not converted")

# Check if headers were formatted
if 'Next section' in formatted or 'Next.' in formatted:
    print("✓ Headers formatted with announcements!")
else:
    print("✗ Headers not formatted")
