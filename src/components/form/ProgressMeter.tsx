interface Props {
  completed: number;
  total: number;
  submitting: boolean;
}

export function ProgressMeter({ completed, total, submitting }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const remaining = total - completed;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-4 lg:mx-0 lg:rounded-xl lg:border lg:bg-paper-raised/95 lg:px-5 lg:py-4 lg:shadow-lg">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            {completed} of {total} required fields complete
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label="Required fields complete"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] shrink-0 rounded-lg bg-accent px-5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Submit'}
        </button>
      </div>
      {/* Reserved so the bar does not resize as the last field is filled in. */}
      <p className="mt-2 min-h-4 text-xs leading-4 text-muted">
        {remaining > 0 ? `${remaining} still to go. You can submit once they are all filled in.` : null}
      </p>
    </div>
  );
}
