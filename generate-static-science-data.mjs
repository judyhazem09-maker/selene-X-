import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "frontend", "public", "science");
const horizonsUrl = "https://ssd.jpl.nasa.gov/api/horizons.api";
const lolaUrl = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/float_img/ldem_85s_40m_float.img";
const lolaLabelUrl = lolaUrl.replace(/\.img$/, ".lbl");
const startUtc = "2026-01-01T00:00:00.000Z";
const dataEndUtc = "2031-01-03T00:00:00.000Z";
const sampleIntervalMs = 60 * 60 * 1000;
const referenceRadiusM = 1_737_400;
const mapScaleM = 40;
const imageSide = 7_584;
const recordBytes = imageSide * 4;
const imageCenter = (imageSide - 1) / 2;
const tileMarginPixels = 300;
const sites = [
  { id: "shackleton", name: "Shackleton Rim", latitudeDeg: -89.9, longitudeDeg: 0 },
  { id: "malapert", name: "Malapert Massif", latitudeDeg: -85.99, longitudeDeg: 0 },
  { id: "connecting", name: "Connecting Ridge", latitudeDeg: -89.5, longitudeDeg: 222 },
];
const monthNumbers = new Map([
  ["Jan", 0], ["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4], ["Jun", 5],
  ["Jul", 6], ["Aug", 7], ["Sep", 8], ["Oct", 9], ["Nov", 10], ["Dec", 11],
]);
const dataRows = (Date.parse(dataEndUtc) - Date.parse(startUtc)) / sampleIntervalMs + 1;
const imageBytes = imageSide * imageSide * 4;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function pythonRound(value) {
  const lower = Math.floor(value);
  const fraction = value - lower;
  if (Math.abs(fraction - 0.5) < 1e-10) return lower % 2 === 0 ? lower : lower + 1;
  return Math.round(value);
}

function csvFields(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseUtcTimestamp(value) {
  const match = /^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  assert(match, `Unexpected JPL UTC timestamp: ${value}`);
  const month = monthNumbers.get(match[2]);
  assert(month !== undefined, `Unexpected JPL month: ${match[2]}`);
  return Date.UTC(Number(match[1]), month, Number(match[3]), Number(match[4]), Number(match[5]));
}

function parseEphemeris(payload, target, site) {
  assert(payload && typeof payload.result === "string", `JPL returned no result for ${site.id}/${target}.`);
  assert(!payload.error, `JPL error for ${site.id}/${target}: ${payload.error}`);
  const source = /\{source:\s*([^}]+)\}/.exec(payload.result)?.[1]?.trim();
  assert(source === "DE441", `Expected JPL DE441 data, received ${source ?? "an unknown source"}.`);
  const section = /\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/.exec(payload.result);
  assert(section, `JPL returned no ephemeris table for ${site.id}/${target}.`);
  const observations = section[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = csvFields(line);
      assert(fields.length >= 5, `Malformed JPL ephemeris row for ${site.id}/${target}.`);
      const timestamp = parseUtcTimestamp(fields[0]);
      const azimuth = Number(fields[3]);
      const elevation = Number(fields[4]);
      assert(Number.isFinite(azimuth) && Number.isFinite(elevation), `Invalid JPL angles for ${site.id}/${target}.`);
      return { timestamp, azimuth, elevation };
    });

  assert(observations.length === dataRows, `Expected ${dataRows} hourly JPL rows for ${site.id}/${target}; received ${observations.length}.`);
  observations.forEach((observation, index) => {
    assert(
      observation.timestamp === Date.parse(startUtc) + index * sampleIntervalMs,
      `JPL returned a missing or unordered hourly row for ${site.id}/${target} at index ${index}.`,
    );
  });
  return { source, observations };
}

