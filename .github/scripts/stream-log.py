#!/usr/bin/env python3
"""
Pipe claude --output-format stream-json through this script to get
real-time human-readable progress in GitHub Actions logs.

Usage:
  claude --print --output-format stream-json ... | python3 .github/scripts/stream-log.py
"""
import sys
import json

for raw in sys.stdin:
    raw = raw.rstrip('\n')
    if not raw:
        continue

    # Always print the raw JSONL line
    print(raw, flush=True)

    try:
        d = json.loads(raw)
        t = d.get('type', '')

        if t == 'assistant':
            for c in d.get('message', {}).get('content', []):
                ctype = c.get('type', '')
                if ctype == 'tool_use':
                    name = c.get('name', '')
                    inp = json.dumps(c.get('input', {}), ensure_ascii=False)
                    print(f'  🔧 [{name}] {inp[:200]}', flush=True)
                elif ctype == 'text':
                    text = c.get('text', '').strip()
                    if text:
                        print(f'  💬 {text[:300]}', flush=True)

        elif t == 'result':
            subtype = d.get('subtype', 'done')
            cost = d.get('cost_usd')
            parts = [f'subtype={subtype}']
            if cost is not None:
                parts.append(f'cost=${cost:.4f}')
            print(f'  ✅ Result: {" | ".join(parts)}', flush=True)

    except (json.JSONDecodeError, KeyError, TypeError):
        pass
