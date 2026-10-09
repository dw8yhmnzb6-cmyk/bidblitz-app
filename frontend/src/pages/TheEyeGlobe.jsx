import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Uses the project's existing Mapbox dependency. No additional service is created.
export default function TheEyeGlobe({ devices = [], onSelectDevice }) {
  const host = useRef(null);
  const [globeError, setGlobeError] = useState("");
  const mapRef = useRef(null);
  const selectRef = useRef(onSelectDevice);
  useEffect(() => { selectRef.current = onSelectDevice; }, [onSelectDevice]);

  useEffect(() => {
    const token = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
    if (!token || !host.current) return undefined;
    if (!mapboxgl.supported()) {
      setGlobeError("3D-Grafik wird auf diesem Gerät nicht unterstützt. Bitte 2D-Karte verwenden.");
      return undefined;
    }
    let map;
    try {
      map = new mapboxgl.Map({
      container: host.current,
      accessToken: token,
      style: "mapbox://styles/mapbox/dark-v11",
      projection: "globe",
      center: [15, 25],
      zoom: 1.5,
      attributionControl: true,
      });
    } catch (error) {
      setGlobeError("3D-Karte konnte nicht gestartet werden. Bitte 2D-Karte verwenden.");
      return undefined;
    }
    const onMapError = () => setGlobeError("Die 3D-Karte konnte nicht vollständig geladen werden.");
    const onMapLoad = () => setGlobeError("");
    map.on("error", onMapError);
    map.on("load", onMapLoad);
    mapRef.current = map;
    const onStyleLoad = () => {
      if (!map.getSource("eye-devices")) {
        map.addSource("eye-devices", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("eye-device-markers")) {
        map.addLayer({
          id: "eye-device-markers",
          type: "circle",
          source: "eye-devices",
          paint: {
            "circle-radius": 5,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#e0f4ff",
            "circle-color": [
              "match", ["get", "status"],
              "online", "#2fe18a",
              "warning", "#ffb63e",
              "offline", "#ff6767",
              "#8294a2",
            ],
          },
        });
      }
    };
    const onDeviceClick = (event) => {
      const id = event.features?.[0]?.properties?.device_id;
      if (id) selectRef.current?.(id);
    };
    const onDeviceEnter = () => { map.getCanvas().style.cursor = "pointer"; };
    const onDeviceLeave = () => { map.getCanvas().style.cursor = ""; };
    map.on("click", "eye-device-markers", onDeviceClick);
    map.on("mouseenter", "eye-device-markers", onDeviceEnter);
    map.on("mouseleave", "eye-device-markers", onDeviceLeave);
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("click", "eye-device-markers", onDeviceClick);
      map.off("mouseenter", "eye-device-markers", onDeviceEnter);
      map.off("mouseleave", "eye-device-markers", onDeviceLeave);
      map.off("error", onMapError);
      map.off("load", onMapLoad);
      map.off("style.load", onStyleLoad);
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      const source = map.getSource("eye-devices");
      if (!source) return;
      const features = devices.filter((item) => {
        const lat = Number(item?.location?.lat);
        const lng = Number(item?.location?.lng);
        return item?.device_id != null && String(item.device_id).trim() !== "" &&
          item?.location?.lat != null && item?.location?.lng != null &&
          Number.isFinite(lat) && Number.isFinite(lng) &&
          lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      }).slice(0, 1000).map((item) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [Number(item.location.lng), Number(item.location.lat)] },
        properties: { device_id: String(item.device_id), status: item.connection_status || "unknown" },
      }));
      source.setData({ type: "FeatureCollection", features });
    };
    if (map.isStyleLoaded()) update();
    map.on("style.load", update);
    return () => map.off("style.load", update);
  }, [devices]);

  if (!process.env.REACT_APP_MAPBOX_ACCESS_TOKEN) return null;
  return <div className="eye-3d-globe" role="region" aria-label="Interaktiver 3D-Globus mit eigenen Geräten">
    <div ref={host} style={{ width: "100%", height: "100%" }} />
    {globeError ? <div role="alert" className="eye-globe-error">{globeError}</div> : null}
  </div>;
}
