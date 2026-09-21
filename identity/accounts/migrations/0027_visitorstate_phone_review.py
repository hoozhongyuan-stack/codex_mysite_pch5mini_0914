from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('accounts', '0026_visitorstate_mini_profile')]

    operations = [
        migrations.AddField(
            model_name='visitorstate',
            name='phone_review_status',
            field=models.CharField(default='unreviewed', max_length=16),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='phone_reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='visitorstate',
            name='phone_reviewed_by',
            field=models.CharField(blank=True, default='', max_length=254),
        ),
    ]