async function fetchEphemeris(site, target) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: target,
    OBJ_DATA: "NO",
    MAKE_EPHEM: "YES",
    EPHEM_TYPE: "OBSERVER",
    CENTER: "coord@301",
    COORD_TYPE: "GEODETIC",
    SITE_COORD: `${(((site.longitudeDeg + 180) % 360) + 360) % 360 - 180},${site.latitudeDeg},0`,
    START_TIME: "2026-Jan-01 00:00",
    STOP_TIME: "2031-Jan-03 00:00",
    STEP_SIZE: "1 h",
    QUANTITIES: "4",
    CSV_FORMAT: "YES",
    APPARENT: "AIRLESS",
    ANG_FORMAT: "DEG",
    TIME_DIGITS: "MINUTES",
    TIME_TYPE: "UT",
  });
  const response = await fetch(`${horizonsUrl}?${params}`, { signal: AbortSignal.timeout(120_000) });
  assert(response.ok, `JPL returned HTTP ${response.status} for ${site.id}/${target}.`);
  return parseEphemeris(await response.json(), target, site);
}

async function generateEphemeris(site) {
  process.stdout.write(`Downloading JPL Horizons DE441 ephemerides for ${site.name}... `);
  const sun = await fetchEphemeris(site, "10");
  await new Promise((resolve) => setTimeout(resolve, 750));
  const earth = await fetchEphemeris(site, "399");
  assert(sun.source === earth.source, `JPL source mismatch for ${site.id}.`);

  const buffer = Buffer.allocUnsafe(dataRows * 16);
  for (let index = 0; index < dataRows; index += 1) {
    const offset = index * 16;
    const values = [
      sun.observations[index].azimuth,
      sun.observations[index].elevation,
      earth.observations[index].azimuth,
      earth.observations[index].elevation,
    ];
    values.forEach((value, valueIndex) => {
      const microdegrees = Math.round(value * 1_000_000);
      assert(Number.isSafeInteger(microdegrees), `JPL value exceeds archive precision at ${site.id}/${index}.`);
      buffer.writeInt32LE(microdegrees, offset + valueIndex * 4);
    });
  }

  const file = `ephemeris/${site.id}.bin`;
  const fullPath = path.join(outputDirectory, file);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  process.stdout.write(`${dataRows} hourly rows, ${buffer.length} bytes.\n`);
  return {
    file,
    rows: dataRows,
    format: "int32-le-microdegrees",
    columns: ["sun_azimuth_deg", "sun_elevation_deg", "earth_azimuth_deg", "earth_elevation_deg"],
    sha256: sha256(buffer),
    source: "NASA/JPL Horizons API",
    ephemeris: sun.source,
    sourceUrl: horizonsUrl,
    query: {
      center: "coord@301",
      coordinateType: "geodetic",
      longitudeEastDeg: (((site.longitudeDeg + 180) % 360) + 360) % 360 - 180,
      latitudeDeg: site.latitudeDeg,
      startUtc,
      endUtc: dataEndUtc,
      interval: "1 h",
      targets: { sun: "10", earth: "399" },
    },
  };
}

function destinationPoint(latitudeDeg, longitudeDeg, bearingDeg, distanceKm) {
  const angularDistance = distanceKm * 1000 / referenceRadiusM;
  const latitude = latitudeDeg * Math.PI / 180;
  const longitude = longitudeDeg * Math.PI / 180;
  const bearing = bearingDeg * Math.PI / 180;
  const targetLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const targetLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
  );
  return [targetLatitude * 180 / Math.PI, (targetLongitude * 180 / Math.PI + 360) % 360];
}

function projectToPixel(latitudeDeg, longitudeDeg) {
  const colatitude = (90 + latitudeDeg) * Math.PI / 180;
  const longitude = longitudeDeg * Math.PI / 180;
  const radiusM = 2 * referenceRadiusM * Math.tan(colatitude / 2);
  const column = pythonRound(imageCenter + radiusM * Math.sin(longitude) / mapScaleM);
  const row = pythonRound(imageCenter - radiusM * Math.cos(longitude) / mapScaleM);
  assert(row >= 0 && row < imageSide && column >= 0 && column < imageSide, "Landing-site tile is outside the LOLA DEM.");
  return { row, column };
}

