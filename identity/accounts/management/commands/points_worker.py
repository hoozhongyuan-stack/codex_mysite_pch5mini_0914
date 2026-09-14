import time
from django.core.management.base import BaseCommand
from accounts.point_activities import settle
class Command(BaseCommand):
    help = 'Settle completed, checked-in salon points; optionally poll continuously'
    def add_arguments(self, parser): parser.add_argument('--loop', action='store_true')
    def handle(self, *args, **options):
        while True:
            count = settle()
            if count: self.stdout.write(f'Settled {count} activity rewards')
            if not options['loop']: break
            time.sleep(30)
