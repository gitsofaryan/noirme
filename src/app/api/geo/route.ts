import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Get IP address from headers
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
             request.headers.get("x-real-ip") || 
             "";

  // If localhost, default to a real IP in India for testing (e.g. Mumbai)
  let targetIp = ip;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "") {
    targetIp = "103.220.143.1"; // Real Indian IP address
  }

  try {
    // Fetch geo information for the IP
    const res = await fetch(`https://ipapi.co/${targetIp}/json/`);
    if (!res.ok) throw new Error("ipapi failed");
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return NextResponse.json({
        lat: data.latitude,
        lng: data.longitude,
        city: data.city || "Mumbai",
      });
    }
    throw new Error("Invalid response structure");
  } catch (e) {
    try {
      // Fallback API if ipapi fails
      const res = await fetch(`http://ip-api.com/json/${targetIp}`);
      if (!res.ok) throw new Error("ip-api failed");
      const data = await res.json();
      return NextResponse.json({
        lat: data.lat || 28.6139,
        lng: data.lon || 77.209,
        city: data.city || "New Delhi",
      });
    } catch (err) {
      console.error("[noirme] Server-side geo IP fetch failed:", err);
      // Return fallback coordinates (New Delhi)
      return NextResponse.json({
        lat: 28.6139,
        lng: 77.209,
        city: "Fallback (New Delhi)",
      });
    }
  }
}
