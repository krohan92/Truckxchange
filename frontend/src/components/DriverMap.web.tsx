import React, { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { colors, radius } from "@/src/theme";
import type { MapDriver } from "./DriverMap";

export type { MapDriver } from "./DriverMap";

type Props = {
  drivers: MapDriver[];
  center: { latitude: number; longitude: number };
  onPressDriver?: (id: string) => void;
  height?: number;
};

let leafletLoading: Promise<any> | null = null;

// Metro picks this file automatically on web (the .web.tsx extension),
// DriverMap.tsx for iOS/Android. Same data, same OpenStreetMap tiles — on
// web there's no WebView, so Leaflet mounts straight into a plain <div> via
// a dynamically-loaded script/stylesheet (no bundler dependency, no API
// key — just OpenStreetMap, same as the native version).
function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.body.appendChild(script);
  });
  return leafletLoading;
}

export default function DriverMap({ drivers, center, onPressDriver, height = 260 }: Props) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !divRef.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
      }
      const map = L.map(divRef.current, { zoomControl: false }).setView([center.latitude, center.longitude], 11);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);
      L.circleMarker([center.latitude, center.longitude], { radius: 7, color: "#fff", weight: 2, fillColor: "#2F8F5B", fillOpacity: 1 }).addTo(map);

      const pinIcon = L.divIcon({
        className: "driver-pin",
        html: "<div style='background:#1a73e8;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,0.15)'></div>",
        iconSize: [14, 14],
      });
      drivers.forEach((d) => {
        const m = L.marker([d.latitude, d.longitude], { icon: pinIcon }).addTo(map);
        const label = d.name + (d.distance_mi != null ? ` · ${d.distance_mi} mi` : "");
        m.bindPopup(label);
        m.on("click", () => onPressDriver && onPressDriver(d.id));
      });
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(drivers), center.latitude, center.longitude]);

  return (
    <View style={[styles.wrap, { height }]}>
      {/* @ts-ignore — plain DOM div, valid under react-native-web */}
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
});
