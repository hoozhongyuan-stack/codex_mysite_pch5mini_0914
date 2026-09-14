import {redirect,notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:any){const {lang,orderPath=[]}=await params;if(!['zh','en'].includes(lang)||orderPath.length>1)notFound();redirect(`/${lang}/account?`+new URLSearchParams({section:'orders',...(orderPath[0]?{order:orderPath[0]}:{})}));}
