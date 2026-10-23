type RoutePlaceholderProps = Readonly<{
  title: string;
  description: string;
}>;

export function RoutePlaceholder({ title, description }: RoutePlaceholderProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-20">
      <section className="w-full max-w-3xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <p className="mb-3 font-mono text-xs uppercase text-primary">
          Phase 2
        </p>
        <h1 className="text-3xl font-semibold text-card-foreground">{title}</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{description}</p>
      </section>
    </main>
  );
}
