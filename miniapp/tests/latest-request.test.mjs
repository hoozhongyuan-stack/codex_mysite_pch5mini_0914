import test from 'node:test';
import assert from 'node:assert/strict';
import {latestRequest} from '../src/lib/latest-request.mjs';
test('a slow previous request cannot replace a newer result or clear its loading state',()=>{
 const request=latestRequest();const first=request.begin();const second=request.begin();
 assert.equal(request.isCurrent(first),false);assert.equal(request.isCurrent(second),true);
});
test('unloaded page ignores pending completions',()=>{
 const request=latestRequest();const id=request.begin();request.cancel();
 assert.equal(request.isCurrent(id),false);
});