async function generateLolaTile(site) {
  const center = projectToPixel(site.latitudeDeg, site.longitudeDeg);
  const firstRow = center.row - tileMarginPixels;
  const lastRow = center.row + tileMarginPixels;
  const firstColumn = center.column - tileMarginPixels;
  const lastColumn = center.column + tileMarginPixels;
  assert(firstRow >= 0 && firstColumn >= 0 && lastRow < imageSide && lastColumn < imageSide, `LOLA tile exceeds DEM bounds at ${site.id}.`);

  const rangeStart = firstRow * recordBytes + firstColumn * 4;
  const rangeEnd = lastRow * recordBytes + lastColumn * 4 + 3;
  process.stdout.write(`Downloading NASA PDS LOLA tile for ${site.name}... `);
  const response = await fetch(lolaUrl, {
    headers: { Range: `bytes=${rangeStart}-${rangeEnd}` },
    signal: AbortSignal.timeout(120_000),
  });
  assert(response.status === 206, `NASA PDS did not honor the LOLA byte range for ${site.id} (HTTP ${response.status}).`);
  assert(
    response.headers.get("content-range") === `bytes ${rangeStart}-${rangeEnd}/${imageBytes}`,
    `NASA PDS returned an unexpected LOLA byte range for ${site.id}.`,
  );

  const source = Buffer.from(await response.arrayBuffer());
  assert(source.length === rangeEnd - rangeStart + 1, `NASA PDS returned a truncated LOLA tile for ${site.id}.`);
  const width = lastColumn - firstColumn + 1;
  const height = lastRow - firstRow + 1;
  const rowWidthBytes = width * 4;
  const compact = Buffer.allocUnsafe(height * rowWidthBytes);
  for (let row = 0; row < height; row += 1) {
    const sourceOffset = row * recordBytes;
    source.copy(compact, row * rowWidthBytes, sourceOffset, sourceOffset + rowWidthBytes);
  }

  const file = `lola/${site.id}.bin`;
  const fullPath = path.join(outputDirectory, file);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, compact);
  process.stdout.write(`${width}x${height} original 40 m DEM pixels, ${compact.length} bytes.\n`);
  return {
    file,
    width,
    height,
    firstRow,
    firstColumn,
    format: "float32-le-kilometers",
    source: "NASA PDS Geosciences Node · LRO LOLA",
    product: "LDEM_85S_40M_FLOAT",
    sourceUrl: lolaLabelUrl,
    imageUrl: lolaUrl,
    resolutionM: mapScaleM,
    referenceRadiusM,
    tileMarginM: tileMarginPixels * mapScaleM,
    sha256: sha256(compact),
  };
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const archiveSites = [];
  for (const site of sites) {
    const ephemeris = await generateEphemeris(site);
    await new Promise((resolve) => setTimeout(resolve, 750));
    const terrain = await generateLolaTile(site);
    archiveSites.push({
      ...site,
      longitudeEastDeg: (site.longitudeDeg % 360 + 360) % 360,
      ephemeris,
      terrain,
    });
  }

  const manifest = {
    formatVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    archiveStartUtc: startUtc,
    latestSupportedStartUtc: "2030-12-31T23:00:00.000Z",
    ephemerisEndUtc: dataEndUtc,
    sampleIntervalMinutes: 60,
    dataStatus: "verified-archived",
    sourceDescription: "Original NASA/JPL Horizons DE441 observer ephemerides and original NASA PDS LRO LOLA 40 m DEM samples. Scientific outputs are unavailable outside these archived sites and dates.",
    imageSide,
    recordBytes,
    imageBytes,
    sites: archiveSites,
  };
  await writeFile(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Wrote verified science archive manifest with ${archiveSites.length} sites.`);
}

main().catch((error) => {
  console.error("Science archive generation failed:", error);
  process.exitCode = 1;
});
