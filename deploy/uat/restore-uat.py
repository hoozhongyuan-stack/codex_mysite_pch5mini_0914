#!/usr/bin/env python3
"""Verify backups by default; restore only into new databases and a new directory."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile

EXPECTED = {'aition_cms_uat.dump', 'aition_identity_uat.dump', 'persistent.tar'}
PREFIXES = ('srv/aition/shared/files', 'srv/aition/shared/identity', 'srv/aition/shared/mini-release', 'etc/aition')


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def verify(directory):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('format') != 1 or set(manifest.get('files', {})) != EXPECTED:
        raise ValueError('Unsupported or incomplete backup manifest')
    for name, metadata in manifest['files'].items():
        path = directory / name
        if not path.is_file() or path.is_symlink() or path.stat().st_size != metadata['bytes']:
            raise ValueError('Backup file missing or size mismatch: ' + name)
        with path.open('rb') as stream:
            checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
        if checksum != metadata['sha256']:
            raise ValueError('Backup checksum mismatch: ' + name)
    with tarfile.open(directory / 'persistent.tar') as archive:
        for member in archive:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or not any(member.name == p or member.name.startswith(p + '/') for p in PREFIXES):
                raise ValueError('Unsafe or unexpected archive path')
            if not member.isfile() and not member.isdir():
                raise ValueError('Archive links and special files are not accepted')
    for name in sorted(EXPECTED - {'persistent.tar'}):
        run(['pg_restore', '--list', str(directory / name)], stdout=subprocess.DEVNULL)
    return manifest


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root; backups contain private configuration and media.')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup')
    parser.add_argument('--execute', action='store_true', help='Explicitly restore to new isolated targets')
    parser.add_argument('--target-root')
    parser.add_argument('--cms-database')
    parser.add_argument('--identity-database')
    args = parser.parse_args()
    os.umask(0o077)
    directory = Path(args.backup).resolve(strict=True)
    manifest = verify(directory)
    print('Manifest, SHA256, archive paths and PostgreSQL dump headers verified.')
    print('Source release: ' + manifest.get('release', 'unknown'))
    if not args.execute:
        print('Dry run complete. No databases, files or services changed.')
        return
    if not all([args.target_root, args.cms_database, args.identity_database]):
        raise SystemExit('--execute requires --target-root, --cms-database and --identity-database')
    databases = [args.cms_database, args.identity_database]
    if len(set(databases)) != 2 or any(not re.fullmatch(r'[a-z][a-z0-9_]{0,62}', name) for name in databases):
        raise SystemExit('Provide two distinct safe database names')
    if any(name in ('aition_cms_uat', 'aition_identity_uat', 'postgres', 'template0', 'template1') for name in databases):
        raise SystemExit('Live or system database targets are forbidden')
    target = Path(args.target_root)
    if not target.is_absolute() or target.exists() or target.is_symlink():
        raise SystemExit('Target root must be a new absolute directory; existing targets are never replaced')
    lock = open('/run/aition-maintenance.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    for name in databases:
        present = subprocess.check_output(['runuser', '-u', 'postgres', '--', 'psql', '-Atqc', "SELECT 1 FROM pg_database WHERE datname='" + name + "'"])
        if present.strip():
            raise SystemExit('Restore target database already exists: ' + name)
    target.mkdir(mode=0o700, parents=False)
    try:
        for source, name in zip(['aition_cms_uat.dump', 'aition_identity_uat.dump'], databases):
            run(['runuser', '-u', 'postgres', '--', 'createdb', '--encoding=UTF8', '--template=template0', name])
            # postgres cannot traverse the root-private backup directory: stream on stdin.
            with (directory / source).open('rb') as dump:
                run(['runuser', '-u', 'postgres', '--', 'pg_restore', '--exit-on-error', '--single-transaction', '--dbname=' + name], stdin=dump)
            run(['runuser', '-u', 'postgres', '--', 'psql', '--dbname=' + name, '-v', 'ON_ERROR_STOP=1', '-q', '-c', 'REVOKE ALL ON DATABASE ' + name + ' FROM PUBLIC'])
        run(['tar', '--extract', '--file=' + str(directory / 'persistent.tar'), '--directory=' + str(target), '--no-overwrite-dir'])
        print('Restored into isolated targets. No active configuration or services changed.')
        print('Review ownership, credentials and application validation before any separate cutover.')
    except Exception:
        print('Restore failed. Partial isolated targets retained; no automatic delete or live cutover.')
        raise
    finally:
        lock.close()


if __name__ == '__main__':
    main()
