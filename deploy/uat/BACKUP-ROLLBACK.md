# UAT backup, isolated recovery and release rollback

These scripts are templates for the approved self-hosted UAT layout. They do not include a real host, domain, credentials or private key. Running them on a server changes state; review the paths and downtime before execution.

## Consistent private backup

```sh
sudo python3 /srv/aition/current/deploy/uat/backup-uat.py
```

Default destination: `/var/backups/aition`, root-owned mode 0700. Do not put snapshots in a public media directory or under a directory writable by the application user.

The script takes one exclusive maintenance lock, remembers which services were running, and stops web, identity, video, points, order expiry and (when installed) image-derivative services. It then captures both PostgreSQL databases using local `postgres` peer authentication, the persistent media/identity directories, the Mini Program release-key directory when present, and `/etc/aition`. The files and databases therefore cover the same application write freeze, provided no administrator/import job writes concurrently. Never run schema changes, imports or manual SQL writes during backup.

Completed snapshots are atomically renamed from `.incomplete-*` to a timestamped directory after dump/tar success and SHA256 manifest generation. Previously active services resume in a `finally` handler, including normal errors, SIGINT and SIGTERM. SIGKILL, host power loss and filesystem failure cannot run cleanup handlers: inspect and restart services manually after those events. Incomplete snapshots remain visible for diagnosis and must not be used as completed backups.

Snapshots include application secrets and private data. Restrict copies accordingly; encrypt any off-host storage. The script never prints credentials and never deletes historical backups. Disk capacity and backup retention need a separate reviewed policy.

The optional `aition-backup.service` and `.timer` run daily around 03:30 in server local time and briefly interrupt access. They are **not enabled automatically**. Ensure the release contains `deploy/uat` before installing these units. A scheduled backup success is not a recovery drill.

## Dry-run verification

```sh
sudo python3 /srv/aition/current/deploy/uat/restore-uat.py /var/backups/aition/TIMESTAMP
```

Default behavior only checks manifest entries, sizes, SHA256, safe archive member paths/types and PostgreSQL dump headers. It does not alter databases, files, service state or active symlinks. Checksums detect accidental changes; they do not authenticate a maliciously replaced manifest. Backups must come from a trusted private location.

## Isolated recovery drill

```sh
sudo python3 /srv/aition/current/deploy/uat/restore-uat.py /var/backups/aition/TIMESTAMP \
  --execute --target-root /srv/aition/restore-drill-YYYYMMDD \
  --cms-database aition_cms_restore_YYYYMMDD \
  --identity-database aition_identity_restore_YYYYMMDD
```

Both target databases and the target directory must be new. Existing targets, live database names and system databases are refused. Database roles referenced by the dump must already exist on the recovery host. PostgreSQL custom dumps retain owners and ACLs; `pg_restore` runs in one transaction per database. A failure retains isolated targets for diagnosis, with no destructive cleanup.

The script never swaps live environment files or starts services against the restored data. Afterward verify table counts, approved record samples, media references, file ownership and application behavior in an isolated runtime. Secrets restored under the target directory are a snapshot: do not overwrite live credentials blindly. Database-level CONNECT grants and exact runtime role policy must be reviewed for the new names before running the isolated application. Active cutover is a separate authorized operation.

## Application release rollback

```sh
sudo python3 /srv/aition/current/deploy/uat/rollback-uat.py PREVIOUS_RELEASE
sudo python3 /srv/aition/current/deploy/uat/rollback-uat.py PREVIOUS_RELEASE --execute
```

The first invocation is a dry run. Execution accepts only a complete existing release under `/srv/aition/releases`, stops writers, atomically switches `/srv/aition/current`, and restarts previously active services. If switching/restarting fails, it attempts to restore the previous link and service state.

**This never rolls back PostgreSQL data, media or identity files.** Verify schema compatibility and shared Python virtualenv compatibility before switching. A database-incompatible release requires a separately planned recovery, not this script. If the selected earlier release lacks the image derivative worker, rollback keeps that optional service stopped instead of attempting to start a missing script. `systemctl is-active` is only a process check; authenticated workflows, background processing and user-visible behavior must be checked afterward.

## Verification status

Scripts receive local Python syntax and argument-parser checks during development. They are not evidence of a real backup, restore, service-stop/resume or release rollback drill. Record a server-side recovery drill separately before calling UAT recovery accepted.
