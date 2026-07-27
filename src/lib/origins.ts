// Fixed origin towns used for distance-to-destination calculations.
export type Origin = {
  key: "albertinia" | "riversdale" | "stilbaai" | "heidelberg";
  label: string;
  lat: number;
  lng: number;
};

export const ORIGINS: Origin[] = [
  { key: "albertinia", label: "Albertinia", lat: -34.2115, lng: 21.5807 },
  { key: "riversdale", label: "Riversdale", lat: -34.0908, lng: 21.2559 },
  { key: "stilbaai", label: "Stilbaai", lat: -34.3699, lng: 21.4234 },
  { key: "heidelberg", label: "Heidelberg", lat: -34.0929, lng: 20.9540 },
];
