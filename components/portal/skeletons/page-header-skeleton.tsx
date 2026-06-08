export function PageHeaderSkeleton({
  actionWidth = "w-32",
  showAction = true,
}: {
  actionWidth?: string;
  showAction?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        <div className="h-7 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg mb-2" />
        <div className="h-4 w-64 max-w-full bg-gray-100 dark:bg-gray-800/60 rounded" />
      </div>
      {showAction ? (
        <div
          className={`h-10 ${actionWidth} bg-gray-200 dark:bg-gray-800 rounded-xl flex-shrink-0`}
        />
      ) : null}
    </div>
  );
}
