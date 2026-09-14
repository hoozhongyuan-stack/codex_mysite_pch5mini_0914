from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
class Session(models.Model):
    password_stamp = models.CharField(max_length=64, default='')
    digest = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    expires = models.DateTimeField()
class Token(models.Model):
    password_stamp = models.CharField(max_length=64, default='')
    digest = models.CharField(max_length=64, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    purpose = models.CharField(max_length=10)
    expires = models.DateTimeField()
class Consent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    terms = models.IntegerField()
    privacy = models.IntegerField()
    created = models.DateTimeField(auto_now_add=True)
class Throttle(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    count = models.IntegerField(default=0)
    start = models.FloatField()
class Audit(models.Model):
    actor = models.CharField(max_length=254)
    action = models.CharField(max_length=40)
    target = models.CharField(max_length=80, default='', db_default='', blank=True)
    created = models.DateTimeField(auto_now_add=True)
class VisitorState(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='visitor_state')
    disabled = models.BooleanField(default=False)
    country = models.CharField(max_length=2,default='',blank=True)
    city = models.CharField(max_length=100,default='',blank=True)
    company = models.CharField(max_length=200,default='',blank=True)
    registration_source = models.CharField(max_length=40,default='unknown')
    last_login_method = models.CharField(max_length=40,default='')
    sandbox = models.BooleanField(default=False)

class SocialConfig(models.Model):
    real_enabled = models.BooleanField(default=False)
    client_id = models.CharField(max_length=255, default="", blank=True)
    secret_encrypted = models.TextField(default="", blank=True)
    provider = models.CharField(max_length=20,primary_key=True)
    enabled = models.BooleanField(default=False)
    sort = models.PositiveIntegerField(default=0)
class OAuthFlow(models.Model):
    return_to = models.CharField(max_length=1000, default="")
    binding_session = models.CharField(max_length=64, default="")
    digest = models.CharField(max_length=64, primary_key=True)
    browser = models.CharField(max_length=64)
    provider = models.CharField(max_length=20)
    verifier = models.CharField(max_length=128)
    terms = models.IntegerField()
    privacy = models.IntegerField()
    lang = models.CharField(max_length=2, default="zh")
    expires = models.DateTimeField()

class SocialIdentity(models.Model):
    user = models.ForeignKey(User,on_delete=models.CASCADE,related_name='social_identities')
    provider = models.CharField(max_length=20)
    subject = models.CharField(max_length=64)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['provider','subject'],name='social_provider_subject'),models.UniqueConstraint(fields=['user','provider'],name='social_user_provider')]
class SandboxFlow(models.Model):
    binding_session = models.CharField(max_length=64,default='')
    digest = models.CharField(max_length=64,primary_key=True)
    browser = models.CharField(max_length=64)
    provider = models.CharField(max_length=20)
    expires = models.DateTimeField()

class SalonEvent(models.Model):
    id = models.CharField(max_length=36,primary_key=True)
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=16,default='draft')
    data = models.JSONField(default=dict)
    checkin_code = models.CharField(max_length=64)
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

class SalonRegistration(models.Model):
    id = models.CharField(max_length=36,primary_key=True)
    event = models.ForeignKey(SalonEvent,on_delete=models.PROTECT,related_name='registrations')
    user = models.ForeignKey(User,on_delete=models.PROTECT)
    answers = models.JSONField(default=dict)
    fields = models.JSONField(default=list)
    email = models.EmailField()
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=16,default='active')
    checked_at = models.DateTimeField(null=True)
    checkin_method = models.CharField(max_length=16,default='')
    checkin_actor = models.CharField(max_length=254,default='')
    note = models.TextField(default='')
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['event','user'],name='salon_event_user')]

class SalonLog(models.Model):
    snapshot = models.JSONField(default=dict)
    event = models.ForeignKey(SalonEvent,on_delete=models.PROTECT)
    registration = models.ForeignKey(SalonRegistration,null=True,on_delete=models.PROTECT)
    actor = models.CharField(max_length=254)
    action = models.CharField(max_length=40)
    reason = models.CharField(max_length=500,default='')
    created = models.DateTimeField(auto_now_add=True)

class SalonMail(models.Model):
    claimed_at = models.DateTimeField(null=True)
    registration = models.ForeignKey(SalonRegistration,on_delete=models.PROTECT)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    status = models.CharField(max_length=16,default='pending')
    attempts = models.PositiveIntegerField(default=0)
    created = models.DateTimeField(auto_now_add=True)

class MarketingGrant(models.Model):
    email = models.EmailField(primary_key=True)
    permissions = models.JSONField(default=list)

class StaffAccount(models.Model):
    username=models.CharField(max_length=80,unique=True)
    email=models.EmailField(unique=True)
    password=models.CharField(max_length=256)
    role=models.CharField(max_length=16,default='editor')
    active=models.BooleanField(default=True)
    must_change=models.BooleanField(default=True)
    bootstrap=models.BooleanField(default=False)

