#!/usr/bin/env python3
"""envsubst replacement: substitutes ${VAR} patterns with environment variables."""
import os
import re
import sys

content = sys.stdin.read()
result = re.sub(r'\$\{([^}]+)\}', lambda m: os.environ.get(m.group(1), ''), content)
sys.stdout.write(result)
