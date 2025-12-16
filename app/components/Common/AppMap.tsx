"use client";
import Map, { Layer, LineLayer, Marker, Source } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState } from "react";
import Image from "next/image";
import type { Feature, LineString } from "geojson";

type MapProps = {
  width: number;
  height: number;
};

const AppMap = ({ width, height }: MapProps) => {
  const [viewState, setViewState] = useState({
    latitude: 31.7683,
    longitude: 35.2137,
    zoom: 14,
  });
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

  const geojson: Feature<LineString> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [35.2137, 31.7683],
        [35.2145, 31.7690],
        [35.2150, 31.7700],
        [35.2160, 31.7710],
        [35.2170, 31.7720],
      ],
    },
  };

  const routeLayer: LineLayer = {
    id: "route",
    type: "line",
    source: "route",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#0ea5e9",
      "line-width": 5,
    },
  };

  return (
    <Map
      mapboxAccessToken={token}
      {...viewState}
      onMove={(evt) => setViewState(evt.viewState)}
      style={{ width, height }}
      mapStyle="mapbox://styles/mapbox/streets-v9"
    >
      <Marker longitude={35.2137} latitude={31.7683} anchor="bottom">
        <Image src="/img/loc.png" alt="mappin" width={30} height={30} />
      </Marker>

      <Source id="route" type="geojson" data={geojson}>
        <Layer {...routeLayer} />
      </Source>
    </Map>
  );
};

export default AppMap;
