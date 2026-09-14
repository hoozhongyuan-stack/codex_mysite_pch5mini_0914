#!/usr/bin/env python3
"""Switch current to an existing release; never roll back database or persistent data."""
import argparse
import fcntl
import os
from pathlib import Path
import subprocess
import signal
import uuid

SERVICES = ['aition-expiry.service', 'aition-points.service', 'aition-video.service', 'aition-web.service', 'aition-identity.service']


def run(args):
    subprocess.run(args, check=True)


def switch(current, target):
    temporary = current.parent / ('.current-' + uuid.uuid4().hex)
    temporary.symlink_to(target)
    os.replace(temporary, current)


def stop_signal(signum, frame):
    raise SystemExit(128 + signum)


def main():
    signal.signal(signal.SIGTERM, stop_signal)
    if os.geteuid() != 0:
        raise SystemExit('Run as root')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('release', help='Existing release folder name, not a path')
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    if args.release in ('.', '..') or '/' in args.release or '\\' in args.release:
        raise SystemExit('Provide one release directory name')
    releases = Path('/srv/aition/releases').resolve()
    target = (releases / args.release).resolve(strict=True)
    if target.parent != releases or not target.is_dir():
        raise SystemExit('Target must be a direct existing release directory')
    for required in ['web/server.js', 'identity/manage.py', 'scripts/order-expiry-worker.mjs']:
        if not (target / required).is_file():
            raise SystemExit('Release is incomplete: ' + required)
    current = Path('/srv/aition/current')
    if not current.is_symlink():
        raise SystemExit('Current release must be an existing symlink')
    previous = current.resolve(strict=True)
    print('Release switch: ' + str(previous) + ' -> ' + str(target))
    print('Database and persistent files remain unchanged; verify schema compatibility first.')
    if not args.execute:
        print('Dry run complete; pass --execute after compatibility review.')
        return
    lock = open('/run/aition-maintenance.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    active = [unit for unit in SERVICES if subprocess.run(['systemctl', 'is-active', '--quiet', unit]).returncode == 0]
    try:
        run(['systemctl', 'stop', *SERVICES])
        switch(current, target)
        if active:
            run(['systemctl', 'start', *reversed(active)])
            run(['systemctl', 'is-active', '--quiet', *active])
        print('Release switched. Perform authenticated and business-flow checks before acceptance.')
    except BaseException:
        run(['systemctl', 'stop', *SERVICES])
        switch(current, previous)
        if active:
            run(['systemctl', 'start', *reversed(active)])
        print('Release switch failed; previous link restored. Inspect service logs.')
        raise
    finally:
        lock.close()


if __name__ == '__main__':
    main()
