import { Skeleton } from '@/components/ui/surfaces';

export default function CrmLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="در حال بارگذاری صفحه"
      className="space-y-6"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton className="h-32" key={item} />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
