"""Local verification only; never invokes server tools or reads real snapshots."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


restore = load('restore-uat')
backup = load('backup-uat')


class BackupVerificationTests(unittest.TestCase):
    def snapshot(self, directory, member='srv/aition/shared/files/item'):
        for name in ['aition_cms_uat.dump', 'aition_identity_uat.dump']:
            (directory / name).write_bytes(b'synthetic dump')
        with tarfile.open(directory / 'persistent.tar', 'w') as archive:
            info = tarfile.TarInfo(member)
            info.size = 1
            archive.addfile(info, io.BytesIO(b'x'))
        manifest = {'format': 1, 'files': {name: {'bytes': (directory / name).stat().st_size, 'sha256': hashlib.sha256((directory / name).read_bytes()).hexdigest()} for name in restore.EXPECTED}}
        (directory / 'manifest.json').write_text(json.dumps(manifest))

    def test_verification_reads_only_and_checks_dump_headers(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.snapshot(directory)
            with patch.object(restore, 'run') as run:
                restore.verify(directory)
                self.assertEqual(run.call_count, 2)
                for call in run.call_args_list:
                    self.assertEqual(call.args[0][:2], ['pg_restore', '--list'])

    def test_tampered_snapshot_rejected_before_restore(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.snapshot(directory)
            (directory / 'aition_cms_uat.dump').write_bytes(b'tampered')
            with patch.object(restore, 'run') as run:
                with self.assertRaisesRegex(ValueError, 'size mismatch'):
                    restore.verify(directory)
                run.assert_not_called()

    def test_archive_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.snapshot(directory, '../../etc/passwd')
            with patch.object(restore, 'run') as run:
                with self.assertRaisesRegex(ValueError, 'Unsafe'):
                    restore.verify(directory)
                run.assert_not_called()

    def test_release_key_directory_is_accepted_in_persistent_snapshot(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.snapshot(directory, 'srv/aition/shared/mini-release/records.json')
            with patch.object(restore, 'run') as run:
                restore.verify(directory)
                self.assertEqual(run.call_count, 2)


    def test_termination_raises_to_unwind_finally(self):
        with self.assertRaises(SystemExit) as result:
            backup.stop_signal(15, None)
        self.assertEqual(result.exception.code, 143)


if __name__ == '__main__':
    unittest.main()
