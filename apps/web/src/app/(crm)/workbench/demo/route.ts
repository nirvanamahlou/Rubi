import { redirect } from 'next/navigation';

/** Compatibility for old bookmarks; the standalone demo is retired. */
export function GET() {
  redirect('/workbench');
}
