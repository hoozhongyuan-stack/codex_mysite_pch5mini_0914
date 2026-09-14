'use client';
import {useState} from 'react';
import StaffAccounts from './staff-accounts';
import PermissionGroups from './permission-groups';
import StaffActivity from './staff-activity';
import './account-access.css';
export default function AccountAccess({initialTab='accounts'}:{initialTab?:string}){
  const [tab,setTab]=useState(initialTab),[actor,setActor]=useState('');
  const logs=(email:string)=>{setActor(email);setTab('logs');};
  return <section className="account-access"><h1>账号与权限</h1><nav className="account-access-tabs" aria-label="账号与权限栏目">{[['accounts','子账号'],['groups','权限组'],['logs','操作日志']].map(([key,label])=><button key={key} className={'btn '+(tab===key?'primary':'')} aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}>{label}</button>)}</nav>{tab==='accounts'?<StaffAccounts onLogs={logs}/>:tab==='groups'?<PermissionGroups integrated onAccountLogs={logs}/>:<StaffActivity key={actor} initialActor={actor}/>}</section>;
}
