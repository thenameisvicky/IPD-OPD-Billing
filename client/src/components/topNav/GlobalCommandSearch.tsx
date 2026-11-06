import { useMemo, useState } from "react";
import { routeLabels } from "../../modules/registry";

type Props = {
  onNavigate: (page: string) => void;
};

export function GlobalCommandSearch({ onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routeLabels;
    return routeLabels.filter((label) => label.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search modules…"
        className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-[15px] font-semibold outline-none focus:border-emerald-600 focus:bg-white"
      />
      {open && results.length > 0 && (
        <div className="absolute z-40 mt-1 w-full border border-slate-300 bg-white shadow-lg">
          {results.map((label) => (
            <button
              key={label}
              type="button"
              className="block w-full px-3 py-2 text-left text-[15px] font-semibold hover:bg-emerald-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onNavigate(label);
                setQuery("");
                setOpen(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
