// Local worker; production should inject IDENTITY_KEY and ORDER_ORIGIN via its supervisor.
import {readFile} from 'node:fs/promises';
const origin=process.env.ORDER_ORIGIN||'http://localhost:3001';
const config=process.env.IDENTITY_KEY?'':await readFile(new URL('../.dev.vars',import.meta.url),'utf8');
const key=process.env.IDENTITY_KEY||config.match(/^IDENTITY_KEY\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m)?.[1];
if(!key)throw Error('Identity service key is not configured');
if(!/^https?:\/\//.test(origin))throw Error('Invalid order origin');
const once=process.argv.includes('--once');
do{
 try{const response=await fetch(origin+'/api/orders/expire',{method:'POST',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);if(once)console.log('Order expiry pass completed')}
 catch(e){console.error('Order expiry pass failed:',e instanceof Error?e.message:'unknown');if(once)process.exitCode=1}
 if(!once)await new Promise(resolve=>setTimeout(resolve,60000));
}while(!once);
