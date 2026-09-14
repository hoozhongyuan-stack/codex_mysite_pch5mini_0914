import { ingestBehavior } from '@/lib/behavior-store';
export const POST = (request: Request) => ingestBehavior(request, 'website');
