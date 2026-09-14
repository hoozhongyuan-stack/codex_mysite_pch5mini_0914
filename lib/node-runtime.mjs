import pg from 'pg';
import {uatRuntimeConfig} from './uat-runtime-config.mjs';
import {createPostgresDatabase} from './postgres.mjs';
import {createFilesystemBucket} from './filesystem-storage.mjs';
let bindings;
function initialize(){
  if(bindings)return bindings;
  const config=uatRuntimeConfig(process.env);
  const pool=new pg.Pool({connectionString:config.CMS_DATABASE_URL,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000,statement_timeout:30000});
  pool.on('error',()=>console.error('PostgreSQL idle connection failed'));
  bindings=Object.freeze({DB:createPostgresDatabase(pool),FILES:createFilesystemBucket(config.FILES_DIR),IDENTITY_URL:config.IDENTITY_URL,IDENTITY_KEY:config.IDENTITY_KEY});
  return bindings;
}
// Server-only build alias: no application settings or private values enter client bundles.
export const env=new Proxy({}, {get:(_,key)=>initialize()[key]});
