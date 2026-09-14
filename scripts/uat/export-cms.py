"""Export approved CMS content only from local SQLite snapshots; never export whole databases."""
import argparse,sqlite3,json,os,hashlib,shutil
from pathlib import Path
TABLES=('contents','categories','assets','asset_folders','asset_folders_map','content_assets','navigation_items','policies','marketing_assets')
def export(source,r2,blobs,destination):
    out=Path(destination)
    if out.exists():raise ValueError('Destination already exists; preserve previous export')
    out.mkdir(parents=True,mode=0o700);os.chmod(out,0o700)
    db=sqlite3.connect(Path(source).resolve().as_uri()+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
    db.execute('BEGIN')
    tables={t:[dict(r) for r in db.execute('SELECT * FROM '+t)] for t in TABLES}
    settings=[]
    for r in db.execute('SELECT id,data FROM settings WHERE id IN (?,?,?)',('site','commerce','channels')):
        d=json.loads(r['data'])
        if r['id']=='commerce':
            d={k:v for k,v in d.items() if k in ('enabled','miniPayments','timeoutHours','afterSaleDays','shipping','methods')}
        settings.append({'id':r['id'],'data':json.dumps(d,ensure_ascii=False)})
    tables['settings']=settings;db.rollback();db.close()
    media=sqlite3.connect(Path(r2).resolve().as_uri()+'?mode=ro',uri=True);media.row_factory=sqlite3.Row
    media.execute('BEGIN');manifest=[];(out/'assets').mkdir(mode=0o700)
    for asset in tables['assets']:
        row=media.execute('SELECT * FROM _mf_objects WHERE key=?',(asset['id'],)).fetchone()
        if row is None:raise ValueError('Referenced asset has no local object: '+asset['id'])
        blob_root=Path(blobs).resolve();blob=(blob_root/row['blob_id']).resolve()
        if not blob.is_relative_to(blob_root):raise ValueError('Asset payload path escapes blob directory')
        if not blob.is_file():raise ValueError('Asset payload missing')
        filename=hashlib.sha256(asset['id'].encode()).hexdigest();target=out/'assets'/filename
        shutil.copyfile(blob,target);os.chmod(target,0o600)
        digest=hashlib.sha256(target.read_bytes()).hexdigest()
        if target.stat().st_size!=row['size'] or row['size']!=asset['size']:raise ValueError('Asset size mismatch')
        manifest.append({'key':asset['id'],'file':'assets/'+filename,'sha256':digest,'size':row['size'],'httpMetadata':json.loads(row['http_metadata'])})
    media.rollback();media.close()
    payload={'format':1,'tables':tables,'assets':manifest}
    (out/'cms.json').write_text(json.dumps(payload,ensure_ascii=False));os.chmod(out/'cms.json',0o600)
    print(json.dumps({'tables':{k:len(v) for k,v in tables.items()},'assets':len(manifest),'bytes':sum(x['size'] for x in manifest)}))
if __name__=='__main__':
    os.umask(0o077)
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--r2',required=True);p.add_argument('--blobs',required=True);p.add_argument('--output',required=True)
    a=p.parse_args();export(a.source,a.r2,a.blobs,a.output)
