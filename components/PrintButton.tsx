"use client";

import { DownloadIcon } from "./DownloadIcon";

export function PrintButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <DownloadIcon />
      {label}
    </button>
  );
}
