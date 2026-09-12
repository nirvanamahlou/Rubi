import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  workbenchDemoEnabled,
  workbenchDemoResponse,
} from '@/modules/workbench/demo/demo-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Existing auth proxy applies. This endpoint only serves an opt-in demo. */
export async function GET() {
  if (!workbenchDemoEnabled(process.env.RUBI_WORKBENCH_DEMO)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const html = await readFile(
    path.join(process.cwd(), 'src/modules/workbench/demo/workbench-demo.html'),
    'utf8',
  );
  return workbenchDemoResponse(html);
}
