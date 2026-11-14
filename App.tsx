import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Bot,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Crosshair,
  Database,
  ExternalLink,
  Globe2,
  Home,
  MapPin,
  Menu,
  Pause,
  Play,
  Radio,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Satellite,
  Sun,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { fetchTerrainProfile, runMissionSimulation, verifyScienceArchive } from "./services/scienceData";
import type { LunarSimulationResponse, MissionSimulationRequest, TerrainProfileResponse } from "./types/scienceData";
import NasaMediaGallery from "./components/NasaMediaGallery";

type ArchiveState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

type Site = {
  id: string;
  name: string;
  shortName: string;
  lat: string;
  lon: string;
  x: number;
  y: number;
  terrain: string;
};

const sites: Site[] = [
  { id: "shackleton", name: "Shackleton Rim", shortName: "Shackleton", lat: "-89.90", lon: "0.00", x: 49, y: 62, terrain: "Crater rim · polar highlands" },
  { id: "malapert", name: "Malapert Massif", shortName: "Malapert", lat: "-85.99", lon: "0.00", x: 34, y: 45, terrain: "Massif · elevated terrain" },
  { id: "connecting", name: "Connecting Ridge", shortName: "Connecting Ridge", lat: "-89.50", lon: "222.00", x: 66, y: 55, terrain: "Ridge · south-polar region" },
];

const navigation = [
  { href: "#overview", label: "Mission overview", icon: Activity },
  { href: "#explorer", label: "Lunar explorer", icon: Compass },
  { href: "#nasa-data", label: "NASA image archive", icon: Database },
  { href: "#assistant", label: "Selene-X Assistant", icon: Bot },
  { href: "#illumination", label: "Sunlight analysis", icon: Sun },
  { href: "#communications", label: "Earth visibility", icon: Radio },
  { href: "#power", label: "Power simulator", icon: BatteryCharging },
  { href: "#comparison", label: "Site comparison", icon: Waves },
];

function buildSimulationRequest(
  latitude: number,
  longitude: number,
  startTime: string,
  durationHours: number,
  panelArea: number,
  panelEfficiency: number,
  panelTilt: number,
  panelAzimuth: number,
  systemLosses: number,
  batteryCapacity: number,
  missionLoad: number,
  initialBatteryPercent: number,
): MissionSimulationRequest {
  const startTimeUtc = new Date(`${startTime}:00Z`);
  if (Number.isNaN(startTimeUtc.getTime())) {
    throw new Error("Choose a valid analysis start time.");
  }
  return {
    latitude_deg: latitude,
    longitude_deg: longitude,
    start_time_utc: startTimeUtc.toISOString(),
    duration_hours: durationHours,
    panel_area_m2: panelArea,
    panel_efficiency: panelEfficiency / 100,
    panel_tilt_deg: panelTilt,
    panel_azimuth_deg: panelAzimuth,
    system_losses_percent: systemLosses,
    battery_capacity_kwh: batteryCapacity,
    load_w: missionLoad,
    initial_battery_percent: initialBatteryPercent,
  };
}

