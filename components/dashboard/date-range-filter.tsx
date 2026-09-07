"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Check, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export type DateRangeValue = { from: Date | null; to: Date | null; label: string };

const presets = [
  { label: "Last 7 days", days: 7 },
  { label: "Last month", days: 30 },
] as const;

function toInputDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function DateRangeFilter({ value, onChange }: { value: DateRangeValue; onChange: (value: DateRangeValue) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toInputDate(value.from));
  const [to, setTo] = useState(toInputDate(value.to));

  useEffect(() => {
    setFrom(toInputDate(value.from));
    setTo(toInputDate(value.to));
  }, [value.from, value.to]);

  const applyCustom = () => {
    if (!from && !to) return;
    onChange({ from: from ? new Date(`${from}T00:00:00`) : null, to: to ? new Date(`${to}T23:59:59`) : null, label: "Custom range" });
    setOpen(false);
  };

  const reset = () => {
    setFrom("");
    setTo("");
    onChange({ from: null, to: null, label: "All time" });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-3 font-normal">
          <span className="flex items-center gap-2"><CalendarRange data-icon="inline-start" />{value.label}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex flex-col gap-1">
          {presets.map((preset) => {
            const selected = value.label === preset.label;
            return <Button key={preset.label} variant={selected ? "secondary" : "ghost"} className="justify-between" onClick={() => { const toDate = new Date(); const fromDate = new Date(); fromDate.setDate(toDate.getDate() - preset.days + 1); onChange({ from: fromDate, to: toDate, label: preset.label }); setOpen(false); }}>{preset.label}{selected && <Check data-icon="inline-end" />}</Button>;
          })}
        </div>
        <Separator className="my-3" />
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5"><Label htmlFor="range-from">From</Label><Input id="range-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="range-to">To</Label><Input id="range-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div>
          </div>
          <div className="flex items-center justify-between gap-2"><Button variant="ghost" size="sm" onClick={reset}><RotateCcw data-icon="inline-start" />Clear</Button><Button size="sm" onClick={applyCustom}>Apply</Button></div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
