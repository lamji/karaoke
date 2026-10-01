"use client";

import { QRCodeSVG } from "qrcode.react";

/** QR code for the guest join link. Rendered on white so phones scan it easily. */
export function QrCode({ url, size = 160 }: { url: string; size?: number }) {
  return (
    <div className="rounded-xl bg-white p-2.5">
      <QRCodeSVG value={url} size={size} marginSize={0} level="M" />
    </div>
  );
}
