import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Database, Image as ImageIcon, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { fetchNasaImages } from "../services/scienceData";
import type { NasaImage, NasaImageSearchResponse } from "../types/scienceData";

type GalleryState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: NasaImageSearchResponse };

const quickSearches = [
  { label: "Lunar South Pole", query: "PIA13523" },
  { label: "LRO imagery", query: "LRO moon" },
  { label: "LOLA mission", query: "LOLA moon" },
];

function MediaCard({ item }: { item: NasaImage }) {
  const [imageUnavailable, setImageUnavailable] = useState(!item.thumbnail_url);
  const createdDate = item.date_created && !Number.isNaN(Date.parse(item.date_created))
    ? new Date(item.date_created).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    : null;

  return (
    <article className="nasa-media-card">
      <a className={`nasa-media-image ${imageUnavailable ? "image-unavailable" : ""}`} href={item.source_url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title} in the NASA image library`}>
        {imageUnavailable ? (
          <span className="media-image-fallback"><ImageIcon size={24} /><span>NASA preview unavailable</span></span>
        ) : (
          <img
            src={item.thumbnail_url ?? undefined}
            alt={item.title}
            loading="lazy"
            onError={() => setImageUnavailable(true)}
          />
        )}
        <span className="media-open"><ArrowUpRight size={15} /></span>
        <span className="media-source-tag">NASA ARCHIVE</span>
      </a>
      <div className="nasa-media-copy">
        <div className="media-meta">{createdDate ?? "DATE NOT PROVIDED"} <span /> {item.credit}</div>
        <h3>{item.title}</h3>
        <p>{item.description || "NASA image archive record. Open the source entry for full details and credits."}</p>
        <a className="media-source-link" href={item.source_url} target="_blank" rel="noreferrer">View NASA record <ArrowUpRight size={13} /></a>
      </div>
    </article>
  );
}

export default function NasaMediaGallery() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("PIA13523");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [state, setState] = useState<GalleryState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ kind: "loading" });

    fetchNasaImages(submittedQuery, controller.signal)
      .then((data) => {
        if (active) setState({ kind: "ready", data });
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "NASA image search failed.",
          });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [submittedQuery, refreshVersion]);

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setSubmittedQuery(nextQuery);
    setRefreshVersion((version) => version + 1);
  }

  function chooseSearch(term: string) {
    setQuery(term);
    setSubmittedQuery(term);
    setRefreshVersion((version) => version + 1);
  }

  return (
    <section className="nasa-gallery" id="nasa-data" aria-labelledby="nasa-gallery-title">
      <div className="nasa-gallery-header">
        <div className="nasa-gallery-heading">
          <div className="nasa-gallery-icon"><Database size={17} /></div>
          <div>
            <p className="eyebrow"><span className="nasa-live-dot" /> NASA OPEN DATA</p>
            <h2 id="nasa-gallery-title">From the lunar image archive</h2>
            <p className="nasa-gallery-intro">Search mission imagery and open the original NASA record, with its source credit and description.</p>
          </div>
        </div>
        <div className="nasa-api-status"><span className={state.kind === "ready" ? "connected" : state.kind === "error" ? "disconnected" : ""} />{state.kind === "loading" ? "CONNECTING TO NASA" : state.kind === "error" ? "SOURCE UNAVAILABLE" : "NASA ARCHIVE CONNECTED"}</div>
      </div>

      <div className="nasa-search-row">
        <form className="nasa-search-form" onSubmit={runSearch}>
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Moon, LRO, polar terrain…"
            aria-label="Search NASA lunar imagery"
            minLength={2}
            maxLength={120}
            required
          />
          <button type="submit" disabled={state.kind === "loading"}><Search size={14} /><span>Search NASA</span></button>
        </form>
        <button className="nasa-refresh" type="button" onClick={() => setRefreshVersion((version) => version + 1)} aria-label="Refresh NASA imagery" title="Refresh NASA imagery" disabled={state.kind === "loading"}>
          <RefreshCw size={15} className={state.kind === "loading" ? "spin" : ""} />
        </button>
      </div>

      <div className="nasa-quick-searches" aria-label="Suggested NASA searches">
        <span>TRY</span>
        {quickSearches.map((term) => (
          <button type="button" key={term.query} className={submittedQuery === term.query ? "selected" : ""} onClick={() => chooseSearch(term.query)}>{term.label}</button>
        ))}
      </div>

      <div className="nasa-results" aria-live="polite">
        {state.kind === "loading" && (
          <div className="nasa-state">
            <LoaderCircle size={23} className="spin" />
            <strong>Searching NASA’s image archive</strong>
            <span>Retrieving mission imagery and source details…</span>
          </div>
        )}
        {state.kind === "error" && (
          <div className="nasa-state nasa-error">
            <Database size={22} />
            <strong>NASA imagery could not be loaded</strong>
            <span>{state.message} Check the connection to NASA and try again.</span>
            <button type="button" onClick={() => setRefreshVersion((version) => version + 1)}>Retry search</button>
          </div>
        )}
        {state.kind === "ready" && state.data.items.length === 0 && (
          <div className="nasa-state">
            <ImageIcon size={22} />
            <strong>No images matched “{state.data.query}”</strong>
            <span>Try a broader mission or Moon-related search.</span>
          </div>
        )}
        {state.kind === "ready" && state.data.items.length > 0 && (
          <>
            <div className="nasa-result-caption"><span>{state.data.total_results.toLocaleString()} ARCHIVE RESULTS</span><span>SHOWING {state.data.items.length} · {state.data.source}</span></div>
            <div className={`nasa-media-grid ${state.data.items.length === 1 ? "single-result" : ""}`}>
              {state.data.items.map((item) => <MediaCard item={item} key={item.nasa_id} />)}
            </div>
          </>
        )}
      </div>

      <div className="nasa-science-note">
        <span className="science-note-icon"><ImageIcon size={14} /></span>
        <span><strong>Media, not a terrain layer.</strong> NASA archive images are not georeferenced here and do not provide LOLA elevations, SPICE geometry, or landing-site measurements.</span>
        <a href="https://images.nasa.gov/" target="_blank" rel="noreferrer">NASA Images <ArrowUpRight size={12} /></a>
      </div>
    </section>
  );
}
