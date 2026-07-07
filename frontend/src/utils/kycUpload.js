const KYC_ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/octet-stream",
  "binary/octet-stream",
]);

const KYC_ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

export const KYC_ACCEPT_ATTR = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function isSupportedKycImage(file) {
  if (!file) return false;
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (KYC_ALLOWED_TYPES.has(mime) && (mime !== "application/octet-stream" && mime !== "binary/octet-stream" || KYC_ALLOWED_EXTENSIONS.has(ext))) {
    return true;
  }
  return KYC_ALLOWED_EXTENSIONS.has(ext) && (!mime || mime === "application/octet-stream" || mime === "binary/octet-stream");
}

export function getKycImageValidationMessage() {
  return "Ungültiger Dateityp (JPG/PNG/WebP/HEIC/HEIF)";
}

export function isAlreadySubmittedKycError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("bereits eingereicht") || text.includes("warte auf prüfung") || text.includes("already submitted");
}