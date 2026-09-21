from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0025_audit_target_database_default')]

    operations = [
        migrations.AddField(
            model_name='visitorstate',
            name='nickname',
            field=models.CharField(blank=True, default='', max_length=48),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='avatar_id',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='phone_encrypted',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='phone_digest',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='phone_last4',
            field=models.CharField(blank=True, default='', max_length=4),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='phone_verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name='visitorstate',
            constraint=models.UniqueConstraint(condition=models.Q(('phone_digest__gt', '')), fields=('phone_digest',), name='visitor_phone_digest_unique'),
        ),
    ]
