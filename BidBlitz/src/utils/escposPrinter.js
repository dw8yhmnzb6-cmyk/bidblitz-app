/**
 * BidBlitz POS — ESC/POS Bluetooth Receipt Printer (Web Bluetooth)
 * Production: real Bluetooth thermal printer support for Android Chrome / Edge desktop.
 * Falls back gracefully if Web Bluetooth unavailable (iOS, Firefox).
 */

// Common ESC/POS thermal printer service UUIDs
const SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",   // ESC/POS printer
  "0000ff00-0000-1000-8000-00805f9b34fb",   // Common chinese clones
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",   // Microchip / Star
];
const CHAR_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
];

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

function bytes(...b) { return Uint8Array.from(b); }

function buildCommands(sale, merchant, store) {
  const out = [];
  // Init
  out.push(bytes(ESC, 0x40));                              // Reset
  // Center align bold double-height for header
  out.push(bytes(ESC, 0x61, 1));                           // center
  out.push(bytes(GS, 0x21, 0x11));                         // double width+height
  out.push(new TextEncoder().encode(`${merchant.business_name || "BidBlitz POS"}\n`));
  out.push(bytes(GS, 0x21, 0x00));                         // normal
  if (store?.name) out.push(new TextEncoder().encode(`${store.name}\n`));
  if (store?.city) out.push(new TextEncoder().encode(`${store.city}\n`));
  out.push(new TextEncoder().encode("\n"));

  // Left align body
  out.push(bytes(ESC, 0x61, 0));
  out.push(new TextEncoder().encode(`Beleg: ${sale.receipt_id}\n`));
  out.push(new TextEncoder().encode(`Datum: ${new Date(sale.created_at).toLocaleString()}\n`));
  out.push(new TextEncoder().encode("--------------------------------\n"));
  for (const it of sale.items) {
    const left = `${it.quantity}x ${it.name}`.slice(0, 22);
    const right = `EUR ${it.line_total.toFixed(2)}`;
    const pad = Math.max(1, 32 - left.length - right.length);
    out.push(new TextEncoder().encode(`${left}${" ".repeat(pad)}${right}\n`));
  }
  out.push(new TextEncoder().encode("--------------------------------\n"));
  const fmt = (lbl, val) => {
    const right = `EUR ${val.toFixed(2)}`;
    const pad = Math.max(1, 32 - lbl.length - right.length);
    return `${lbl}${" ".repeat(pad)}${right}\n`;
  };
  out.push(new TextEncoder().encode(fmt("Netto", sale.net_total)));
  out.push(new TextEncoder().encode(fmt("MwSt", sale.tax_total)));
  out.push(bytes(ESC, 0x45, 1));                            // bold
  out.push(new TextEncoder().encode(fmt("GESAMT", sale.total)));
  out.push(bytes(ESC, 0x45, 0));                            // bold off
  out.push(new TextEncoder().encode(`\nZahlung: ${sale.method}\n`));
  out.push(new TextEncoder().encode(`Ref: ${sale.payment_id}\n\n`));

  // QR code with payment id
  const qrData = `BIDBLITZ-RCP:${sale.receipt_id}`;
  out.push(bytes(ESC, 0x61, 1));                            // center
  // GS ( k pL pH cn fn n  → QR module size
  out.push(bytes(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06));
  // Error correction L
  out.push(bytes(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30));
  // Store the data
  const dataBytes = new TextEncoder().encode(qrData);
  const len = dataBytes.length + 3;
  out.push(bytes(GS, 0x28, 0x6B, len & 0xFF, (len >> 8) & 0xFF, 0x31, 0x50, 0x30));
  out.push(dataBytes);
  // Print
  out.push(bytes(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30));

  out.push(new TextEncoder().encode("\nDanke fuer Ihren Einkauf!\nPowered by BidBlitz\n\n\n"));
  // Cut
  out.push(bytes(GS, 0x56, 0x42, 0x00));

  // Concat
  let total = 0; out.forEach((b) => total += b.byteLength);
  const merged = new Uint8Array(total);
  let pos = 0;
  for (const b of out) { merged.set(b, pos); pos += b.byteLength; }
  return merged;
}

export async function isBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

export async function connectPrinter() {
  if (!navigator.bluetooth) throw new Error("Web Bluetooth nicht unterstützt (Android Chrome/Desktop Edge nötig)");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS,
  });
  const server = await device.gatt.connect();
  // Find first matching writable characteristic
  for (const su of SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(su);
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          if (CHAR_UUIDS.includes(c.uuid) || c.properties.writeWithoutResponse) {
            return { device, server, characteristic: c };
          }
        }
      }
    } catch {
      // try next service
    }
  }
  throw new Error("Kein druckbarer Charakteristik gefunden");
}

export async function printReceipt(sale, merchant = {}, store = {}) {
  const conn = await connectPrinter();
  const data = buildCommands(sale, merchant, store);
  // Send in chunks (BLE MTU ~180 bytes)
  const CHUNK = 150;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    if (conn.characteristic.properties.writeWithoutResponse) {
      await conn.characteristic.writeValueWithoutResponse(slice);
    } else {
      await conn.characteristic.writeValue(slice);
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  // Disconnect after a delay
  setTimeout(() => { try { conn.server.disconnect(); } catch { /* ignore */ } }, 1500);
  return true;
}
