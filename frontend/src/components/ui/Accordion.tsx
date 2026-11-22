import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** FAQ-style accordion on native <details>: keyboard and screen readers work out of the box. */
export function Accordion({
  items,
}: {
  items: ReadonlyArray<{ id: string; title: ReactNode; content: ReactNode }>;
}) {
  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {items.map((item) => (
        <details key={item.id} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 font-semibold text-heading [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 text-muted transition-transform duration-200 ease-out group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5 text-body">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
