export default function TestingLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800/60 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 bg-gray-100 dark:bg-gray-800/40 rounded-2xl"
          />
        ))}
      </div>
    </div>
  );
}
