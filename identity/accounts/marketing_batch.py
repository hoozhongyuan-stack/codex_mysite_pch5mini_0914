"""Explicit selection actions. Each event commits independently; never emails."""
import re
from django.db import transaction
from django.db.models.deletion import ProtectedError
from .models import SalonEvent, SalonLog, Audit
from .marketing import save_event, event_dict

def batch_events(data,actor):
    ids=data.get('selected')
    if not isinstance(ids,list) or not 1<=len(ids)<=100 or any(not isinstance(x,str) or not re.fullmatch(r'[\w-]{1,36}',x) for x in ids) or len(set(ids))!=len(ids):
        raise ValueError('请选择1至100条不重复的活动')
    operation=data.get('operation')
    if operation not in ('publish','unpublish','delete','export'):raise ValueError('批量操作无效')
    results=[];rows=[]
    for key in ids:
        try:
            with transaction.atomic():
                event=SalonEvent.objects.select_for_update().filter(pk=key).first()
                if not event:raise ValueError('活动不存在')
                if operation=='export':
                    row=event_dict(event)
                    rows.append({k:row.get(k,'') for k in ('id','titleZh','titleEn','status','starts','ends','locationZh')})
                elif operation=='delete':
                    if event.status!='draft' or event.registrations.exists():raise ValueError('仅无报名历史的草稿可删除')
                    # Non-draft history must remain; only draft save logs may be removed.
                    if SalonLog.objects.filter(event=event).exclude(action='save-event').exists():raise ValueError('已有操作历史，请归档保留')
                    Audit.objects.create(actor=actor,action='salon-delete',target=str(event.pk))
                    SalonLog.objects.filter(event=event,action='save-event').delete()
                    event.delete()
                else:
                    if event.data.get('test'):raise ValueError('历史测试活动不可批量发布')
                    if operation=='publish' and event.status not in ('draft','published'):raise ValueError('当前状态不可批量发布')
                    save_event({**event.data,'id':str(event.pk),'status':'published' if operation=='publish' else 'draft'},actor)
                results.append({'id':key,'ok':True})
        except ProtectedError:results.append({'id':key,'ok':False,'error':'活动存在关联历史，请归档保留'})
        except ValueError as exc:results.append({'id':key,'ok':False,'error':str(exc)})
    if operation=='export':Audit.objects.create(actor=actor,action='salon-export')
    return {'results':results,'rows':rows}
