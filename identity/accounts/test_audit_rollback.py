from django.db import connection
from django.test import TestCase
from django.utils import timezone

from .models import Audit


class AuditRollbackCompatibilityTests(TestCase):
    def test_legacy_writer_can_omit_new_target_column(self):
        # The previous release's model inserts only these three columns.
        with connection.cursor() as cursor:
            cursor.execute(
                'INSERT INTO accounts_audit (actor, action, created) VALUES (%s, %s, %s)',
                ['rollback@example.test', 'staff-login', timezone.now()],
            )
        self.assertEqual(Audit.objects.get(actor='rollback@example.test').target, '')

    def test_current_writer_keeps_explicit_target(self):
        audit = Audit.objects.create(actor='current@example.test', action='salon-delete', target='event-test')
        audit.refresh_from_db()
        self.assertEqual(audit.target, 'event-test')