class StaffSession(models.Model):
    digest=models.CharField(max_length=64,primary_key=True)
    account=models.ForeignKey(StaffAccount,on_delete=models.CASCADE)
    password_stamp=models.CharField(max_length=64)
    expires=models.DateTimeField()

class PermissionGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=__import__('uuid').uuid4, editable=False)
    name = models.CharField(max_length=80, unique=True)
    permissions = models.JSONField(default=list)
    active = models.BooleanField(default=True)
    revision = models.PositiveIntegerField(default=1)
    updated = models.DateTimeField(auto_now=True)

class StaffPermissionAssignment(models.Model):
    account = models.OneToOneField(StaffAccount, primary_key=True, on_delete=models.CASCADE)
    groups = models.ManyToManyField(PermissionGroup)
    revision = models.PositiveIntegerField(default=0)

class PermissionAudit(models.Model):
    actor = models.CharField(max_length=254)
    action = models.CharField(max_length=40)
    target = models.CharField(max_length=254)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    created = models.DateTimeField(auto_now_add=True)

class VideoSeries(models.Model):
    id=models.UUIDField(primary_key=True,default=__import__('uuid').uuid4,editable=False)
    data=models.JSONField(default=dict)
    status=models.CharField(max_length=16,default='draft')
    updated=models.DateTimeField(auto_now=True)
class VideoEpisode(models.Model):
    id=models.UUIDField(primary_key=True,default=__import__('uuid').uuid4,editable=False)
    series=models.ForeignKey(VideoSeries,on_delete=models.PROTECT)
    data=models.JSONField(default=dict)
    status=models.CharField(max_length=16,default='draft')
    version=models.CharField(max_length=64,default='')
    duration=models.FloatField(default=0)
    updated=models.DateTimeField(auto_now=True)
class VideoJob(models.Model):
    id=models.UUIDField(primary_key=True,default=__import__('uuid').uuid4,editable=False)
    episode=models.ForeignKey(VideoEpisode,on_delete=models.CASCADE)
    source=models.CharField(max_length=64)
    status=models.CharField(max_length=16,default='queued')
    error=models.CharField(max_length=250,default='')
    updated=models.DateTimeField(auto_now=True)
class VideoPlayback(models.Model):
    digest=models.CharField(primary_key=True,max_length=64)
    episode=models.ForeignKey(VideoEpisode,on_delete=models.CASCADE)
    viewer=models.CharField(max_length=64)
    version=models.CharField(max_length=64)
    expires=models.DateTimeField()
    created=models.DateTimeField(auto_now_add=True)
class VideoProgress(models.Model):
    episode=models.ForeignKey(VideoEpisode,on_delete=models.CASCADE)
    viewer=models.CharField(max_length=64)
    position=models.FloatField(default=0)
    seconds=models.FloatField(default=0)
    completed=models.BooleanField(default=False)
    updated=models.DateTimeField(auto_now=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['episode','viewer'],name='video_viewer_episode')]
class VideoSecurityLog(models.Model):
    reason=models.CharField(max_length=100)
    created=models.DateTimeField(auto_now_add=True)

class VideoSource(models.Model):
    id=models.UUIDField(primary_key=True,default=__import__('uuid').uuid4,editable=False)
    source=models.CharField(max_length=64,unique=True)
    name=models.CharField(max_length=200)
    size=models.BigIntegerField()
    received=models.BigIntegerField(default=0)
    folder=models.CharField(max_length=80,default='')
    status=models.CharField(max_length=16,default='uploading')
    owner=models.CharField(max_length=80,default='')
    updated=models.DateTimeField(auto_now=True)

class PointAccount(models.Model):
    user = models.OneToOneField(User, on_delete=models.PROTECT)
    balance = models.BigIntegerField(default=0)

class PointRule(models.Model):
    enabled_since = models.DateTimeField(default=timezone.now)
    key = models.CharField(max_length=40, primary_key=True)
    amount = models.PositiveIntegerField(default=0)
    enabled = models.BooleanField(default=False)

class PointEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    key = models.CharField(max_length=200)
    amount = models.BigIntegerField()
    balance = models.BigIntegerField()
    source = models.CharField(max_length=40)
    target = models.CharField(max_length=100, default='')
    reason = models.CharField(max_length=300, default='')
    actor = models.CharField(max_length=254, default='system')
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'key'], name='point_user_key_unique')]
        ordering = ['-id']

class ContentInteraction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    kind = models.CharField(max_length=16)
    target = models.CharField(max_length=100)
    action = models.CharField(max_length=16)
    active = models.BooleanField(default=True)
    title = models.CharField(max_length=200, default='')
    path = models.CharField(max_length=300, default='')
    updated = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'kind', 'target', 'action'], name='content_interaction_unique')]

class PointRuleRevision(models.Model):
    key = models.CharField(max_length=40)
    amount = models.PositiveIntegerField(default=0)
    enabled = models.BooleanField(default=False)
    effective_at = models.DateTimeField()
    class Meta:
        indexes = [models.Index(fields=['key', 'effective_at'])]
