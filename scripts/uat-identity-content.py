#!/usr/bin/env python3
"""Explicit content-only UAT transfer. No member/transaction/credential tables.

export --database /absolute/identity.sqlite3 --video-root /absolute/videos --output bundle.json
import --bundle bundle.json --video-root /staged/videos (requires UAT PostgreSQL env)
Video manifests reference private originals only; UAT generates fresh playback keys.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import sqlite3
import sys
import uuid

VIDEO_FIELDS = {'titleZh','titleEn','summaryZh','summaryEn','bodyZh','bodyEn','imageId','sort'}
SALON_FIELDS = {'titleZh','titleEn','summaryZh','summaryEn','organizer','locationZh','locationEn','addressZh','addressEn','contact','phone','imageId','timezone','starts','ends','registrationStarts','registrationEnds','checkinStarts','checkinEnds','cancelEnds','capacity','allowCancel','fields','bodyZh','bodyEn','assetIds'}
ROW_FIELDS = {'VideoSeries': {'id','data','status'}, 'VideoEpisode': {'id','series_id','data','status'},
              'VideoSource': {'id','source','name','size','folder'},
              'SalonEvent': {'id','title','status','data'}, 'PointRule': {'key','amount','enabled'}}
DATA_FIELDS = {'VideoSeries': VIDEO_FIELDS | {'type','finished'},
               'VideoEpisode': VIDEO_FIELDS | {'preview','sourceId','sourceName'}, 'SalonEvent': SALON_FIELDS}


def empty_bundle():
    return {'format':'identity-content-v1','content':{key:[] for key in ROW_FIELDS},'videoFiles':[],'assetIds':[]}


def cleaned_data(model, raw):
    value = json.loads(raw) if isinstance(raw,str) else raw
    if not isinstance(value,dict): raise ValueError('Invalid content data')
    result = {key:value[key] for key in DATA_FIELDS[model] if key in value}
    if model == 'SalonEvent' and 'fields' in result:
        result['fields'] = [{key:field[key] for key in ('id','type','labelZh','labelEn','required') if key in field} for field in result['fields']]
    return result


def video_path(root, source):
    if not isinstance(source,str) or not re.fullmatch('[a-f0-9]{32}',source):
        raise ValueError('Invalid video source filename')
    root = root.resolve()
    path = root / 'originals' / source
    if path.is_symlink() or path.resolve().parent != root / 'originals':
        raise ValueError('Video source escapes private originals directory')
    return path


def file_digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()


def export_content(database, video_root):
    bundle = empty_bundle()
    # mode=ro protects the original database; never run Django migrations here.
    connection = sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute('BEGIN')  # One consistent read snapshot across allowlisted tables.
    try:
        for model in ROW_FIELDS:
            if model == 'VideoSource': continue
            columns = sorted(ROW_FIELDS[model])
            rows = connection.execute('SELECT ' + ','.join(columns) + ' FROM accounts_' + model.lower())
            for row in rows:
                record = dict(row)
                if model in DATA_FIELDS: record['data'] = cleaned_data(model,record['data'])
                if model.startswith('Video'):
                    record['id'] = str(uuid.UUID(record['id']))
                    if model == 'VideoEpisode': record['series_id'] = str(uuid.UUID(record['series_id']))
                if model == 'PointRule': record['enabled'] = bool(record['enabled'])
                bundle['content'][model].append(record)
        selected_sources = {}
        for episode in bundle['content']['VideoEpisode']:
            source_id = episode['data'].get('sourceId')
            if source_id:
                row = connection.execute('SELECT id,source,name,size,folder,status,received FROM accounts_videosource WHERE id=?', (uuid.UUID(source_id).hex,)).fetchone()
                if not row or row['status'] != 'ready' or row['received'] != row['size']:
                    raise ValueError('Referenced video source is unavailable; resolve before exporting')
                record = {key:row[key] for key in ROW_FIELDS['VideoSource']}
                record['id'] = str(uuid.UUID(record['id']))
            else:
                # Legacy direct uploads have no reusable VideoSource. Read only
                # the last successful job's filename, never copy job history.
                job = connection.execute("SELECT source FROM accounts_videojob WHERE episode_id=? AND status='ready' ORDER BY updated DESC LIMIT 1", (uuid.UUID(episode['id']).hex,)).fetchone()
                if not job:
                    if episode['status'] == 'published':
                        raise ValueError('Published legacy episode has no source for re-encoding')
                    continue
                path = video_path(video_root,job['source'])
                existing = connection.execute('SELECT id,source,name,size,folder FROM accounts_videosource WHERE source=? AND status=?', (job['source'],'ready')).fetchone()
                if existing:
                    # A legacy episode and a library episode can share a file.
                    # Reuse its canonical source ID; never duplicate the manifest.
                    record = {key:existing[key] for key in ROW_FIELDS['VideoSource']}
                    record['id'] = str(uuid.UUID(record['id']))
                else:
                    record = {'id':str(uuid.uuid5(uuid.NAMESPACE_URL,'uat-video-source:' + job['source'])),
                              'source':job['source'],'name':'Imported video original','size':path.stat().st_size,'folder':''}
                episode['data'] = {**episode['data'],'sourceId':record['id'],'sourceName':record['name']}
            selected_sources[record['id']] = record
        for record in selected_sources.values():
            path = video_path(video_root,record['source'])
            if not path.is_file() or path.stat().st_size != record['size']:
                raise ValueError('Referenced video source file is unavailable or incomplete')
            bundle['content']['VideoSource'].append(record)
            bundle['videoFiles'].append({'source':record['source'],'size':record['size'],'sha256':file_digest(path)})
    finally:
        connection.close()
    assets = set()
    for model in DATA_FIELDS:
        for row in bundle['content'][model]:
            data = row['data']
            if data.get('imageId'): assets.add(data['imageId'])
            assets.update(data.get('assetIds',[]))
            for body in ('bodyZh','bodyEn'):
                assets.update(re.findall(r'/api/media/([a-f0-9-]{36})',json.dumps(data.get(body,''))))
    bundle['assetIds'] = sorted(assets)
    validate_bundle(bundle)
    return bundle


def validate_bundle(bundle):
    if set(bundle) != {'format','content','videoFiles','assetIds'} or bundle['format'] != 'identity-content-v1':
        raise ValueError('Unknown content bundle format')
    if set(bundle['content']) != set(ROW_FIELDS): raise ValueError('Model is not on content allowlist')
    for model,rows in bundle['content'].items():
        seen = set()
        for row in rows:
            if set(row) != ROW_FIELDS[model]: raise ValueError('Unexpected or missing content field')
            key = row.get('id',row.get('key'))
            if key in seen: raise ValueError('Duplicate content ID')
            seen.add(key)
            if model in DATA_FIELDS and row['data'] != cleaned_data(model,row['data']):
                raise ValueError('Unexpected content data fields')
    sources = {row['id']:row for row in bundle['content']['VideoSource']}
    series = {row['id'] for row in bundle['content']['VideoSeries']}
    for episode in bundle['content']['VideoEpisode']:
        if episode['series_id'] not in series: raise ValueError('Episode series missing')
        source = episode['data'].get('sourceId')
        if source and source not in sources: raise ValueError('Episode source missing')
    files = {row['source']:row for row in bundle['videoFiles']}
    if len(files) != len(bundle['videoFiles']) or set(files) != {row['source'] for row in sources.values()}:
        raise ValueError('Video manifest differs from selected sources')
    for source in sources.values():
        if source['size'] != files[source['source']]['size']:
            raise ValueError('Video source size differs from manifest')
    for file in files.values():
        if set(file) != {'source','size','sha256'} or not re.fullmatch('[a-f0-9]{64}',file['sha256']):
            raise ValueError('Invalid video manifest')
        video_path(Path('/private-placeholder'),file['source'])


def import_content(bundle, video_root):
    validate_bundle(bundle)
    if os.environ.get('IDENTITY_ENV') != 'uat': raise ValueError('Import requires IDENTITY_ENV=uat')
    sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'identity'))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
    import django
    django.setup()
    from django.conf import settings
    from django.db import transaction, connection
    from django.utils import timezone
    from accounts import models
    if connection.vendor != 'postgresql': raise ValueError('Import requires PostgreSQL')
    for model in ROW_FIELDS:
        if getattr(models,model).objects.exists(): raise ValueError('Target content tables must be empty; refusing overwrite')
    destination = settings.DATA_DIR / 'videos'
    originals = destination / 'originals'
    originals.mkdir(parents=True,exist_ok=True,mode=0o700)
    created = []
    try:
        for item in bundle['videoFiles']:
            source = video_path(video_root,item['source'])
            if source.stat().st_size != item['size'] or file_digest(source) != item['sha256']:
                raise ValueError('Video staging file differs from manifest')
            target = video_path(destination,item['source'])
            with target.open('xb') as output, source.open('rb') as input_file:
                os.chmod(target,0o600)
                created.append(target)
                shutil.copyfileobj(input_file,output)
                output.flush();os.fsync(output.fileno())
        with transaction.atomic():
            for row in bundle['content']['VideoSeries']: models.VideoSeries.objects.create(**row)
            for row in bundle['content']['VideoSource']:
                models.VideoSource.objects.create(**row,received=row['size'],owner='',status='ready')
            for row in bundle['content']['VideoEpisode']:
                # Never reuse old encrypted HLS or grants. Re-encode original on UAT.
                episode = models.VideoEpisode.objects.create(**row,version='',duration=0)
                source_id = row['data'].get('sourceId')
                if source_id:
                    source = models.VideoSource.objects.get(pk=source_id)
                    models.VideoJob.objects.create(episode=episode,source=source.source,status='queued')
            for row in bundle['content']['SalonEvent']:
                models.SalonEvent.objects.create(**row,checkin_code=secrets.token_urlsafe(32))
            for row in bundle['content']['PointRule']:
                models.PointRule.objects.create(**row,enabled_since=timezone.now())
    except Exception:
        for path in created: path.unlink(missing_ok=True)
        raise
    return {model:len(rows) for model,rows in bundle['content'].items()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    export=sub.add_parser('export')
    export.add_argument('--database',type=Path,required=True)
    export.add_argument('--video-root',type=Path,required=True)
    export.add_argument('--output',type=Path,required=True)
    load=sub.add_parser('import')
    load.add_argument('--bundle',type=Path,required=True)
    load.add_argument('--video-root',type=Path,required=True)
    args=parser.parse_args()
    if args.command == 'export':
        bundle=export_content(args.database,args.video_root)
        fd=os.open(args.output,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,'w') as file: json.dump(bundle,file,ensure_ascii=False,indent=2)
        print(json.dumps({model:len(rows) for model,rows in bundle['content'].items()}))
    else:
        print(json.dumps(import_content(json.loads(args.bundle.read_text()),args.video_root)))


if __name__ == '__main__': main()
