import {redirect} from 'next/navigation';
export default async function Home({searchParams}:any){const q=await searchParams;redirect(q.view?'/admin?view='+encodeURIComponent(q.view):'/zh')}
