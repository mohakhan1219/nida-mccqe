#!/usr/bin/env python3
"""Assemble Phase 1 TSX files from staged zlib/parts. Run from repo root, then commit+push."""
import base64, json, zlib, pathlib, hashlib
root = pathlib.Path('.')
man = json.loads((root / '.cursor/phase1-restore/parts.json').read_text())
full_man = json.loads((root / '.cursor/phase1-restore/manifest.json').read_text())
for key, parts in man.items():
    b64 = ''.join((root / p).read_text().strip() for p in parts)
    data = zlib.decompress(base64.b64decode(b64))
    meta = full_man[key]
    assert hashlib.sha256(data).hexdigest() == meta['sha256'], key
    dest = root / meta['dest']
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    print('restored', dest, len(data))
meta = full_man['today']
staging = root / meta['staging']
if staging.exists():
    data = zlib.decompress(base64.b64decode(staging.read_text().strip()))
    assert hashlib.sha256(data).hexdigest() == meta['sha256']
    pathlib.Path(meta['dest']).write_bytes(data)
    print('restored today', len(data))
print('OK')
