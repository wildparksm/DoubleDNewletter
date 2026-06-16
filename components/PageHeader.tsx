import React from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <section className="rounded-2xl bg-white/80 dark:bg-gray-900/70 backdrop-blur-md border border-gray-200/70 dark:border-gray-800 shadow-sm px-6 lg:px-8 py-5 lg:py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0d1b8e] dark:text-blue-400 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl lg:text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-2">{subtitle}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>
      )}
    </section>
  );
}

export function HeaderStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 text-xs">
      <span className="font-bold tabular-nums text-[#0d1b8e] dark:text-blue-400">{value}</span>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
    </span>
  );
}
