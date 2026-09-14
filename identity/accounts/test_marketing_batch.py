from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from .marketing import save_event
from .marketing_batch import batch_events
from .models import SalonEvent, SalonLog, SalonRegistration, SalonMail, Audit

class MarketingBatchTests(TestCase):
    def setUp(self):
        now=timezone.now()
        self.data={'titleZh':'活动','titleEn':'Event','status':'draft','starts':(now+timedelta(hours=1)).isoformat(),'ends':(now+timedelta(hours=3)).isoformat(),'registrationStarts':(now-timedelta(hours=1)).isoformat(),'registrationEnds':(now+timedelta(minutes=30)).isoformat(),'checkinStarts':now.isoformat(),'checkinEnds':(now+timedelta(hours=2)).isoformat(),'cancelEnds':now.isoformat(),'fields':[],'test':False}
    def event(self,**changes):
        return save_event({**self.data,**changes},'owner')['event']['id']
    def run_batch(self,operation,ids):
        return batch_events({'selected':ids,'operation':operation},'operator@example.test')
    def test_selection_and_operations_are_bounded(self):
        for ids in ([],['a','a'],[None],['x']*101):
            with self.assertRaises(ValueError):self.run_batch('publish',ids)
        with self.assertRaises(ValueError):self.run_batch('refund',['a'])
    def test_publish_commits_valid_rows_and_reports_invalid_row(self):
        good=self.event();bad=self.event(titleEn='')
        result=self.run_batch('publish',[bad,good])
        self.assertEqual([r['ok'] for r in result['results']],[False,True])
        self.assertEqual(SalonEvent.objects.get(pk=bad).status,'draft')
        self.assertEqual(SalonEvent.objects.get(pk=good).status,'published')
        self.assertEqual(SalonMail.objects.count(),0)
    def test_closed_and_test_events_cannot_be_published(self):
        closed=self.event(status='closed');demo=self.event(test=True)
        self.assertEqual([r['ok'] for r in self.run_batch('publish',[closed,demo])['results']],[False,False])
    def test_registration_history_blocks_unpublish_and_delete(self):
        key=self.event(status='published');user=User.objects.create_user('batch-user')
        SalonRegistration.objects.create(event_id=key,user=user,status='cancelled',answers={},fields=[])
        self.assertFalse(self.run_batch('unpublish',[key])['results'][0]['ok'])
        SalonEvent.objects.filter(pk=key).update(status='draft')
        self.assertFalse(self.run_batch('delete',[key])['results'][0]['ok'])
        self.assertTrue(SalonEvent.objects.filter(pk=key).exists())
    def test_delete_preserves_business_history_and_records_actor(self):
        clean=self.event();history=self.event()
        SalonLog.objects.create(event_id=history,actor='owner',action='export')
        result=self.run_batch('delete',[clean,history])
        self.assertEqual([r['ok'] for r in result['results']],[True,False])
        self.assertTrue(Audit.objects.filter(actor='operator@example.test',action='salon-delete',target=str(clean)).exists())
    def test_export_excludes_private_codes_and_registration_fields(self):
        key=self.event()
        result=self.run_batch('export',[key]);row=result['rows'][0]
        self.assertEqual(set(row),{'id','titleZh','titleEn','status','starts','ends','locationZh'})
        self.assertNotIn('checkinCode',row)
        self.assertTrue(Audit.objects.filter(actor='operator@example.test',action='salon-export').exists())
