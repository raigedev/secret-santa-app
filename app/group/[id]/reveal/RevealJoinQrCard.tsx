"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

type RevealJoinQrCardProps = {
  revealUrl: string;
};

type QrCell = {
  col: number;
  row: number;
};

function buildQrCells(value: string): { cells: QrCell[]; moduleCount: number } {
  const qr = qrcode(0, "M");
  qr.addData(value, "Byte");
  qr.make();

  const moduleCount = qr.getModuleCount();
  const cells: QrCell[] = [];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (qr.isDark(row, col)) {
        cells.push({ col, row });
      }
    }
  }

  return { cells, moduleCount };
}

function compactRevealUrl(value: string): string {
  try {
    const parsedUrl = new URL(value);
    const host = parsedUrl.host.replace(/^www\./i, "");
    const path = parsedUrl.pathname.replace(/\/$/, "");
    const parts = path.split("/").filter(Boolean);
    const revealIndex = parts.lastIndexOf("reveal");
    const groupIndex = parts.lastIndexOf("group");

    if (groupIndex >= 0 && revealIndex > groupIndex) {
      return `${host}/group/.../reveal`;
    }

    return `${host}${path}`;
  } catch {
    return value;
  }
}

export default function RevealJoinQrCard({ revealUrl }: RevealJoinQrCardProps) {
  const qrModel = useMemo(() => buildQrCells(revealUrl), [revealUrl]);
  const compactUrl = useMemo(() => compactRevealUrl(revealUrl), [revealUrl]);
  const quietZone = 4;
  const viewBoxSize = qrModel.moduleCount + quietZone * 2;

  return (
    <aside
      className="rounded-[30px] p-5 text-left shadow-[0_24px_70px_rgba(0,0,0,.24)] xl:sticky xl:top-6"
      style={{
        background: "#fffaf2",
        color: "#2e3432",
      }}
      aria-label="Join reveal on phone"
    >
      <div className="text-[26px] font-bold leading-none" style={{ color: "#48664e" }}>
        Join on phone
      </div>
      <p className="mt-2 text-[13px] font-extrabold leading-5" style={{ color: "#64748b" }}>
        Scan with a phone camera. No mobile app needed.
      </p>

      <div
        className="mx-auto mt-5 grid aspect-square w-full max-w-55 place-items-center rounded-[28px] bg-white p-4"
        style={{
          boxShadow: "inset 0 0 0 1px rgba(72,102,78,.12)",
        }}
      >
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          role="img"
          aria-label="QR code for this reveal screen"
          className="h-full w-full"
          shapeRendering="crispEdges"
        >
          <rect width={viewBoxSize} height={viewBoxSize} rx="1.5" fill="#fff7ed" />
          {qrModel.cells.map((cell) => (
            <rect
              key={`${cell.row}-${cell.col}`}
              x={cell.col + quietZone}
              y={cell.row + quietZone}
              width="1"
              height="1"
              fill="#0f172a"
            />
          ))}
        </svg>
      </div>

      <div
        className="mt-4 rounded-2xl px-3 py-3 text-center text-[11px] font-black leading-4"
        style={{
          background: "#eef6ee",
          color: "#48664e",
          wordBreak: "break-word",
        }}
      >
        {compactUrl}
      </div>

      <p className="mt-4 text-[12px] font-extrabold leading-5" style={{ color: "#64748b" }}>
        The code only opens this reveal page. Names and matches still stay behind login and group access.
      </p>

      <div
        className="mt-4 grid gap-2 rounded-2xl p-3 text-[11px] font-black"
        style={{
          background: "rgba(72,102,78,.08)",
          color: "#48664e",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span>Login required</span>
          <span>Yes</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Member check</span>
          <span>Yes</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Private data in QR</span>
          <span>No</span>
        </div>
      </div>
    </aside>
  );
}
