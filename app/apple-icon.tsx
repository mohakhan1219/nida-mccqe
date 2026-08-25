import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5C4A8A",
          color: "#F7F4EE",
          fontSize: 72,
          fontWeight: 600,
        }}
      >
        N
      </div>
    ),
    size
  )
}
