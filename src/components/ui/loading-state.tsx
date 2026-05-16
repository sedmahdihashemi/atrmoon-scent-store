export function LoadingState({ label = "در حال آماده‌سازی…" }: { label?: string }) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border border-ink/10" />
        <div className="absolute inset-0 rounded-full border-t border-[var(--gold)] animate-spin" style={{ animationDuration: "2.4s" }} />
        <div className="absolute inset-3 rounded-full bg-[var(--gold)]/10" />
      </div>
      <p className="text-sm font-serif italic">{label}</p>
    </div>
  );
}

export function EmptyState({ title, message, icon }: { title: string; message?: string; icon?: React.ReactNode }) {
  return (
    <div className="paper-card rounded-md p-12 text-center">
      {icon && <div className="flex justify-center mb-4 text-[var(--gold)]">{icon}</div>}
      <h3 className="font-serif text-xl text-ink mb-2">{title}</h3>
      {message && <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">{message}</p>}
    </div>
  );
}