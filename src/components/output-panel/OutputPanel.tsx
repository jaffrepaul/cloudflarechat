export function OutputPanel() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 border-l border-neutral-300 dark:border-neutral-800">
      <div className="text-center space-y-4 p-8">
        <div className="text-6xl animate-pulse">👨‍🍳</div>
        <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Your creation is cooking
        </h2>
        <p className="text-muted-foreground">
          The output will appear here
        </p>
      </div>
    </div>
  );
}
