"""Run under a process supervisor in production. Pending mail is durable."""
import time
from django.core.management.base import BaseCommand
from accounts.models import SalonMail
from accounts.marketing_admin import send_pending
class Command(BaseCommand):
    help='Deliver pending salon notifications; --loop keeps a local worker alive'
    def add_arguments(self,parser):parser.add_argument('--loop',action='store_true')
    def handle(self,*args,**options):
        while True:
            events=list(SalonMail.objects.filter(status__in=['pending','failed','sending'],attempts__lt=3).values_list('registration__event_id',flat=True).distinct()[:50])
            for key in events:send_pending(key,1)
            if not options['loop']:break
            time.sleep(10)