function App() {
  const [archiveState, setArchiveState] = useState<ArchiveState>({ kind: "loading" });
  const [activeSection, setActiveSection] = useState("overview");
  const [simulation, setSimulation] = useState<LunarSimulationResponse | null>(null);
  const [simulationState, setSimulationState] = useState<"idle" | "loading" | "error">("idle");
  const [simulationError, setSimulationError] = useState("");
  const [terrainProfile, setTerrainProfile] = useState<TerrainProfileResponse | null>(null);
  const [terrainState, setTerrainState] = useState<"idle" | "loading" | "error">("idle");
  const [terrainError, setTerrainError] = useState("");
  const [earthTerrainProfile, setEarthTerrainProfile] = useState<TerrainProfileResponse | null>(null);
  const [earthTerrainState, setEarthTerrainState] = useState<"idle" | "loading" | "error">("idle");
  const [earthTerrainError, setEarthTerrainError] = useState("");
  const [siteId, setSiteId] = useState(sites[0].id);
  const [latitude, setLatitude] = useState(sites[0].lat);
  const [longitude, setLongitude] = useState(sites[0].lon);
  const [missionTime, setMissionTime] = useState("2026-01-01T00:00");
  const [analysisDuration, setAnalysisDuration] = useState(24);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [timePlaying, setTimePlaying] = useState(false);
  const [moonView, setMoonView] = useState({ rotateX: 0, rotateY: 0, zoom: 1 });
  const [panelArea, setPanelArea] = useState(10);
  const [panelEfficiency, setPanelEfficiency] = useState(25);
  const [panelTilt, setPanelTilt] = useState(15);
  const [panelAzimuth, setPanelAzimuth] = useState(180);
  const [systemLosses, setSystemLosses] = useState(10);
  const [batteryCapacity, setBatteryCapacity] = useState(80);
  const [missionLoad, setMissionLoad] = useState(1000);
  const [initialBatteryPercent, setInitialBatteryPercent] = useState(80);
  const [scenarioBSiteId, setScenarioBSiteId] = useState("malapert");
  const [scenarioBArea, setScenarioBArea] = useState(15);
  const [scenarioBEfficiency, setScenarioBEfficiency] = useState(30);
  const [scenarioBTilt, setScenarioBTilt] = useState(15);
  const [scenarioBAzimuth, setScenarioBAzimuth] = useState(180);
  const [scenarioBLosses, setScenarioBLosses] = useState(10);
  const [scenarioBBattery, setScenarioBBattery] = useState(100);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparisonSimulation, setComparisonSimulation] = useState<LunarSimulationResponse | null>(null);
  const [comparisonState, setComparisonState] = useState<"idle" | "loading" | "error">("idle");
  const [comparisonError, setComparisonError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const moonDrag = useRef<{ pointerX: number; pointerY: number; rotateX: number; rotateY: number } | null>(null);

  const selectedSite = sites.find((site) => site.id === siteId) ?? {
    id: "custom",
    name: "Custom coordinates",
    shortName: "Custom",
    lat: latitude,
    lon: longitude,
    x: 50,
    y: 50,
    terrain: "Custom point · terrain unknown",
  };
  const scenarioBSite = sites.find((site) => site.id === scenarioBSiteId) ?? sites[0];
  const archiveReady = archiveState.kind === "ready";
  const nominalPower = useMemo(
    () => panelArea * panelEfficiency * 13.61 * (1 - systemLosses / 100),
    [panelArea, panelEfficiency, systemLosses],
  );
  const selectedSample = simulation?.samples[selectedSampleIndex] ?? null;
  const terrainSunStatus = !selectedSample || !terrainProfile
    ? null
    : selectedSample.sun_elevation_deg <= 0
      ? "below the geometric horizon"
      : selectedSample.sun_elevation_deg <= terrainProfile.terrain_horizon_elevation_deg
        ? "intercepted by local terrain"
        : "clear along the sampled 10 km profile";
  const terrainEarthStatus = !selectedSample
    ? null
    : !selectedSample.earth_visible
      ? "below the geometric horizon"
      : !earthTerrainProfile
        ? null
        : selectedSample.earth_elevation_deg <= earthTerrainProfile.terrain_horizon_elevation_deg
          ? "intercepted by local terrain"
          : "clear along the sampled 10 km profile";
  const terrainPlot = useMemo(() => {
    if (!terrainProfile) return null;
    const elevations = terrainProfile.samples.map((point) => point.relative_elevation_m - terrainProfile.site_elevation_m);
    const minimum = Math.min(...elevations);
    const maximum = Math.max(...elevations);
    const span = Math.max(1, maximum - minimum);
    return {
      minimum,
      maximum,
      path: elevations.map((elevation, index) => {
        const x = (index / (elevations.length - 1)) * 420;
        const y = 84 - ((elevation - minimum) / span) * 62;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" "),
    };
  }, [terrainProfile]);
  const illuminationPercent = simulation ? Math.round((simulation.geometric_sunlight_hours / simulation.duration_hours) * 100) : null;
  const earthVisibilityPercent = simulation ? Math.round((simulation.earth_visible_hours / simulation.duration_hours) * 100) : null;
  const energyDifferencePercent = simulation && comparisonSimulation && simulation.predicted_panel_energy_wh > 0
    ? ((comparisonSimulation.predicted_panel_energy_wh - simulation.predicted_panel_energy_wh) / simulation.predicted_panel_energy_wh) * 100
    : null;
  const solarPlotPath = simulation?.samples.map((sample, index) => {
    const x = simulation.samples.length < 2 ? 0 : (index / (simulation.samples.length - 1)) * 1000;
    const y = 90 - ((Math.max(-10, Math.min(20, sample.sun_elevation_deg)) + 10) / 30) * 76;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const selectedSampleTime = selectedSample
    ? new Date(selectedSample.time_utc).toISOString().slice(11, 16)
    : null;
  const chartTimeLabels = simulation
    ? [0, 0.25, 0.5, 0.75, 1].map((fraction) => new Date(
      new Date(simulation.start_time_utc).getTime() + simulation.duration_hours * fraction * 3600000,
    ).toISOString().slice(11, 16))
    : ["00:00", "06:00", "12:00", "18:00", "24:00"];

  async function checkArchive() {
    setArchiveState({ kind: "loading" });
    try {
      await verifyScienceArchive();
      setArchiveState({ kind: "ready" });
    } catch (error) {
      setArchiveState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to verify the local science archive.",
      });
    }
  }

  async function runSimulation() {
    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    if (!Number.isFinite(latitudeValue) || latitudeValue < -90 || latitudeValue > 90) {
      setSimulationError("Enter a latitude between −90° and 90°.");
      setSimulationState("error");
      return;
    }
    if (!Number.isFinite(longitudeValue) || longitudeValue < -360 || longitudeValue > 360) {
      setSimulationError("Enter an east longitude between −360° and 360°.");
      setSimulationState("error");
      return;
    }

    setSimulationState("loading");
    setSimulationError("");
    try {
      const request = buildSimulationRequest(
        latitudeValue, longitudeValue, missionTime, analysisDuration,
        panelArea, panelEfficiency, panelTilt, panelAzimuth, systemLosses,
        batteryCapacity, missionLoad, initialBatteryPercent,
      );
      const data = await runMissionSimulation(request);
      setSimulation(data);
      setComparisonSimulation(null);
      setComparisonState("idle");
      setSelectedSampleIndex(0);
      setSimulationState("idle");
    } catch (error) {
      setSimulationState("error");
      setSimulationError(error instanceof Error ? error.message : "The archived simulation could not be completed.");
    }
  }

  async function runComparison() {
    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);
    const alternativeSite = sites.find((site) => site.id === scenarioBSiteId);
    if (!alternativeSite) {
      setComparisonError("Choose a valid second landing site.");
      setComparisonState("error");
      return;
    }

    setComparisonState("loading");
    setSimulationState("loading");
    setComparisonError("");
    setSimulation(null);
    setComparisonSimulation(null);
    try {
      const common = {
        startTime: missionTime,
        durationHours: analysisDuration,
        missionLoad,
      };
      const scenarioA = await runMissionSimulation(buildSimulationRequest(
        latitudeValue, longitudeValue, common.startTime, common.durationHours,
        panelArea, panelEfficiency, panelTilt, panelAzimuth, systemLosses,
        batteryCapacity, common.missionLoad, initialBatteryPercent,
      ));
      const scenarioB = await runMissionSimulation(buildSimulationRequest(
        Number(alternativeSite.lat), Number(alternativeSite.lon), common.startTime, common.durationHours,
        scenarioBArea, scenarioBEfficiency, scenarioBTilt, scenarioBAzimuth, scenarioBLosses,
        scenarioBBattery, common.missionLoad, initialBatteryPercent,
      ));
      setSimulation(scenarioA);
      setComparisonSimulation(scenarioB);
      setSelectedSampleIndex(0);
      setSimulationState("idle");
      setComparisonState("idle");
    } catch (error) {
      setSimulationState("idle");
      setComparisonState("error");
      setComparisonError(error instanceof Error ? error.message : "The archived site comparison failed.");
    }
  }

  function chooseSite(site: Site) {
    setSiteId(site.id);
    setLatitude(site.lat);
    setLongitude(site.lon);
  }

  useEffect(() => {
    void checkArchive();
  }, []);

  useEffect(() => {
    if (!simulation || !selectedSample || timePlaying) {
      setTerrainProfile(null);
      setTerrainState("idle");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setTerrainProfile(null);
      setTerrainState("loading");
      setTerrainError("");
      void fetchTerrainProfile(
        simulation.latitude_deg,
        simulation.longitude_deg,
        selectedSample.sun_azimuth_deg,
        controller.signal,
      ).then((profile) => {
        setTerrainProfile(profile);
        setTerrainState("idle");
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTerrainState("error");
        setTerrainError(error instanceof Error ? error.message : "The LOLA profile could not be loaded.");
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [simulation, selectedSample, timePlaying]);

  useEffect(() => {
    if (!simulation || !selectedSample || timePlaying || !selectedSample.earth_visible) {
      setEarthTerrainProfile(null);
      setEarthTerrainState("idle");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setEarthTerrainProfile(null);
      setEarthTerrainState("loading");
      setEarthTerrainError("");
      void fetchTerrainProfile(
        simulation.latitude_deg,
        simulation.longitude_deg,
        selectedSample.earth_azimuth_deg,
        controller.signal,
      ).then((profile) => {
        setEarthTerrainProfile(profile);
        setEarthTerrainState("idle");
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEarthTerrainState("error");
        setEarthTerrainError(error instanceof Error ? error.message : "The LOLA Earth-line profile could not be loaded.");
      });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [simulation, selectedSample, timePlaying]);

  useEffect(() => {
    const observedSections = navigation
      .filter((item) => item.href !== "#overview")
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((element): element is HTMLElement => element !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        if (visibleSections[0]) setActiveSection(visibleSections[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    observedSections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!timePlaying) return;
    const intervalId = window.setInterval(() => {
      setSelectedSampleIndex((current) => (
        simulation ? (current + 1) % simulation.samples.length : 0
      ));
    }, 1200);
    return () => window.clearInterval(intervalId);
  }, [timePlaying, simulation]);

  function startMoonDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    moonDrag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      rotateX: moonView.rotateX,
      rotateY: moonView.rotateY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveMoonDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = moonDrag.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.pointerX;
    const deltaY = event.clientY - drag.pointerY;
    setMoonView((view) => ({
      ...view,
      rotateX: Math.max(-55, Math.min(55, drag.rotateX - deltaY * 0.35)),
      rotateY: drag.rotateY + deltaX * 0.35,
    }));
  }

  function endMoonDrag() {
    moonDrag.current = null;
  }

  function changeZoom(amount: number) {
    setMoonView((view) => ({
      ...view,
      zoom: Math.min(1.7, Math.max(0.8, Number((view.zoom + amount).toFixed(1)))),
    }));
  }

  function resetMoonView() {
    setMoonView({ rotateX: 0, rotateY: 0, zoom: 1 });
  }

  return (
    <main className="app-shell" id="overview">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="LunaSight mission overview">
          <span className="brand-mark"><Compass size={19} strokeWidth={1.7} /></span>
          <span className="brand-name">LUNASIGHT</span>
          <span className="brand-divider" />
          <span className="brand-subtitle">LUNAR MISSION INTELLIGENCE</span>
        </a>
        <div className="topbar-right">
          <a className="home-topbar-link" href="./" aria-label="Return to LunaSight landing page"><Home size={14} /><span>HOME</span></a>
          <a className="assistant-topbar-link" href="#assistant" aria-label="Open Selene-X Assistant"><Bot size={15} /><span>ASK SELENE-X</span></a>
          <span className="utc-clock"><Clock3 size={14} /> {missionTime.replace("T", " ")} UTC*</span>
          <span className="topbar-status" aria-live="polite">
            <span className={`status-dot ${archiveReady ? "is-online" : ""}`} />
            {archiveState.kind === "loading" ? "VERIFYING ARCHIVE" : archiveReady ? "ARCHIVE READY" : "ARCHIVE ERROR"}
          </span>
          <button className="mobile-menu" type="button" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} onClick={() => setMobileNavOpen(!mobileNavOpen)}>
            {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`rail ${mobileNavOpen ? "nav-open" : ""}`} aria-label="Workspace sections">
          <div className="rail-label">MISSION CONTROL</div>
          {navigation.map(({ href, label, icon: Icon }) => (
            <a className={`rail-link ${activeSection === href.slice(1) ? "is-active" : ""}`} href={href} key={href} onClick={() => setMobileNavOpen(false)} aria-current={activeSection === href.slice(1) ? "page" : undefined}>
              <Icon size={16} strokeWidth={1.7} /> <span>{label}</span>
              {activeSection === href.slice(1) && <span className="nav-indicator" />}
            </a>
          ))}
          <div className="rail-spacer" />
          <div className="data-card">
            <div className="data-card-top"><Database size={14} /><span>DATA READINESS</span></div>
            <strong><span className={`data-dot ${archiveReady ? "live-dot" : ""}`} /> {archiveReady ? "Verified science archive" : "Archive unavailable"}</strong>
            <p>{archiveReady ? "Original JPL Horizons DE441 ephemerides and NASA LOLA terrain are stored locally for the three supported sites." : "Verify the bundled JPL and LOLA files before running an archived mission analysis."}</p>
            <a href="#illumination">Run a site simulation <ArrowUpRight size={12} /></a>
          </div>
          <div className="rail-version">LUNASIGHT <span>BUILD 0.1</span></div>
        </aside>

        <div className="main-content">
          <div className="page-heading">
            <div>
              <div className="breadcrumb"><span>MISSION CONTROL</span><span className="crumb-slash">/</span><span>OVERVIEW</span></div>
              <h1>South Pole Mission Overview</h1>
              <p className="page-intro">Bring lunar geometry, surface terrain, and mission engineering together to evaluate landing-site trade-offs.</p>
            </div>
            <button className="icon-button refresh-button" type="button" onClick={() => void checkArchive()} aria-label="Verify science archive" title="Verify science archive">
              <RefreshCw size={16} className={archiveState.kind === "loading" ? "spin" : ""} />
            </button>
          </div>

          <div className={`demo-banner ${simulation ? "simulation-banner" : ""}`} role={simulation ? "status" : "note"}>
            <span className="demo-badge"><span /> {simulation ? "ARCHIVED ANALYSIS" : "VERIFIED ARCHIVE"}</span>
            <span>{simulation ? `${simulation.source_detail} · ${simulation.sample_interval_minutes}-minute samples.` : "Mission geometry comes from locally archived JPL Horizons DE441 data; NASA LOLA terrain is bundled separately."}</span>
            <a href="#nasa-data">NASA imagery <ArrowUpRight size={12} /></a>
          </div>

          <section className="hero-grid" aria-label="Lunar explorer and landing site">
            <article className="panel explorer-panel" id="explorer">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow"><span className="live-mark" /> INTERACTIVE LUNAR EXPLORER</p>
                  <h2>South polar region</h2>
                </div>
                <div className="map-controls" role="group" aria-label="Lunar view controls">
                  <button className="map-control" type="button" onClick={resetMoonView} title="Reset lunar view"><Crosshair size={14} /><span>RESET</span></button>
                  <button className="map-zoom-button" type="button" onClick={() => setMoonView((view) => ({ ...view, rotateY: view.rotateY - 15 }))} aria-label="Rotate lunar view left" title="Rotate left"><RotateCcw size={14} /></button>
                  <button className="map-zoom-button" type="button" onClick={() => setMoonView((view) => ({ ...view, rotateY: view.rotateY + 15 }))} aria-label="Rotate lunar view right" title="Rotate right"><RotateCw size={14} /></button>
                  <button className="map-zoom-button" type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={14} /></button>
                  <span className="zoom-level">{Math.round(moonView.zoom * 100)}%</span>
                  <button className="map-zoom-button" type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={14} /></button>
                </div>
              </div>
              <div
                className={`moon-stage ${moonDrag.current ? "is-dragging" : ""}`}
                role="group"
                aria-label={`Illustrative lunar view, not to scale. Selected site: ${selectedSite.name}. Drag to rotate.`}
                onPointerDown={startMoonDrag}
                onPointerMove={moveMoonDrag}
                onPointerUp={endMoonDrag}
                onPointerCancel={endMoonDrag}
              >
                <div className="star-field" />
                <div className="map-grid" />
                <div className="moon" style={{ transform: `perspective(700px) rotateX(${moonView.rotateX}deg) rotateY(${moonView.rotateY}deg) scale(${moonView.zoom})` }}>
                  <div className="moon-shade" />
                  <span className="crater crater-a" />
                  <span className="crater crater-b" />
                  <span className="crater crater-c" />
                  <span className="crater crater-d" />
                  <span className="crater crater-e" />
                  <span className="crater crater-f" />
                  <span className="ridge ridge-a" />
                  <span className="ridge ridge-b" />
                  <span className="polar-glow" />
                  {[...sites, ...(siteId === "custom" ? [selectedSite] : [])].map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      className={`site-marker ${siteId === site.id ? "selected" : ""}`}
                      style={{ left: `${site.x}%`, top: `${site.y}%` }}
                      onClick={() => chooseSite(site)}
                      aria-label={`Select ${site.name}`}
                      title={site.name}
                    >
                      <span className="marker-pulse" /><span className="marker-label">{site.shortName}</span>
                    </button>
                  ))}
                </div>
                <div className="map-coordinate coordinate-top">89° S <span>·</span> POLAR VIEW</div>
                <div className="map-coordinate coordinate-bottom"><span className="north-arrow">↑</span> SOUTH POLE <span className="map-scale"><i /> 50 km</span></div>
                <div className="map-legend"><span><i className="legend-site" /> Candidate site</span><span><i className="legend-region" /> Polar highlands</span></div>
                <div className="map-note">Illustrative terrain · not to scale</div>
              </div>
              <div className="map-footer">
                <span><Globe2 size={14} /> LUNAR SOUTH POLE</span>
                <span className="map-footer-right">ILLUSTRATIVE MAP · NOT TO SCALE <span className="tiny-warning">!</span></span>
              </div>
            </article>

            <article className="panel site-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">LANDING SITE EXPLORER</p>
                  <h2>Site parameters</h2>
                </div>
                <span className="panel-index">01 / 06</span>
              </div>
              <label className="field-label" htmlFor="site-select">CANDIDATE LOCATION</label>
              <div className="select-wrap">
                <MapPin size={15} />
                <select id="site-select" value={siteId} onChange={(event) => {
                  const site = sites.find((candidate) => candidate.id === event.target.value);
                  if (site) chooseSite(site);
                }}>
                  {sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
                  {siteId === "custom" && <option value="custom">Custom coordinates</option>}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
              <div className="site-coordinates">
                <label>
                  <span>LATITUDE <small>°</small></span>
                  <input aria-label="Latitude" type="number" min="-90" max="90" step="0.01" value={latitude} onChange={(event) => {
                    setLatitude(event.target.value);
                    setSiteId("custom");
                  }} inputMode="decimal" />
                </label>
                <label>
                  <span>LONGITUDE <small>°</small></span>
                  <input aria-label="Longitude" type="number" min="0" max="360" step="0.01" value={longitude} onChange={(event) => {
                    setLongitude(event.target.value);
                    setSiteId("custom");
                  }} inputMode="decimal" />
                </label>
              </div>
              <label className="field-label date-label" htmlFor="mission-date">ANALYSIS DATE & TIME <span>UTC · ARCHIVE</span></label>
              <input className="date-input" id="mission-date" type="datetime-local" min="2026-01-01T00:00" max="2030-12-31T23:00" step="3600" value={missionTime} onChange={(event) => setMissionTime(event.target.value)} />
              <label className="field-label date-label" htmlFor="analysis-duration">SIMULATION WINDOW</label>
              <div className="select-wrap duration-select">
                <Clock3 size={14} />
                <select id="analysis-duration" value={analysisDuration} onChange={(event) => setAnalysisDuration(Number(event.target.value))}>
                  {[6, 12, 24, 48].map((hours) => <option value={hours} key={hours}>{hours} hours · hourly archive</option>)}
                </select>
                <ChevronDown size={14} className="select-chevron" />
              </div>
              <div className="site-divider" />
              <div className="site-facts">
                <div className="site-fact"><span>REGION TYPE</span><strong>{selectedSite.terrain}</strong></div>
                <div className="site-fact"><span>COORDINATE SOURCE</span><strong className="pending-value"><span /> User-selected · east longitude</strong></div>
                <div className="site-fact"><span>LOLA ELEVATION</span><strong className={terrainProfile ? "" : "unavailable"}>{terrainProfile ? `${terrainProfile.site_elevation_m.toFixed(1)} m · 40 m DEM` : "Run simulation · 85°S coverage"}</strong></div>
              </div>
              <button className="primary-button simulate-button" type="button" onClick={() => void runSimulation()} disabled={simulationState === "loading" || !archiveReady}>
                {simulationState === "loading" ? <RefreshCw size={15} className="spin" /> : <Sun size={15} />}
                {simulationState === "loading" ? "LOADING VERIFIED ARCHIVE…" : "RUN ARCHIVED SITE ANALYSIS"}
                <ArrowDownRight size={14} />
              </button>
              {simulationError && simulationState === "error" && <p className="simulation-error" role="alert">{simulationError}</p>}
              <p className="panel-footnote"><CircleHelp size={13} /> Original JPL geometry is archived hourly for the three named sites from 2026–2030; separate 10 km LOLA checks inspect the current Sun and Earth rays. Mission totals remain geometric.</p>
            </article>
          </section>

          <NasaMediaGallery />

          <section className="assistant-section" id="assistant" aria-labelledby="assistant-heading">
            <div className="assistant-heading">
              <div>
                <p className="eyebrow"><span className="live-mark" /> AI MISSION SUPPORT</p>
                <h2 id="assistant-heading">Selene-X Assistant</h2>
                <p>Ask Selene-X about lunar exploration and the Moon’s south pole without leaving LunaSight.</p>
              </div>
              <a
                className="assistant-open-link"
                href="https://astro.abdalruhman.space/bots/4b17810c-294f-45e5-88b0-f886bbca0215"
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab <ExternalLink size={13} />
              </a>
            </div>
            <div className="assistant-frame-wrap">
              <iframe
                title="Chat with Selene-X Assistant"
                src="https://astro.abdalruhman.space/bots/4b17810c-294f-45e5-88b0-f886bbca0215"
                loading="lazy"
              />
            </div>
          </section>

          <section className="metrics-strip" aria-label="Mission analysis status">
            <article className="metric-card">
              <div className="metric-head"><span>ILLUMINATION</span><Sun size={15} /></div>
              <div className="metric-number">{simulation ? simulation.geometric_sunlight_hours.toFixed(1) : "—"}<small> hrs</small></div>
              <div className="metric-caption"><span className="metric-state">{simulation ? `${illuminationPercent}% OF WINDOW` : "RUN SIMULATION"}</span>{simulation && selectedSample ? ` · Sun ${selectedSample.sun_elevation_deg.toFixed(1)}°` : " · JPL DE441 archive"}</div>
              <div className="metric-spark spark-sun" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            </article>
            <article className="metric-card">
              <div className="metric-head"><span>SHADOW DURATION</span><Waves size={15} /></div>
              <div className="metric-number">{simulation ? simulation.geometric_shadow_hours.toFixed(1) : "—"}<small> hrs</small></div>
              <div className="metric-caption"><span className="metric-state">{simulation ? "GEOMETRIC TOTAL" : "RUN SIMULATION"}</span>{terrainSunStatus ? ` · Current Sun ray ${terrainSunStatus}` : " · LOLA ray check separate"}</div>
              <div className="metric-spark spark-shadow" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            </article>
            <article className="metric-card">
              <div className="metric-head"><span>EARTH VISIBILITY</span><Radio size={15} /></div>
              <div className="metric-number">{simulation ? earthVisibilityPercent : "—"}<small> %</small></div>
              <div className="metric-caption"><span className="metric-state">{simulation ? `${simulation.earth_visible_hours.toFixed(1)} HRS GEOMETRIC` : "RUN SIMULATION"}</span>{terrainEarthStatus ? ` · Current Earth ray ${terrainEarthStatus}` : " · LOLA ray check separate"}</div>
              <div className="metric-spark spark-earth" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            </article>
            <article className="metric-card">
              <div className="metric-head"><span>SITE ELEVATION</span><MapPin size={15} /></div>
              <div className="metric-number">{terrainProfile ? Math.round(terrainProfile.site_elevation_m).toLocaleString() : "—"}<small> m</small></div>
              <div className="metric-caption"><span className="metric-state">{terrainProfile ? "LOLA 40M · PDS" : "LOLA POLAR DEM"}</span> · {terrainProfile ? "Relative to 1,737.4 km radius" : "−85° to −90° coverage"}</div>
              <div className="metric-spark spark-terrain" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            </article>
          </section>

          <section className="analysis-grid">
            <article className="panel analysis-panel" id="illumination">
              <div className="panel-heading analysis-heading">
                <div><p className="eyebrow">SOLAR GEOMETRY <span className="planned-tag">JPL DE441 ARCHIVE</span></p><h2>Sunlight analysis</h2></div>
                <button className="range-button" type="button" aria-label="Analysis period, one lunar day"><Clock3 size={13} /> 1 LUNAR DAY <ChevronDown size={12} /></button>
              </div>
              <div className="chart-area">
                <div className="chart-y-labels"><span>20°</span><span>10°</span><span>0°</span><span>−10°</span></div>
                <div className="chart">
                  <div className="chart-lines"><i /><i /><i /><i /></div>
                  {simulation && solarPlotPath ? (
                    <>
                      <svg className="solar-plot" viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label="Solar elevation from archived JPL Horizons ephemeris">
                        <defs><linearGradient id="solar-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#efc775" stopOpacity=".22" /><stop offset="1" stopColor="#efc775" stopOpacity="0" /></linearGradient></defs>
                        <line x1="0" x2="1000" y1="64.7" y2="64.7" className="solar-horizon" />
                        <path d={`${solarPlotPath} L1000,100 L0,100 Z`} fill="url(#solar-fill)" />
                        <path d={solarPlotPath} className="solar-line" />
                        {selectedSample && (
                          <circle
                            cx={simulation.samples.length < 2 ? 0 : (selectedSampleIndex / (simulation.samples.length - 1)) * 1000}
                            cy={90 - ((Math.max(-10, Math.min(20, selectedSample.sun_elevation_deg)) + 10) / 30) * 76}
                            r="8"
                            className="solar-cursor"
                          />
                        )}
                      </svg>
                      <div className="chart-live-label"><span /> ARCHIVED JPL HORIZONS · GEOMETRIC ELEVATION</div>
                    </>
                  ) : (
                    <div className="chart-overlay">
                      <span className="chart-icon">{simulationState === "loading" ? <RefreshCw size={17} className="spin" /> : <Sun size={17} />}</span>
                      <strong>{simulationState === "error" ? "Simulation unavailable" : simulationState === "loading" ? "Loading verified ephemeris" : "Run an archived site analysis"}</strong>
                      <span>{simulationState === "error" ? simulationError : "Sun and Earth positions use original JPL Horizons DE441 samples for the selected archived site and UTC time."}</span>
                      <small>LOLA terrain shadowing is not included</small>
                      {simulationState === "idle" && archiveReady && <button className="chart-run-button" type="button" onClick={() => void runSimulation()}><Play size={11} /> RUN 24-HOUR ANALYSIS</button>}
                    </div>
                  )}
                  <div className="chart-x-labels">{chartTimeLabels.map((time, index) => <span key={`${index}-${time}`}>{time}</span>)}</div>
                </div>
              </div>
              <div className="timeline">
                <div className="timeline-top"><span>EPHEMERIS TIME SCRUBBER</span><span className="time-readout"><button className={`timeline-play ${timePlaying ? "playing" : ""}`} type="button" onClick={() => setTimePlaying(!timePlaying)} aria-label={timePlaying ? "Pause time scrubber" : "Play time scrubber"} title={timePlaying ? "Pause timeline" : "Play timeline"} disabled={!simulation || simulation.samples.length < 2}>{timePlaying ? <Pause size={11} /> : <Play size={11} />}</button>{selectedSampleTime ? <><b>{selectedSampleTime} UTC</b><span>· Sun {selectedSample?.sun_elevation_deg.toFixed(2)}° · Earth {selectedSample?.earth_elevation_deg.toFixed(2)}°</span></> : <span>Run simulation to inspect calculated positions</span>}</span></div>
                <input className="ephemeris-slider" type="range" min="0" max={Math.max(0, (simulation?.samples.length ?? 1) - 1)} value={selectedSampleIndex} disabled={!simulation || simulation.samples.length < 2} onChange={(event) => {
                  setTimePlaying(false);
                  setSelectedSampleIndex(Number(event.target.value));
                }} aria-label="Select ephemeris sample time" />
                <div className="timeline-disclaimer">{simulation ? `${simulation.samples.length} hourly JPL samples · locations interpolated only between hourly horizon crossings.` : "No pre-filled sunlight results. Samples are loaded from the verified local JPL archive."}</div>
              </div>
            </article>

            <article className="panel earth-panel" id="communications">
              <div className="panel-heading">
                <div><p className="eyebrow">LINE OF SIGHT <span className="planned-tag">JPL DE441 ARCHIVE</span></p><h2>Earth visibility</h2></div>
                <span className="earth-icon"><Globe2 size={16} /></span>
              </div>
              <div className="earth-visual">
                <div className="earth-orbit"><span className="orbit-dot" /><span className="orbit-path" /><span className="earth-sphere"><i /></span><span className="site-horizon"><MapPin size={13} /></span></div>
                <div className="earth-reading"><span>EARTH ELEVATION</span><strong>{selectedSample ? selectedSample.earth_elevation_deg.toFixed(2) : "—"}<small>°</small></strong><span className={`reading-pending ${selectedSample?.earth_visible ? "is-visible" : ""}`}><span />{selectedSample ? selectedSample.earth_visible ? "GEOMETRICALLY VISIBLE" : "BELOW LOCAL HORIZON" : "AWAITING EPHEMERIS"}</span></div>
              </div>
              <div className="visibility-status"><div><span className={`status-square ${selectedSample?.earth_visible ? "is-visible" : ""}`} /><span>Geometric visibility</span></div><strong>{selectedSample ? selectedSample.earth_visible ? "VISIBLE" : "BELOW HORIZON" : "RUN SIMULATION"}</strong></div>
              <div className="visibility-status"><div><span className={`status-square ${terrainEarthStatus === "intercepted by local terrain" ? "blocked" : terrainEarthStatus === "clear along the sampled 10 km profile" ? "is-visible" : ""}`} /><span>Earth-ray terrain check</span></div><strong>{!selectedSample ? "RUN SIMULATION" : terrainEarthStatus === "below the geometric horizon" ? "BELOW GEOMETRIC HORIZON" : terrainEarthStatus === "intercepted by local terrain" ? "BLOCKED WITHIN 10 KM" : terrainEarthStatus === "clear along the sampled 10 km profile" ? "CLEAR ALONG 10 KM PROFILE" : earthTerrainState === "loading" ? "CHECKING LOLA PROFILE" : earthTerrainState === "error" ? "CHECK FAILED" : "WAITING FOR PROFILE"}</strong></div>
              {earthTerrainError && <p className="terrain-range" role="status">{earthTerrainError}</p>}
              <p className="terrain-range">The local ray check does not alter geometric visibility windows or establish a communications link.</p>
              <div className="windows-status"><span>GEOMETRIC VISIBILITY WINDOWS</span><strong>{simulation ? `${simulation.communication_windows.length} · ${simulation.earth_visible_hours.toFixed(1)} HRS` : "RUN SIMULATION"}</strong></div>
              {simulation && (
                <div className="communication-windows" aria-label="Calculated geometric Earth visibility periods">
                  {simulation.communication_windows.length > 0
                    ? simulation.communication_windows.slice(0, 3).map((window) => (
                      <div className="communication-window" key={`${window.start_utc}-${window.end_utc}`}>
                        <span><i /> {new Date(window.start_utc).toISOString().slice(11, 16)}–{new Date(window.end_utc).toISOString().slice(11, 16)} UTC</span>
                        <b>{window.duration_hours.toFixed(1)} h</b>
                      </div>
                    ))
                    : <div className="no-windows">Earth stays below the geometric horizon during this interval.</div>}
                </div>
              )}
              <div className="link-note"><Radio size={14} /><span><b>Visibility ≠ communication link.</b> Antenna, link budget, and relay analysis are separate.</span></div>
            </article>
          </section>

          <section className="engineering-grid">
            <article className="panel power-panel" id="power">
              <div className="panel-heading">
                <div><p className="eyebrow">MISSION ENGINEERING <span className="planned-tag">POWER MODEL</span></p><h2>Solar power simulator</h2></div>
                <BatteryCharging className="heading-icon" size={17} />
              </div>
              <div className="power-controls">
                <label className="slider-field">
                  <span className="slider-title">Panel area <b>{panelArea} <small>m²</small></b></span>
                  <input type="range" min="2" max="30" step="1" value={panelArea} onChange={(event) => setPanelArea(Number(event.target.value))} aria-label="Solar panel area in square meters" />
                  <span className="slider-limits"><small>2 m²</small><small>30 m²</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">Cell efficiency <b>{panelEfficiency}<small>%</small></b></span>
                  <input type="range" min="10" max="40" step="1" value={panelEfficiency} onChange={(event) => setPanelEfficiency(Number(event.target.value))} aria-label="Solar panel efficiency" />
                  <span className="slider-limits"><small>10%</small><small>40%</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">Panel tilt <b>{panelTilt}<small>°</small></b></span>
                  <input type="range" min="0" max="90" step="1" value={panelTilt} onChange={(event) => setPanelTilt(Number(event.target.value))} aria-label="Solar panel tilt angle in degrees" />
                  <span className="slider-limits"><small>0°</small><small>90°</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">Azimuth <b>{panelAzimuth}<small>°</small></b></span>
                  <input type="range" min="0" max="360" step="5" value={panelAzimuth} onChange={(event) => setPanelAzimuth(Number(event.target.value))} aria-label="Solar panel azimuth angle in degrees" />
                  <span className="slider-limits"><small>0°</small><small>360°</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">System losses <b>{systemLosses}<small>%</small></b></span>
                  <input type="range" min="0" max="30" step="1" value={systemLosses} onChange={(event) => setSystemLosses(Number(event.target.value))} aria-label="System losses percentage" />
                  <span className="slider-limits"><small>0%</small><small>30%</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">Battery capacity <b>{batteryCapacity} <small>kWh</small></b></span>
                  <input type="range" min="10" max="250" step="5" value={batteryCapacity} onChange={(event) => setBatteryCapacity(Number(event.target.value))} aria-label="Battery capacity in kilowatt hours" />
                  <span className="slider-limits"><small>10 kWh</small><small>250 kWh</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">Mission load <b>{missionLoad.toLocaleString()} <small>W</small></b></span>
                  <input type="range" min="0" max="5000" step="100" value={missionLoad} onChange={(event) => setMissionLoad(Number(event.target.value))} aria-label="Constant mission load in watts" />
                  <span className="slider-limits"><small>0 W</small><small>5 kW</small></span>
                </label>
                <label className="slider-field">
                  <span className="slider-title">Initial battery charge <b>{initialBatteryPercent}<small>%</small></b></span>
                  <input type="range" min="0" max="100" step="5" value={initialBatteryPercent} onChange={(event) => setInitialBatteryPercent(Number(event.target.value))} aria-label="Initial battery state of charge percent" />
                  <span className="slider-limits"><small>0%</small><small>100%</small></span>
                </label>
              </div>
              <div className="power-output">
                <div><span>NET PEAK AT 1 AU</span><strong>{nominalPower.toLocaleString()} <small>W</small></strong><small className="reference-note">Panel inputs · standard 1,361 W/m²</small></div>
                <div className="output-divider" />
                <div><span>{simulation ? "PREDICTED ARRAY ENERGY" : "ARRAY ENERGY"}</span><strong className={simulation ? "" : "output-na"}>{simulation ? simulation.predicted_panel_energy_wh.toLocaleString() : "—"} <small>Wh</small></strong><small className="reference-note">{simulation ? `Mission demand ${(simulation.mission_energy_demand_wh / 1000).toFixed(1)} kWh · ${simulation.sample_interval_minutes}-min data` : "Run an archived analysis to apply solar geometry"}</small></div>
              </div>
              <div className={`battery-summary ${simulation && simulation.unmet_load_wh > 0 ? "battery-warning" : ""}`}>
                <BatteryCharging size={14} />
                <span>{simulation ? `Battery ${simulation.minimum_battery_percent.toFixed(1)}% minimum → ${simulation.ending_battery_percent.toFixed(1)}% at end` : "Battery state of charge will update from the archived solar-generation and mission-load model."}</span>
                {simulation && simulation.unmet_load_wh > 0 && <strong>UNMET LOAD {simulation.unmet_load_wh.toLocaleString()} Wh</strong>}
              </div>
              <p className="power-disclaimer"><CircleHelp size={13} /> 90% battery efficiency, constant load, and 1 AU solar irradiance are explicit model assumptions.</p>
            </article>

            <article className="panel terrain-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">LRO LOLA POLAR DEM <span className="planned-tag">40 M / PIXEL</span></p><h2>Terrain profile</h2></div>
                <button className="icon-button small-icon" type="button" aria-label="Terrain data details" title="LOLA 85°S polar stereographic DEM, 40 m/pixel"><CircleHelp size={15} /></button>
              </div>
              <div className="terrain-chart">
                <div className="terrain-lines"><i /><i /><i /></div>
                {terrainPlot && (
                  <svg viewBox="0 0 420 104" preserveAspectRatio="none" role="img" aria-label={`Archived LOLA elevation profile along ${terrainProfile?.bearing_from_north_deg.toFixed(1)} degrees`}>
                    <path d={`${terrainPlot.path} L420,104 L0,104 Z`} fill="url(#lola-fill)" opacity=".18" />
                    <path d={terrainPlot.path} fill="none" stroke="#81d3b1" strokeWidth="2" />
                    <defs><linearGradient id="lola-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#80c5af" /><stop offset="1" stopColor="#80c5af" stopOpacity="0" /></linearGradient></defs>
                  </svg>
                )}
                {terrainState === "loading" && <div className="terrain-empty"><span><RefreshCw size={14} className="spin" /></span><b>Loading verified LOLA elevations</b><small>Reading the bundled original DEM tile</small></div>}
                {!terrainProfile && terrainState !== "loading" && <div className="terrain-empty"><span><Waves size={15} /></span><b>{terrainState === "error" ? "LOLA profile unavailable" : "Run a simulation to load terrain"}</b><small>{terrainError || "40 m/pixel archived polar DEM · 85°S to the south pole"}</small></div>}
                <div className="terrain-axis"><span>0 km</span><span>5 km</span><span>10 km</span></div>
              </div>
              <div className="terrain-footer"><span><span className={`data-dot ${terrainProfile ? "live-dot" : ""}`} /> {terrainProfile ? `LOLA · ${terrainProfile.product} · ${terrainProfile.samples.length} samples` : terrainState === "error" ? "LOLA archive load failed" : "LOLA polar archive ready"}</span><a href={terrainProfile?.source_url ?? "#data-notice"} target={terrainProfile ? "_blank" : undefined} rel={terrainProfile ? "noreferrer" : undefined}>{terrainProfile ? "PDS label" : "Data details"} <ExternalLink size={11} /></a></div>
              {terrainProfile && selectedSample && (
                <div className="terrain-visibility-status">
                  <span>Solar ray · {terrainProfile.distance_km.toFixed(0)} km azimuth profile · horizon {terrainProfile.terrain_horizon_elevation_deg.toFixed(2)}°</span>
                  <strong>{terrainSunStatus === "below the geometric horizon" ? "SUN BELOW GEOMETRIC HORIZON" : terrainSunStatus === "intercepted by local terrain" ? "LOCAL TERRAIN INTERCEPTS RAY" : "NO BLOCKAGE ON PROFILE"}</strong>
                </div>
              )}
              {terrainPlot && <p className="terrain-range">Profile relief relative to site: {terrainPlot.minimum.toFixed(1)} to {terrainPlot.maximum.toFixed(1)} m · elevation reference sphere 1,737.4 km.</p>}
            </article>
          </section>

          <section className="panel scenario-panel" id="comparison">
            <div className="panel-heading scenario-heading">
              <div><p className="eyebrow">WHAT-IF PLANNING</p><h2>Mission scenario comparison</h2></div>
              <div className="scenario-actions">
                {compareEnabled && <button className="run-comparison-button" type="button" onClick={() => void runComparison()} disabled={comparisonState === "loading" || !archiveReady}>{comparisonState === "loading" ? <RefreshCw size={12} className="spin" /> : <Activity size={12} />}{comparisonState === "loading" ? "LOADING ARCHIVE…" : "RUN ARCHIVED COMPARISON"}</button>}
                <button className={`compare-toggle ${compareEnabled ? "enabled" : ""}`} type="button" onClick={() => {
                  setCompareEnabled(!compareEnabled);
                  setComparisonError("");
                  setComparisonState("idle");
                }} aria-pressed={compareEnabled}><span className="toggle-track"><i /></span> {compareEnabled ? "SCENARIO B ADDED" : "ADD SCENARIO B"}</button>
              </div>
            </div>
            <div className={`scenario-columns ${compareEnabled ? "has-comparison" : ""}`}>
              <div className="scenario-card scenario-a">
                <div className="scenario-label"><span className="scenario-dot" /> SCENARIO A <span className="scenario-current">CURRENT INPUTS</span></div>
                <strong>{selectedSite.name}</strong>
                <div className="scenario-stats"><span>Array <b>{panelArea} m² · {panelEfficiency}% · {panelTilt}° / {panelAzimuth}° · {systemLosses}% loss</b></span><span>Battery <b>{batteryCapacity} kWh</b></span></div>
                <div className="scenario-result"><span>DAYLIGHT <b>{simulation ? `${simulation.geometric_sunlight_hours.toFixed(1)} h` : "—"}</b></span><span>ARRAY ENERGY <b>{simulation ? `${(simulation.predicted_panel_energy_wh / 1000).toFixed(2)} kWh` : "—"}</b></span><span>EARTH VISIBLE <b>{simulation ? `${simulation.earth_visible_hours.toFixed(1)} h` : "—"}</b></span></div>
              </div>
              {compareEnabled && (
                <div className="scenario-card scenario-b">
                  <div className="scenario-label"><span className="scenario-dot" /> SCENARIO B <span className="scenario-current">ALTERNATIVE INPUTS</span></div>
                  <label className="scenario-site-label" htmlFor="scenario-b-site">LANDING SITE</label>
                  <select className="scenario-select" id="scenario-b-site" value={scenarioBSiteId} onChange={(event) => setScenarioBSiteId(event.target.value)}>
                    {sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}
                  </select>
                  <div className="scenario-inputs">
                    <label>ARRAY AREA <span><input aria-label="Scenario B array area in square meters" type="number" min="1" max="100" value={scenarioBArea} onChange={(event) => setScenarioBArea(Number(event.target.value))} /> m²</span></label>
                    <label>CELL EFF. <span><input aria-label="Scenario B cell efficiency percent" type="number" min="1" max="100" value={scenarioBEfficiency} onChange={(event) => setScenarioBEfficiency(Number(event.target.value))} /> %</span></label>
                    <label>PANEL TILT <span><input aria-label="Scenario B panel tilt in degrees" type="number" min="0" max="90" value={scenarioBTilt} onChange={(event) => setScenarioBTilt(Number(event.target.value))} /> °</span></label>
                    <label>AZIMUTH <span><input aria-label="Scenario B panel azimuth in degrees" type="number" min="0" max="360" value={scenarioBAzimuth} onChange={(event) => setScenarioBAzimuth(Number(event.target.value))} /> °</span></label>
                    <label>SYSTEM LOSS <span><input aria-label="Scenario B system losses percent" type="number" min="0" max="100" value={scenarioBLosses} onChange={(event) => setScenarioBLosses(Number(event.target.value))} /> %</span></label>
                    <label>BATTERY <span><input aria-label="Scenario B battery capacity in kilowatt hours" type="number" min="1" max="1000" value={scenarioBBattery} onChange={(event) => setScenarioBBattery(Number(event.target.value))} /> kWh</span></label>
                  </div>
                  <strong className="scenario-site-name">{scenarioBSite.name}</strong>
                  <div className="scenario-result"><span>DAYLIGHT <b>{comparisonSimulation ? `${comparisonSimulation.geometric_sunlight_hours.toFixed(1)} h` : "—"}</b></span><span>ARRAY ENERGY <b>{comparisonSimulation ? `${(comparisonSimulation.predicted_panel_energy_wh / 1000).toFixed(2)} kWh` : "—"}</b></span><span>EARTH VISIBLE <b>{comparisonSimulation ? `${comparisonSimulation.earth_visible_hours.toFixed(1)} h` : "—"}</b></span></div>
                </div>
              )}
            </div>
            {comparisonError && <p className="simulation-error comparison-error" role="alert">{comparisonError}</p>}
            <div className="scenario-foot"><span>{energyDifferencePercent === null ? "Run both scenarios to compare archived JPL daylight, modeled panel energy, and Earth visibility." : `Scenario B panel energy ${energyDifferencePercent >= 0 ? "increased" : "decreased"} ${Math.abs(energyDifferencePercent).toFixed(1)}% vs A · terrain is not included.`}</span><span><ArrowUpRight size={13} /> {comparisonSimulation ? "JPL EPHEMERIS · ENGINEERING MODEL" : "VERIFIED ARCHIVE REQUIRED"}</span></div>
          </section>

          <section className="explain-row" id="data-notice">
            <div className="explain-icon"><CircleHelp size={17} /></div>
            <div>
              <strong>{simulation ? "Why this result looks this way" : "Explain this result"}</strong>
              <p>{simulation
                ? `For ${simulation.latitude_deg.toFixed(2)}° latitude, ${simulation.longitude_deg.toFixed(2)}° east, JPL geometry shows ${simulation.geometric_sunlight_hours.toFixed(1)} h of sunlight and ${simulation.earth_visible_hours.toFixed(1)} h of geometric Earth visibility in this window. Array energy uses hourly Sun angles and the stated 1 AU panel model. ${terrainSunStatus ? `The 40 m LOLA profile reports the current solar ray ${terrainSunStatus}; mission totals are not corrected for terrain.` : "A 10 km LOLA ray check is loading separately; mission totals are not corrected for terrain."} Communication link budgets are not included.`
                : "Run an archived analysis to see its JPL source, calculated geometry, engineering assumptions, and limitations."}</p>
            </div>
            <div className="explain-sources"><span><Database size={13} /> DATA SOURCES</span><b>{terrainProfile ? "JPL Horizons · LOLA · Mission inputs" : "JPL Horizons · Mission inputs"}</b></div>
            <div className="explain-sources"><span><Activity size={13} /> SCIENTIFIC STATUS</span><b className="not-validated"><span /> Not validated</b></div>
          </section>

          {archiveState.kind === "error" && (
            <div className="connection-notice" role="status">
              <span className="notice-icon"><Satellite size={15} /></span>
              <span><b>Local science archive unavailable.</b> {archiveState.message}</span>
              <button type="button" onClick={() => void checkArchive()}>Retry</button>
            </div>
          )}

          <footer className="page-footer">
            <span>LUNASIGHT <i /> LUNAR SOUTH POLE MISSION PLANNING</span>
            <span>* DISPLAY TIME LABEL IS A PLANNING INPUT; TIME SCALE NOT YET VALIDATED.</span>
            <span>ALL PREVIEW GRAPHICS ARE ILLUSTRATIVE, NOT SCIENTIFIC RESULTS.</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

export default App;
