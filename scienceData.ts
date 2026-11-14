export interface NasaImage {
  nasa_id: string;
  title: string;
  description: string;
  credit: string;
  date_created: string | null;
  thumbnail_url: string | null;
  source_url: string;
}

export interface NasaImageSearchResponse {
  source: string;
  query: string;
  total_results: number;
  items: NasaImage[];
}

export interface MissionSimulationRequest {
  latitude_deg: number;
  longitude_deg: number;
  start_time_utc: string;
  duration_hours: number;
  panel_area_m2: number;
  panel_efficiency: number;
  panel_tilt_deg: number;
  panel_azimuth_deg: number;
  system_losses_percent: number;
  battery_capacity_kwh: number;
  load_w: number;
  initial_battery_percent: number;
}

export interface CommunicationWindow {
  start_utc: string;
  end_utc: string;
  duration_hours: number;
}

export interface MissionSample {
  time_utc: string;
  sun_azimuth_deg: number;
  sun_elevation_deg: number;
  sunlight: boolean;
  earth_azimuth_deg: number;
  earth_elevation_deg: number;
  earth_visible: boolean;
  panel_power_w: number;
  battery_percent: number;
}

export interface LunarSimulationResponse {
  source: string;
  source_detail: string;
  retrieved_at_utc: string;
  latitude_deg: number;
  longitude_deg: number;
  start_time_utc: string;
  end_time_utc: string;
  duration_hours: number;
  sample_interval_minutes: number;
  geometric_sunlight_hours: number;
  geometric_shadow_hours: number;
  earth_visible_hours: number;
  communication_windows: CommunicationWindow[];
  reference_irradiance_w_m2: number;
  panel_peak_reference_w: number;
  predicted_panel_energy_wh: number;
  mission_load_w: number;
  mission_energy_demand_wh: number;
  battery_capacity_kwh: number;
  ending_battery_percent: number;
  minimum_battery_percent: number;
  unmet_load_wh: number;
  terrain_occlusion_included: boolean;
  communication_link_budget_included: boolean;
  limitations: string[];
  samples: MissionSample[];
}

export interface TerrainProfilePoint {
  distance_km: number;
  latitude_deg: number;
  longitude_deg: number;
  relative_elevation_m: number;
}

export interface TerrainProfileResponse {
  source: string;
  product: string;
  source_url: string;
  resolution_m: number;
  reference_radius_m: number;
  bearing_from_north_deg: number;
  distance_km: number;
  site_elevation_m: number;
  terrain_horizon_elevation_deg: number;
  samples: TerrainProfilePoint[];
}