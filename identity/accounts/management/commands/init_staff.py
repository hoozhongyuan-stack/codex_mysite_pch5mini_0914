import os
from django.core.management.base import BaseCommand,CommandError
from django.contrib.auth.hashers import make_password
from django.core.validators import validate_email
from accounts.models import StaffAccount
from accounts.staff_auth import valid_password
class Command(BaseCommand):
    help='Create the first administrator once, using environment credentials.'
    def handle(self,*args,**options):
        if StaffAccount.objects.exists():self.stdout.write('Administrator already initialized; unchanged.');return
        username=os.environ.get('INITIAL_ADMIN_USERNAME','').strip().lower()
        email=os.environ.get('INITIAL_ADMIN_EMAIL','').strip().lower()
        if not 3<=len(username)<=80 or not all(c.isalnum() or c in '._-@' for c in username):raise CommandError('Set INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD securely.')
        validate_email(email)
        password=valid_password(os.environ.get('INITIAL_ADMIN_PASSWORD',''))
        StaffAccount.objects.create(username=username,email=email,password=make_password(password),role='owner',bootstrap=True)
        self.stdout.write('Initial administrator created; password change required.')
