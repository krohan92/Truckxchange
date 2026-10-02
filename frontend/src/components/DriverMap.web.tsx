import React, { useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { colors, radius } from "@/src/theme";

export type MapDriver = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_mi?: number;
};

type Props = {
  drivers: MapDriver[];
  center: { latitude: number; longitude: number };
  onPressDriver?: (id: string) => void;
  height?: number;
};

// A self-contained Leaflet map using OpenStreetMap tiles — no Google Maps,
// no API key, no third-party map SDK. Same approach on every platform: this
// file renders it inside a WebView on iOS/Android; DriverMap.web.tsx mounts
// the identical Leaflet map straight into the page's DOM on web.
function buildHtml(drivers: MapDriver[], center: { latitude: number; longitude: number }) {
  const markers = JSON.stringify(drivers);
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #e5e3dd; }
    .driver-pin { background: #1a73e8; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 2px rgba(0,0,0,0.15); }
    .leaflet-popup-content { font-family: -apple-system, sans-serif; font-size: 13px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = [${center.latitude}, ${center.longitude}];
    const map = L.map('map', { zoomControl: false }).setView(center, 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    L.circleMarker(center, { radius: 7, color: '#fff', weight: 2, fillColor: '#2F8F5B', fillOpacity: 1 }).addTo(map);

    const pinIcon = L.divIcon({ className: 'driver-pin', iconSize: [14, 14] });
    const drivers = ${markers};
    drivers.forEach((d) => {
      const m = L.marker([d.latitude, d.longitude], { icon: pinIcon }).addTo(map);
      const label = d.name + (d.distance_mi != null ? (' · ' + d.distance_mi + ' mi') : '');
      m.bindPopup(label);
      m.on('click', () => {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(d.id);
      });
    });
  </script>
</body>
</html>`;
}

export default function DriverMap({ drivers, center, onPressDriver, height = 260 }: Props) {
  const webviewRef = useRef<WebView>(null);
  const html = useMemo(() => buildHtml(drivers, center), [drivers, center]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        onMessage={(e) => onPressDriver && onPressDriver(e.nativeEvent.data)}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  webview: { flex: 1, backgroundColor: "transparent" },
});
