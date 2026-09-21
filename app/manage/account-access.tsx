'use client';
import { AdminTabs } from './admin-ui';
import { useAdminTab } from './admin-navigation';
import {useState} from 'react';
import StaffAccounts from './staff-accounts';
import PermissionGroups from './permission-groups';
import StaffActivity from './staff-activity';
import './account-access.css';
export default function AccountAccess({initialTab='accounts'}:{initialTab?:string}){
  const [tab,setTab]=useAdminTab('accessTab',initialTab,['accounts','groups','logs']);
  const [actor,setActor]=useState('');
  const logs=(email:string)=>{setActor(email);setTab('logs');};
  return <section className="account-access"><h1>账号与权限</h1><AdminTabs label="账号与权限栏目" value={tab} items={[['accounts','子账号'],['groups','权限组'],['logs','操作日志']]} onChange={setTab}/>{tab==='accounts'?<StaffAccounts onLogs={logs}/>:tab==='groups'?<PermissionGroups integrated onAccountLogs={logs}/>:<StaffActivity key={actor} initialActor={actor}/>}</section>;
}
