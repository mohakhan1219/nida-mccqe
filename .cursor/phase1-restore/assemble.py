#!/usr/bin/env python3
"""Assemble Phase 1 TSX files from zlib.b64 staging blobs. Run from repo root, then git add/commit/push."""
import base64, json, zlib, pathlib, hashlib
root = pathlib.Path('.')
full_man = json.loads((root / '.cursor/phase1-restore/manifest.json').read_text())
for key, meta in full_man.items():
    staging = root / meta['staging']
    data = zlib.decompress(base64.b64decode(staging.read_text().strip()))
    assert hashlib.sha256(data).hexdigest() == meta['sha256'], (key, hashlib.sha256(data).hexdigest())
    dest = root / meta['dest']
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print('restored', dest, len(data), meta['sha256'][:16])
print('OK')
