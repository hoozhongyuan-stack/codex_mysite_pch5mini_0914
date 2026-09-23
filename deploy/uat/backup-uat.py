#!/usr/bin/env python3
"""Consistent root-only UAT snapshot. No backup retention/deletion is automatic."""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import signal
import sys

BASE_SERVICES = ['aition-expiry.service', 'aition-points.service', 'aition-video.service', 'aition-web.service', 'aition-identity.service']
OPTIONAL_SERVICES = ['aition-images.service']
DATABASES = ['aition_cms_uat', 'aition_identity_uat']


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def require_root():
    if os.geteuid() != 0:
        raise SystemExit('Run as root; snapshots include private configuration and media.')


def services():
    return [*BASE_SERVICES, *[
        unit for unit in OPTIONAL_SERVICES
        if subprocess.run(['systemctl', 'cat', unit], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    ]]


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def stop_signal(signum, frame):
    raise SystemExit(128 + signum)


def main():
    signal.signal(signal.SIGTERM, stop_signal)
    require_root()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', default='/var/backups/aition')
    args = parser.parse_args()
    os.umask(0o077)
    destination = Path(args.destination)
    if destination.is_symlink():
        raise SystemExit('Backup directory must not be a symlink')
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    if destination.stat().st_uid != 0 or destination.stat().st_mode & 0o077:
        raise SystemExit('Backup directory must be owned by root with mode 0700')
    for required in ['/srv/aition/shared/files', '/srv/aition/shared/identity', '/etc/aition']:
        if not Path(required).is_dir():
            raise SystemExit('Required persistent directory missing: ' + required)
    lock = open('/run/aition-maintenance.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    staging = destination / ('.incomplete-' + stamp)
    final = destination / stamp
    staging.mkdir(mode=0o700)
    managed = services()
    active = [unit for unit in managed if subprocess.run(['systemctl', 'is-active', '--quiet', unit]).returncode == 0]
    completed = False
    try:
        # Stop every writer, including workers; manual stop suppresses Restart=on-failure.
        run(['systemctl', 'stop', *managed])
        for database in DATABASES:
            with (staging / (database + '.dump')).open('xb') as output:
                run(['runuser', '-u', 'postgres', '--', 'pg_dump', '--format=custom', '--dbname=' + database], stdout=output)
                output.flush()
                os.fsync(output.fileno())
        persistent_paths = ['srv/aition/shared/files', 'srv/aition/shared/identity', 'etc/aition']
        if Path('/srv/aition/shared/mini-release').is_dir():
            persistent_paths.append('srv/aition/shared/mini-release')
        run(['tar', '--create', '--file=' + str(staging / 'persistent.tar'), '--directory=/', *persistent_paths])
        manifest = {
            'format': 1, 'createdAt': stamp, 'databases': DATABASES,
            'release': str(Path('/srv/aition/current').resolve()),
            'servicesPreviouslyActive': active,
            'files': {name: {'sha256': digest(staging / name), 'bytes': (staging / name).stat().st_size} for name in [*(db + '.dump' for db in DATABASES), 'persistent.tar']},
        }
        manifest_path = staging / 'manifest.json'
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        for child in staging.iterdir():
            with child.open('rb') as stream:
                os.fsync(stream.fileno())
        directory = os.open(staging, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        staging.rename(final)
        directory = os.open(destination, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        completed = True
        print('Backup verified and saved: ' + str(final))
    finally:
        if active:
            run(['systemctl', 'start', *reversed(active)])
        if not completed:
            print('Backup incomplete; retained for diagnosis: ' + str(staging), file=sys.stderr)
        lock.close()


if __name__ == '__main__':
    main()
