import React, { useState, useEffect, useRef } from "react";
import { hexToHsv, hsvToHex, hexToRgb, HSV } from "../utils/colorUtils";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  initialColor: string;
  presets?: { name: string; value: string }[];
  darkMode?: boolean;
}

export default function ColorPicker({
  color,
  onChange,
  initialColor,
  presets,
  darkMode,
}: ColorPickerProps) {
  const [hsv, setHsv] = useState<HSV>(hexToHsv(color));
  const [isDragging, setIsDragging] = useState(false);
  const svRef = useRef<HTMLDivElement>(null);

  // Sync internal HSV if external color prop changes (and not dragging)
  // Only update if the color is valid to avoid jumping to black while typing
  useEffect(() => {
    if (!isDragging && hexToRgb(color)) {
      setHsv(hexToHsv(color));
    }
  }, [color, isDragging]);

  const handleSvChange = (e: React.MouseEvent | MouseEvent) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const s = Math.round((x / rect.width) * 100);
    const v = Math.round(100 - (y / rect.height) * 100);

    const newHsv = { ...hsv, s, v };
    setHsv(newHsv);
    onChange(hsvToHex(newHsv));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSvChange(e);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleSvChange(e);
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, hsv, onChange]);

  const textColor = darkMode ? "#e0e0e0" : "#333";
  const borderColor = darkMode ? "#444" : "#ccc";
  const inputBg = darkMode ? "#2d2d2d" : "#fff";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1. Presets */}
      {presets && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
          }}
        >
          {presets.map((p) => (
            <button
              key={p.value}
              onClick={() => onChange(p.value)}
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: 8,
                backgroundColor: p.value,
                border:
                  color.toLowerCase() === p.value.toLowerCase()
                    ? "3px solid white"
                    : "1px solid #ccc",
                cursor: "pointer",
                boxShadow:
                  color.toLowerCase() === p.value.toLowerCase()
                    ? "0 0 8px rgba(0,0,0,0.3)"
                    : "none",
                position: "relative",
              }}
              title={p.name}
            />
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* 2. SV Square */}
        <div
          ref={svRef}
          onMouseDown={handleMouseDown}
          style={{
            width: 140,
            height: 140,
            flexShrink: 0,
            backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            backgroundImage: `
              linear-gradient(to top, #000, transparent),
              linear-gradient(to right, #fff, transparent)
            `,
            position: "relative",
            cursor: "crosshair",
            borderRadius: 6,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${hsv.s}%`,
              bottom: `${hsv.v}%`,
              width: 12,
              height: 12,
              border: "2px solid white",
              borderRadius: "50%",
              transform: "translate(-50%, 50%)",
              boxShadow: "0 0 3px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              backgroundColor: "transparent",
            }}
          />
        </div>

        {/* 3. Controls */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0, // Flex child fix
          }}
        >
          {/* Hue Slider */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                marginBottom: 4,
                color: textColor,
                fontWeight: 600,
              }}
            >
              Hue
            </label>
            <input
              type="range"
              min="0"
              max="360"
              value={hsv.h}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onChange={(e) => {
                const newHsv = { ...hsv, h: Number(e.target.value) };
                setHsv(newHsv);
                onChange(hsvToHex(newHsv));
              }}
              style={{
                width: "100%",
                height: 12,
                borderRadius: 6,
                appearance: "none",
                background:
                  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>

          {/* Hex Input */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                marginBottom: 4,
                color: textColor,
                fontWeight: 600,
              }}
            >
              Hex
            </label>
            <input
              type="text"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: `1px solid ${borderColor}`,
                background: inputBg,
                color: textColor,
                fontSize: 13,
                fontFamily: "monospace",
              }}
              maxLength={7}
            />
          </div>

          {/* Old vs New */}
          <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 32,
                  background: initialColor || "#ccc",
                  borderRadius: 4,
                  border: `1px solid ${borderColor}`,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: darkMode ? "#aaa" : "#666",
                }}
              >
                Old
              </div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: 32,
                  background: hexToRgb(color) ? color : "transparent", // Don't show invalid color
                  borderRadius: 4,
                  border: `1px solid ${borderColor}`,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                  {/* Checkerboard for transparent/invalid */}
                  {!hexToRgb(color) && (
                      <div style={{
                          width: "100%", height: "100%",
                          background: `repeating-linear-gradient(45deg, #ccc 0, #ccc 10px, #eee 10px, #eee 20px)`
                      }} />
                  )}
              </div>
              <div
                style={{
                  fontSize: 11,
                  marginTop: 4,
                  color: darkMode ? "#aaa" : "#666",
                }}
              >
                New
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
