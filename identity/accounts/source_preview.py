"""Owner-only private source preview with bounded Range streaming."""
import json
import re
from django.core.exceptions import ValidationError
from django.http import JsonResponse, StreamingHttpResponse, HttpResponse
from .models import VideoSource
from .videos import ROOT
from .video_http import authorized


def media_type(header):
 if header.startswith(b'\x1aE\xdf\xa3'):return 'video/webm'
 if header[4:8]==b'ftyp' and header[8:12]==b'qt  ':return 'video/quicktime'
 return 'video/mp4'


def preview(request):
 if not authorized(request):return JsonResponse({'error':'Forbidden'},status=403)
 from .staff_auth import current
 try:
  staff=current(request.headers.get('X-Staff-Session',''))
  if not staff or staff.role!='owner':raise ValueError()
 except ValueError:return JsonResponse({'error':'请登录管理员账号'},status=403)
 try:
  data=json.loads(request.body)
  source=VideoSource.objects.get(pk=data.get('id'),status='ready')
  if not re.fullmatch('[a-f0-9]{32}',source.source):raise ValueError()
  path=ROOT/'originals'/source.source
  size=path.stat().st_size
  if size<=0:raise ValueError()
 except (ValueError,TypeError,AttributeError,ValidationError,VideoSource.DoesNotExist,OSError):
  return JsonResponse({'error':'视频素材不可用'},status=404)
 start,end,status=0,size-1,200
 header=request.headers.get('Range','')
 if header:
  match=re.fullmatch(r'bytes=(\d*)-(\d*)',header)
  try:
   if not match or not any(match.groups()):raise ValueError()
   left,right=match.groups()
   if left:start=int(left);end=min(int(right),size-1) if right else size-1
   else:start=max(0,size-int(right))
   if start>end or start>=size:raise ValueError()
   status=206
  except ValueError:
   response=HttpResponse(status=416);response['Content-Range']=f'bytes */{size}';return response
 def chunks():
  with path.open('rb') as stream:
   stream.seek(start);remaining=end-start+1
   while remaining:
    chunk=stream.read(min(65536,remaining))
    if not chunk:break
    remaining-=len(chunk);yield chunk
 with path.open('rb') as file:mime=media_type(file.read(16))
 response=StreamingHttpResponse(chunks(),status=status,content_type=mime)
 response['Content-Length']=str(end-start+1);response['Accept-Ranges']='bytes'
 response['Cache-Control']='private, no-store';response['X-Content-Type-Options']='nosniff'
 if status==206:response['Content-Range']=f'bytes {start}-{end}/{size}'
 return response
