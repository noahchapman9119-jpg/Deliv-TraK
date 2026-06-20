import { type TrackInfo, TrackEventStatusCode } from "@delivery-tracker/core";

const CARRIER_NAMES: Record<string, string> = {
  "us.fedex": "FedEx",
  "us.ups": "UPS",
  "us.usps": "USPS",
  "de.dhl": "DHL",
  "nl.tnt": "TNT",
  "un.upu.ems": "EMS",
  "cn.cainiao.global": "Cainiao Global",
  "jp.yamato": "Yamato",
  "jp.sagawa": "Sagawa",
  "kr.cjlogistics": "CJ Logistics",
  "kr.lotte": "Lotte",
  "kr.logen": "Logen",
  "kr.hanjin": "Hanjin",
  "kr.epost": "Korea Post",
  "kr.epost.ems": "Korea Post EMS",
};

interface StatusDisplay {
  label: string;
  cssClass: string;
  dotColor: string;
}

function getStatusDisplay(code: TrackEventStatusCode): StatusDisplay {
  switch (code) {
    case TrackEventStatusCode.Delivered:
      return { label: "Delivered", cssClass: "status-delivered", dotColor: "#22c55e" };
    case TrackEventStatusCode.OutForDelivery:
      return { label: "Out for Delivery", cssClass: "status-out", dotColor: "#f59e0b" };
    case TrackEventStatusCode.InTransit:
      return { label: "In Transit", cssClass: "status-transit", dotColor: "#3b82f6" };
    case TrackEventStatusCode.AtPickup:
      return { label: "Picked Up", cssClass: "status-pickup", dotColor: "#8b5cf6" };
    case TrackEventStatusCode.AvailableForPickup:
      return { label: "Available for Pickup", cssClass: "status-available", dotColor: "#06b6d4" };
    case TrackEventStatusCode.AttemptFail:
      return { label: "Delivery Attempted", cssClass: "status-attempt", dotColor: "#f97316" };
    case TrackEventStatusCode.Exception:
      return { label: "Exception", cssClass: "status-exception", dotColor: "#ef4444" };
    case TrackEventStatusCode.InformationReceived:
      return { label: "Information Received", cssClass: "status-info", dotColor: "#6b7280" };
    default:
      return { label: "Unknown", cssClass: "status-unknown", dotColor: "#9ca3af" };
  }
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderTrackingPage(
  proxyId: string,
  carrierId: string,
  trackInfo: TrackInfo,
  baseUrl: string
): string {
  const carrierName = CARRIER_NAMES[carrierId] ?? carrierId;
  const lastEvent = trackInfo.events.length > 0
    ? trackInfo.events[trackInfo.events.length - 1]
    : null;

  const currentStatus = lastEvent
    ? getStatusDisplay(lastEvent.status.code)
    : { label: "No updates yet", cssClass: "status-unknown", dotColor: "#9ca3af" };

  const eventsHtml = trackInfo.events.length === 0
    ? `<div class="empty">No tracking events yet. Check back soon.</div>`
    : [...trackInfo.events].reverse().map((event, index) => {
        const status = getStatusDisplay(event.status.code);
        const timeStr = event.time ? event.time.toFormat("LLL d, yyyy h:mm a") : "";
        const description = escapeHtml(event.description ?? event.status.name ?? status.label);
        const location = event.location?.name ? escapeHtml(event.location.name) : "";

        return `
        <div class="event${index === 0 ? " event-latest" : ""}">
          <div class="event-dot-wrap">
            <div class="event-dot" style="background:${status.dotColor}"></div>
            ${index < trackInfo.events.length - 1 ? '<div class="event-line-v"></div>' : ""}
          </div>
          <div class="event-body">
            <div class="event-description">${description}</div>
            ${location ? `<div class="event-location">${location}</div>` : ""}
            ${timeStr ? `<div class="event-time">${timeStr}</div>` : ""}
          </div>
        </div>`;
      }).join("");

  const shareUrl = `${baseUrl}/track/${proxyId}`;
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Package ${escapeHtml(proxyId)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;color:#1e293b;min-height:100vh}
    .page{max-width:560px;margin:0 auto;padding:1.5rem 1rem 3rem}
    .header{margin-bottom:1.25rem}
    .brand{font-size:.75rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin-bottom:1.25rem}
    .card{background:#fff;border-radius:14px;padding:1.5rem;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:1rem}
    .ref-label{font-size:.75rem;color:#94a3b8;margin-bottom:.35rem}
    .ref-id{font-size:1.25rem;font-weight:700;letter-spacing:.04em;color:#0f172a;margin-bottom:1rem}
    .badge{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .85rem;border-radius:999px;font-size:.8rem;font-weight:600}
    .status-delivered{background:#dcfce7;color:#166534}
    .status-transit{background:#dbeafe;color:#1d4ed8}
    .status-out{background:#fef3c7;color:#92400e}
    .status-exception{background:#fee2e2;color:#991b1b}
    .status-attempt{background:#ffedd5;color:#9a3412}
    .status-pickup{background:#ede9fe;color:#5b21b6}
    .status-available{background:#cffafe;color:#155e75}
    .status-info,.status-unknown{background:#f1f5f9;color:#475569}
    .carrier-line{margin-top:.85rem;font-size:.8rem;color:#64748b}
    .share-box{margin-top:1rem;padding:.75rem 1rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
    .share-label{font-size:.7rem;color:#94a3b8;margin-bottom:.3rem}
    .share-url{font-size:.78rem;color:#3b82f6;word-break:break-all;font-family:monospace}
    .copy-btn{margin-top:.5rem;padding:.3rem .7rem;font-size:.72rem;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer}
    .copy-btn:hover{background:#2563eb}
    .section-title{font-size:.72rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;margin-bottom:1rem}
    .event{display:flex;gap:.85rem;padding-bottom:1.25rem}
    .event:last-child{padding-bottom:0}
    .event-latest .event-description{color:#0f172a;font-weight:600}
    .event-dot-wrap{display:flex;flex-direction:column;align-items:center;flex-shrink:0;padding-top:3px}
    .event-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0}
    .event-line-v{width:2px;background:#e2e8f0;flex:1;margin-top:4px;min-height:20px}
    .event-body{flex:1;min-width:0}
    .event-description{font-size:.875rem;font-weight:500;color:#334155}
    .event-location{font-size:.75rem;color:#64748b;margin-top:.2rem}
    .event-time{font-size:.72rem;color:#94a3b8;margin-top:.3rem}
    .empty{text-align:center;color:#94a3b8;padding:2rem;font-size:.875rem}
    .footer{text-align:center;font-size:.72rem;color:#94a3b8;margin-top:.5rem}
  </style>
</head>
<body>
<div class="page">
  <div class="brand">Package Tracker</div>

  <div class="card">
    <div class="ref-label">Reference Number</div>
    <div class="ref-id">${escapeHtml(proxyId)}</div>
    <div class="badge ${currentStatus.cssClass}">${escapeHtml(currentStatus.label)}</div>
    <div class="carrier-line">Carrier: <strong>${escapeHtml(carrierName)}</strong></div>
    <div class="share-box">
      <div class="share-label">Share this tracking link</div>
      <div class="share-url" id="shareUrl">${escapeHtml(shareUrl)}</div>
      <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('shareUrl').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy Link',1500)})">Copy Link</button>
    </div>
  </div>

  <div class="card">
    <div class="section-title">Tracking History</div>
    ${eventsHtml}
  </div>

  <div class="footer">Last updated ${escapeHtml(now)} ET &nbsp;·&nbsp; <a href="/track/${escapeHtml(proxyId)}" style="color:#94a3b8">Refresh</a></div>
</div>
</body>
</html>`;
}

export function renderErrorPage(proxyId: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tracking Error</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:14px;padding:2rem;box-shadow:0 1px 4px rgba(0,0,0,.07);max-width:420px;text-align:center}
    h2{margin-bottom:.75rem;color:#ef4444}
    p{font-size:.875rem;color:#64748b;margin-bottom:1.25rem}
    a{color:#3b82f6;font-size:.875rem}
  </style>
</head>
<body>
<div class="card">
  <h2>Tracking Unavailable</h2>
  <p>${escapeHtml(message)}</p>
  ${proxyId ? `<a href="/track/${escapeHtml(proxyId)}">Try again</a>` : ""}
</div>
</body>
</html>`;
}

export function renderNotFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;color:#1e293b;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#fff;border-radius:14px;padding:2rem;box-shadow:0 1px 4px rgba(0,0,0,.07);max-width:420px;text-align:center}
    h2{margin-bottom:.75rem}
    p{font-size:.875rem;color:#64748b}
  </style>
</head>
<body>
<div class="card">
  <h2>Tracking Link Not Found</h2>
  <p>This tracking link doesn't exist or may have expired.</p>
</div>
</body>
</html>`;
}
