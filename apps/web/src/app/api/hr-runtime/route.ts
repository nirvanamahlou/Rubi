export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(
    {
      module: 'hr',
      version: process.env.NORA_HR_BUILD_ID ?? 'unmanaged',
      commit: process.env.NORA_HR_COMMIT ?? 'unmanaged',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
