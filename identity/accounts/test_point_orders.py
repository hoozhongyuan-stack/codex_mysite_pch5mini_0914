from django.test import TestCase
from django.contrib.auth.models import User
from .point_orders import reconcile
from .models import PointAccount, PointEntry
class OrderPointsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('orderpoints')
        self.data = {'userId':self.user.pk, 'id':'order-one', 'points':24, 'phase':'completed'}
    def test_complete_and_refund_only_once(self):
        reconcile(self.data); reconcile(self.data)
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,24)
        reconcile({**self.data,'phase':'refunded'}); reconcile({**self.data,'phase':'refunded'})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,0)
        self.assertEqual(PointEntry.objects.count(),2)
    def test_refund_before_delayed_completion_prevents_reward(self):
        reconcile({**self.data,'phase':'refunded'}); reconcile(self.data)
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,0)
    def test_refund_after_spending_can_be_negative(self):
        from .points import adjust
        reconcile(self.data); adjust(self.user,-24,'spent','兑换','test')
        reconcile({**self.data,'phase':'refunded'})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,-24)
    def test_redemption_insufficient_and_idempotent_refund(self):
        from .point_orders import redemption
        from .points import adjust
        debit={'userId':self.user.pk,'id':'redeem-one','points':10,'action':'debit'}
        with self.assertRaises(ValueError): redemption(debit)
        adjust(self.user,20,'seed','测试','test')
        redemption(debit); redemption(debit)
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,10)
        redemption({**debit,'action':'refund'}); redemption({**debit,'action':'refund'})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,20)
    def test_completed_snapshot_cannot_change_on_retry(self):
        reconcile(self.data)
        with self.assertRaises(ValueError): reconcile({**self.data,'points':25})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,24)
    def test_partial_refunds_before_and_after_completion_and_stale_retry(self):
        base={**self.data,'refundedPoints':8,'completed':False,'phase':'refunded'}
        reconcile(base)
        reconcile({**base,'completed':True,'refundedPoints':0,'phase':'completed'})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,16)
        reconcile({**base,'completed':True,'refundedPoints':16})
        reconcile({**base,'completed':True,'refundedPoints':8})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,8)
        reconcile({**base,'completed':True,'refundedPoints':24})
        self.assertEqual(PointAccount.objects.get(user=self.user).balance,0)
    def test_summary_omits_internal_refund_markers_without_changing_balance(self):
        from .points import summary
        reconcile({**self.data,'refundedPoints':8,'completed':True,'phase':'refunded'})
        result=summary(self.user,{})
        self.assertEqual(result['balance'],16)
        self.assertEqual(result['total'],2)
        self.assertFalse(any(r['source']=='order.refund-marker' for r in result['rows']))
