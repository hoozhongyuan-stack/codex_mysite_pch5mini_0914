import { ORIGIN } from '@/lib/server';
import { publicRobots } from '@/lib/geo-health.mjs';
export function GET(){return new Response(publicRobots(ORIGIN),{headers:{'Content-Type':'text/plain; charset=utf-8'}});}
