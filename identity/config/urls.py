from accounts.source_preview import preview
from django.urls import path
from accounts.views import endpoint
from accounts.video_library import chunk
from accounts.video_http import upload, file
urlpatterns = [path('video-source-preview',preview),path('video-source-chunk',chunk),path('video-upload',upload),path('video-file',file),path('<str:action>', endpoint)]
