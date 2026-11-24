export type ExplorerMode = "HOMES" | "ROOFTOP" | "STREET";

export type UnitMeasurement = "M2" | "FT2";

export interface ExplorerUnit {
  id: string;
  unitNumber: string;
  floor: number;
  title: string;
  areaM2: number;
  areaFt2: number;
  priceMonthly: number;
  depositAmount: number;
  status: "AVAILABLE" | "RENTED" | "MAINTENANCE";
  facing: string; // e.g. "View Sông (Đông Nam)", "View Phố (Tây Bắc)"
  bedType: string;
  maxOccupants: number;
  images: string[];
  amenities: string[];
  description: string;
  // 3D local coordinate on the floorplate
  position3D: [number, number, number];
  roomDimensions: [number, number]; // width, length in 3D units
}

export interface HotspotPoint {
  id: string;
  label: string;
  sublabel: string;
  description: string;
  position3D: [number, number, number];
  category: "AMENITY" | "FACILITY" | "COMMERCE";
}

export interface Property3DData {
  id: string;
  name: string;
  address: string;
  totalFloors: number;
  floors: number[];
  units: ExplorerUnit[];
  rooftopHotspots: HotspotPoint[];
  streetHotspots: HotspotPoint[];
}
