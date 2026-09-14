'use client';
import {useLinkStatus} from 'next/link';
/** A non-layout-shifting indicator for the enclosing router link. */
export default function LinkFeedback(){
  const {pending}=useLinkStatus();
  return pending?<span className="interaction-link-pending" role="status" aria-label="Loading / 正在打开页面"/>:null;
}
