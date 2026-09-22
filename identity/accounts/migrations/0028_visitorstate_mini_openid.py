# Generated for mini-program subscription messages.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0027_visitorstate_phone_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='visitorstate',
            name='mini_openid_encrypted',
            field=models.TextField(blank=True, default=''),
        ),
    ]
