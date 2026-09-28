import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

export function ScheduleTimeField({ field, label, format, canonicalTime, draft, error, errorId, open, onOpenChange, onDraftChange, onCommit, onNormalize, parseTime, formatTime, getParts, toCanonical }) {
  const seedTime = parseTime(draft, format) || canonicalTime;
  const [parts, setParts] = useState(() => getParts(seedTime, format));
  const hours = Array.from({ length: format === "12h" ? 12 : 24 }, (_, index) => String(format === "12h" ? index + 1 : index).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

  useEffect(() => {
    if (!open) return;
    const current = parseTime(draft, format) || canonicalTime;
    setParts(getParts(current, format));
    requestAnimationFrame(() => document.getElementById(`time-picker-${field}-minute-${getParts(current, format).minute}`)?.scrollIntoView({ block: "nearest" }));
  }, [open]);

  function handleOpenChange(nextOpen) {
    if (nextOpen) {
      const current = parseTime(draft, format) || canonicalTime;
      setParts(getParts(current, format));
    }
    onOpenChange(nextOpen);
  }

  function setPart(key, value) { setParts((current) => ({ ...current, [key]: value })); }

  function commitSelection() {
    onCommit(toCanonical(parts, format));
    onOpenChange(false);
  }

  function optionColumn(name, values, selected, key) {
    const listId = `time-picker-${field}-${key}`;
    function handleKeyDown(event, index) {
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = (index + 1) % values.length;
      else if (event.key === "ArrowUp") nextIndex = (index - 1 + values.length) % values.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = values.length - 1;
      else return;
      event.preventDefault();
      setPart(key, values[nextIndex]);
      requestAnimationFrame(() => document.getElementById(`${listId}-${values[nextIndex]}`)?.focus());
    }
    return <div className="schedule-time-column" role="listbox" aria-label={name} key={key}>{values.map((value, index) => <button id={`${listId}-${value}`} type="button" role="option" aria-selected={selected === value} tabIndex={selected === value ? 0 : -1} className={`schedule-time-option${selected === value ? " selected" : ""}`} key={value} onClick={() => setPart(key, value)} onKeyDown={(event) => handleKeyDown(event, index)}>{value}</button>)}</div>;
  }

  const inputId = `schedule-${field}-time-input`;
  return <div className="schedule-time-field"><label htmlFor={inputId}>{label}</label><PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange} modal={false}>
    <div className={`schedule-time-entry${error ? " has-error" : ""}`}>
      <input id={inputId} type="text" inputMode="text" autoComplete="off" spellCheck="false" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} placeholder={format === "12h" ? "08:30 AM" : "HH:mm"} value={draft} onChange={(event) => onDraftChange(event.target.value)} onBlur={() => { const canonical = parseTime(draft, format); if (canonical) onNormalize(canonical); }} />
      <PopoverPrimitive.Trigger type="button" className="schedule-time-picker-trigger" aria-label={`Choose ${label.toLowerCase()} time`} aria-haspopup="dialog"><Clock3 size={16} /></PopoverPrimitive.Trigger>
    </div>
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner className="schedule-time-positioner" side="bottom" align="end" sideOffset={6} collisionPadding={12} sticky>
        <PopoverPrimitive.Popup className="schedule-time-popover" aria-label={`${label} time picker`}>
          <div className="schedule-time-popover-heading"><strong>{label} time</strong><span aria-live="polite">{formatTime(toCanonical(parts, format), format)}</span></div>
          <div className={`schedule-time-columns${format === "24h" ? " is-24-hour" : ""}`}>
            {optionColumn("Hour", hours, parts.hour, "hour")}
            {optionColumn("Minute", minutes, parts.minute, "minute")}
            {format === "12h" && optionColumn("AM or PM", ["AM", "PM"], parts.period, "period")}
          </div>
          <div className="schedule-time-popover-footer"><button type="button" className="button primary small" onClick={commitSelection}>Use this time</button></div>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  </PopoverPrimitive.Root>{error && <small className="schedule-time-error" id={errorId} role="alert">{error}</small>}</div>;
}
