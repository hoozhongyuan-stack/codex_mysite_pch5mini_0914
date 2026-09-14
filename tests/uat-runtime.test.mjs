import test from 'node:test';
import assert from 'node:assert/strict';
import {uatRuntimeConfig} from '../lib/uat-runtime-config.mjs';
const base={CMS_DATABASE_URL:'postgresql://cms:password@127.0.0.1/cms_uat',FILES_DIR:'/srv/site/files',IDENTITY_URL:'http://127.0.0.1:3002/internal',IDENTITY_KEY:'x'.repeat(48),PUBLIC_ORIGIN:'https://example.test'};
test('UAT config validates all required services and returns only allowed fields',()=>{const result=uatRuntimeConfig({...base,UNRELATED_SECRET:'never-export'});assert.equal(result.PUBLIC_ORIGIN,'https://example.test');assert.equal(result.UNRELATED_SECRET,undefined);});
test('UAT config rejects missing or insecure configuration without echoing secrets',()=>{for(const update of [{CMS_DATABASE_URL:''},{CMS_DATABASE_URL:'sqlite:///tmp/foo'},{FILES_DIR:'relative'},{IDENTITY_KEY:'short'},{PUBLIC_ORIGIN:'http://example.test'},{IDENTITY_URL:'http://untrusted.test/internal'}])assert.throws(()=>uatRuntimeConfig({...base,...update}));});
