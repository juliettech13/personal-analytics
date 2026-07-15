"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;
}

export function SortableTable<T>({
  columns,
  rows,
  defaultSortKey,
  defaultAsc = false,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  defaultSortKey?: string;
  defaultAsc?: boolean;
  rowKey: (row: T) => string;
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [asc, setAsc] = useState(defaultAsc);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const withValues = rows.map((row) => ({ row, value: col.sortValue!(row) }));
    withValues.sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
    const ordered = asc ? withValues : withValues.reverse();
    return ordered.map((w) => w.row);
  }, [rows, sortKey, asc, columns]);

  function handleSort(col: Column<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) setAsc(!asc);
    else {
      setSortKey(col.key);
      setAsc(false);
    }
  }

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={() => handleSort(col)}
              className={cn(
                "bg-chrome-dark px-1.5 py-1 text-[10px] tracking-wide text-[#F0E8D8] uppercase select-none",
                col.align === "right" ? "text-right" : "text-left",
                col.sortValue && "cursor-pointer hover:bg-[#444]",
                sortKey === col.key && "text-retro-gold",
              )}
            >
              {col.label}
              {sortKey === col.key && (asc ? " ▲" : " ▼")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={rowKey(row)} className="even:[&>td]:bg-[#EDE7DC] hover:[&>td]:bg-[#D8EEF8]">
            {columns.map((col) => (
              <td
                key={col.key}
                className={cn(
                  "border-b border-[#E8E0D0] px-1.5 py-1 align-middle whitespace-nowrap",
                  col.align === "right" && "text-right",
                )}
              >
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
