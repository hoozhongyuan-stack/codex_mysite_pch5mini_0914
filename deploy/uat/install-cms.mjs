import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {postgresCompatibilitySql} from '../../lib/postgres-compat.mjs';
const client=new pg.Client({connectionString:process.env.CMS_MIGRATION_URL});
await client.connect();
try{
 await client.query('BEGIN');
 await client.query('CREATE TABLE IF NOT EXISTS uat_schema_versions(version text primary key,applied_at timestamptz not null default now())');
 const version='001-pg-uat';
 if(!(await client.query('SELECT 1 FROM uat_schema_versions WHERE version=$1',[version])).rowCount){
  await client.query(postgresCompatibilitySql);
  await client.query(await readFile(new URL('../../postgres/001-cms-schema.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../../postgres/002-cms-guards.sql',import.meta.url),'utf8'));
  await client.query('INSERT INTO uat_schema_versions(version) VALUES($1)',[version]);
 }
 if(!(await client.query('SELECT 1 FROM uat_schema_versions WHERE version=$1',['003-behavior'])).rowCount){
  await client.query(await readFile(new URL('../../postgres/003-behavior-events.sql',import.meta.url),'utf8'));
  await client.query('INSERT INTO uat_schema_versions(version) VALUES($1)',['003-behavior']);
 }
 if(!(await client.query('SELECT 1 FROM uat_schema_versions WHERE version=$1',['004-image-variants'])).rowCount){
  await client.query(await readFile(new URL('../../postgres/004-image-variants.sql',import.meta.url),'utf8'));
  await client.query('INSERT INTO uat_schema_versions(version) VALUES($1)',['004-image-variants']);
 }
 if(!(await client.query('SELECT 1 FROM uat_schema_versions WHERE version=$1',['005-share-attribution'])).rowCount){
  await client.query(await readFile(new URL('../../postgres/005-share-attribution.sql',import.meta.url),'utf8'));
  await client.query('INSERT INTO uat_schema_versions(version) VALUES($1)',['005-share-attribution']);
 }
 await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO aition_cms; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO aition_cms; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO aition_cms; REVOKE ALL ON uat_schema_versions FROM aition_cms; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO aition_cms; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO aition_cms;');
 await client.query('COMMIT');console.log('CMS schema revision ready');
}catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
