import Link from 'next/link';
import LinkFeedback from './link-feedback';
import type {ComponentProps} from 'react';
import {clientNavigation} from '../lib/interaction-navigation.mjs';
/** Use for page links; native links retain file, auth and new-window behavior. */
export default function SiteLink({prefetch:ignored,...props}:ComponentProps<'a'>&{prefetch?:false}) {
  if(!clientNavigation(props))return <a {...props}/>;
  return <Link prefetch={false} {...props} href={props.href!}>{props.children}<LinkFeedback/></Link>;
}
