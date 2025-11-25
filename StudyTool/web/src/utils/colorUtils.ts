export interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export function hexToRgb(hex: string): RGB | null {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex({ r, g, b }: RGB): string {
  const componentToHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;

  let h = 0;
  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  let r = 0, g = 0, b = 0;
  const hDecimal = h / 360;
  const sDecimal = s / 100;
  const vDecimal = v / 100;

  const i = Math.floor(hDecimal * 6);
  const f = hDecimal * 6 - i;
  const p = vDecimal * (1 - sDecimal);
  const q = vDecimal * (1 - f * sDecimal);
  const t = vDecimal * (1 - (1 - f) * sDecimal);

  switch (i % 6) {
    case 0: r = vDecimal; g = t; b = p; break;
    case 1: r = q; g = vDecimal; b = p; break;
    case 2: r = p; g = vDecimal; b = t; break;
    case 3: r = p; g = q; b = vDecimal; break;
    case 4: r = t; g = p; b = vDecimal; break;
    case 5: r = vDecimal; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

export function hexToHsv(hex: string): HSV {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 0 }; // Default to black on error
  return rgbToHsv(rgb);
}

export function hsvToHex(hsv: HSV): string {
  const rgb = hsvToRgb(hsv);
  return rgbToHex(rgb);
}
