// components/ResearchForm.tsx
"use client";

import { ChevronRight, Loader2 } from "lucide-react";

interface ResearchFormProps {
  onSubmit: (query: string) => void;
  isRunning: boolean;
}

export function ResearchForm({ onSubmit, isRunning }: ResearchFormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const query = (fd.get("query") as string).trim();
    if (query) onSubmit(query);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-4xl mx-auto">
      <input
        name="query"
        type="text"
        placeholder="Enter a research query, e.g. 'Compare top vector databases for production RAG systems'"
        disabled={isRunning}
        className="flex-1 bg-surface border border-divider rounded-md h-11 px-4 font-mono text-sm text-content placeholder:text-content-muted focus:outline-none focus:border-accent-primary transition-colors duration-250 ease-snappy disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isRunning}
        className="group flex items-center gap-2 bg-content text-canvas rounded-md h-11 px-6 font-medium text-sm hover:bg-white transition-all duration-250 ease-snappy disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? (
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <>
            Run Comparison
            <ChevronRight
              size={16}
              strokeWidth={1.5}
              className="transition-transform duration-250 ease-snappy group-hover:translate-x-px"
            />
          </>
        )}
      </button>
    </form>
  );
}
