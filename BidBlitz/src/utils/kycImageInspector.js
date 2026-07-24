const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    resolve(img);
  };
  img.onerror = (error) => {
    URL.revokeObjectURL(url);
    reject(error);
  };
  img.src = url;
});

export async function inspectKycImage(file) {
  try {
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    const width = Math.min(img.naturalWidth || img.width, 220);
    const height = Math.max(1, Math.round(((img.naturalHeight || img.height) / Math.max(img.naturalWidth || img.width, 1)) * width));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    let brightnessTotal = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      brightnessTotal += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    }
    const avgBrightness = brightnessTotal / Math.max(pixels.length / 4, 1);
    const warnings = [];

    if ((img.naturalWidth || 0) < 900 || (img.naturalHeight || 0) < 600) {
      warnings.push("Die Bildauflösung ist eher niedrig. Bitte möglichst nah und scharf fotografieren.");
    }
    if (avgBrightness < 65) {
      warnings.push("Das Bild wirkt recht dunkel. Bitte bei hellerem Licht fotografieren.");
    }

    return warnings;
  } catch {
    return [];
  }
}