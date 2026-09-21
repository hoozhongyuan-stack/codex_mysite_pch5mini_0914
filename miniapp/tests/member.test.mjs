import test from 'node:test';
import assert from 'node:assert/strict';
import {orderLabel,amountLabel,memberName,hasMiniWechatBinding} from '../src/lib/member.mjs';
test('member display uses readable statuses prices and no raw email headline',()=>{
 assert.equal(orderLabel('pending_ship'),'待发货');assert.equal(orderLabel('closed'),'已关闭');
 assert.equal(amountLabel(31700,'CNY'),'¥317.00');assert.equal(amountLabel(317,'PTS'),'317 积分');
 assert.equal(memberName({email:'private@example.test'}),'网站会员');
 assert.equal(memberName({nickname:'胡中圆',firstName:'网站会员'}),'胡中圆');
 assert.equal(hasMiniWechatBinding({providers:['email','wechat-mini']}),true);
 assert.equal(hasMiniWechatBinding({providers:['email']}),false);
});
