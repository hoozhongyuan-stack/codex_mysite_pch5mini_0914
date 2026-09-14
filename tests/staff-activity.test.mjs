import test from 'node:test';
import assert from 'node:assert/strict';
import {activityModule,activityQuery} from '../lib/staff-activity.mjs';
import {workspaceView} from '../lib/workspace-route.mjs';
test('account workspace preserves historical entry routes and filters are bounded',()=>{
  for(const operation of ['enable-user','disable-user','save-user-profile','user-profile','visitor-update'])assert.equal(activityModule(operation),'users');
  for(const key of ['accounts','admins','permissions','logs']) assert.equal(workspaceView(key),key);
  assert.equal(activityModule('member-assign'),'permissions');
  assert.equal(activityModule('account-save'),'accounts');
  assert.equal(activityModule('order-approve'),'orders');
  assert.equal(activityModule('saveContent'),'content');
  assert.equal(activityQuery({actor:'  editor@example.test '}).actor,'editor@example.test');
  assert.throws(()=>activityQuery({page:151}));
  assert.throws(()=>activityQuery({module:'credentials'}));
  assert.throws(()=>activityQuery({from:'2026-09-15',to:'2026-09-14'}));
  assert.throws(()=>activityQuery({from:'2026-02-31'}));
});

test('malformed and impossible audit dates return the validation message',()=>{
  for(const date of ['2026-99-99','2026-00-10','2026-02-31','not-a-date']) {
    for(const key of ['from','to']) assert.throws(()=>activityQuery({[key]:date}), {message:'日志日期无效'});
  }
  assert.equal(activityQuery({from:'2024-02-29'}).from,'2024-02-29');
});
