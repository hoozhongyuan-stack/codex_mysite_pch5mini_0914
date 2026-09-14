import test from 'node:test';
import assert from 'node:assert/strict';
import {clientNavigation} from '../lib/interaction-navigation.mjs';
test('ordinary workspace and public routes use client navigation',()=>{
 for(const href of ['/admin?view=orders','/zh/videos/demo','/en/account?section=points','/zh/orders/one'])assert.equal(clientNavigation({href}),true);
});
test('external, authentication, download and fragment navigation keep browser semantics',()=>{
 for(const href of ['https://example.com','//example.com','mailto:a@example.com','#registration','/zh/events/a#registration','/api/export','/admin/login','/zh/account?mode=reset','/zh/account?returnTo=%2Fzh%2Fcart'])assert.equal(clientNavigation({href}),false,href);
 assert.equal(clientNavigation({href:'/zh/articles/a',target:'_blank'}),false);
 assert.equal(clientNavigation({href:'/zh/articles/a',download:''}),false);
});
