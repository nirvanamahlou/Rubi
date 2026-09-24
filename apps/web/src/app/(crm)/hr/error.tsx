'use client';
import { HrState } from '@/modules/hr/hr-workspace';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div dir="rtl">
      <HrState state="error" />
      <button
        className="mt-4 rounded-xl bg-blue-700 px-5 py-3 text-white"
        onClick={reset}
      >
        تلاش دوباره
      </button>
    </div>
  );
}
