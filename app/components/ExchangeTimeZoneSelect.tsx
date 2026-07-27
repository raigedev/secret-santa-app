"use client";

import { type CSSProperties, useEffect, useState } from "react";
import {
  formatExchangeTimeZoneLabel,
  getSupportedExchangeTimeZones,
  resolveExchangeTimeZone,
} from "@/lib/exchange-date.mjs";

type ExchangeTimeZoneSelectProps = {
  className?: string;
  id: string;
  onChange: (timeZone: string) => void;
  style?: CSSProperties;
  value: string;
};

export function ExchangeTimeZoneSelect({
  className,
  id,
  onChange,
  style,
  value,
}: ExchangeTimeZoneSelectProps) {
  const resolvedValue = resolveExchangeTimeZone(value);
  const [timeZones, setTimeZones] = useState([resolvedValue]);

  useEffect(() => {
    setTimeZones(getSupportedExchangeTimeZones(resolvedValue));
  }, [resolvedValue]);

  return (
    <select
      id={id}
      value={resolvedValue}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      style={style}
    >
      {timeZones.map((timeZone) => (
        <option key={timeZone} value={timeZone}>
          {formatExchangeTimeZoneLabel(timeZone)}
        </option>
      ))}
    </select>
  );
}
