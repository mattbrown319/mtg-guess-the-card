import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MTG Guess the Card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0f",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Card silhouette */}
        <div
          style={{
            width: 280,
            height: 390,
            borderRadius: 16,
            backgroundColor: "#1a1a2e",
            border: "3px solid #2a2a3e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: 180,
              fontWeight: "bold",
              color: "#7c3aed",
            }}
          >
            ?
          </div>
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: "bold",
            color: "#e8e8f0",
            marginBottom: 12,
          }}
        >
          Guess the Card
        </div>

        <div
          style={{
            fontSize: 24,
            color: "#9494a8",
          }}
        >
          Can you identify the mystery MTG card?
        </div>
      </div>
    ),
    { ...size }
  );
}
