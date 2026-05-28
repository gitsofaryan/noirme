import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { OSMPlace } from "@/hooks/useOSM";

interface OSMMarkerProps {
  place: OSMPlace;
}

export function OSMMarker({ place }: OSMMarkerProps) {
  // Create a minimal, subtle icon for OSM places
  const iconHtml = `
    <div style="
      width: 8px;
      height: 8px;
      background-color: #a1a1aa;
      border-radius: 50%;
      border: 1.5px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    "></div>
  `;

  const customIcon = L.divIcon({
    html: iconHtml,
    className: "custom-osm-marker",
    iconSize: [8, 8],
    iconAnchor: [4, 4],
  });

  return (
    <Marker position={[place.lat, place.lon]} icon={customIcon}>
      <Tooltip direction="top" offset={[0, -4]} opacity={1}>
        <span className="text-xs font-semibold text-zinc-800">
          {place.tags.name}
        </span>
        {place.tags.amenity && (
          <span className="ml-1 text-[9px] uppercase tracking-wider text-zinc-400">
            • {place.tags.amenity}
          </span>
        )}
      </Tooltip>
    </Marker>
  );
}
