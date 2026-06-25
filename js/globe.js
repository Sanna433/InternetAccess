/* ══════════════════════════════════
   COLOUR HELPER  (matches legend tiers)
══════════════════════════════════ */
function colorForVal(v) {
  if (v == null || Number.isNaN(+v)) return '#B5B5B5';
  const n = +v;
  if (n >= 90) return '#2124FC';
  if (n >= 80) return '#0F7FFF';
  if (n >= 60) return '#5BBCEB';
  if (n >= 40) return '#B3E3FA';
  return '#B5B5B5';
}

/* ══════════════════════════════════
   GLOBE GL INITIALISATION
   Uses local GeoJSON with real Access_70 data.
══════════════════════════════════ */
let globeInstance = null;
let loadedFeatures = [];
let countryDataMap = {};
// Controls whether polygon hover interactions are active.
let polygonHoverEnabled = true;
// Hold timeout id so repeated clicks reset the 2s timer.
let hoverEnableTimeoutId = null;

async function loadExternalData() {
  const response = await fetch('data/popup_data.json');
  const data = await response.json();
  data.forEach(item => {
    countryDataMap[item.ISO] = item;
  });
}

async function initGlobe() {
  if (globeInstance) return;
  await loadExternalData();

  fetch('data/ne_110m_admin_0_countries3.geojson')
    .then(res => res.json())
    .then(countries => {
      loadedFeatures = countries.features.filter(d => d.properties.SOVEREIGNT !== 'AQ');

      globeInstance = new Globe(document.getElementById('globe-container'))
        .globeImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
        .backgroundImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
        .lineHoverPrecision(0)
        .polygonsData(loadedFeatures)
        .polygonAltitude(0.06)
        .polygonCapColor(feat => colorForVal(feat.properties.Access_70))
        .polygonSideColor(() => '#333333')
        .polygonStrokeColor(() => 'rgba(255,255,255,0.06)')
        .polygonLabel(({ properties: d }) => `
          <div style="background:rgba(15,25,41,.9);padding:8px 12px;border-radius:8px;font-family:sans-serif;font-size:13px;color:#fff">
            <b>${d.SOVEREIGNT}</b><br/>
            <span style="color:#5BBCEB">Internet access: ${d.Access_70 != null ? d.Access_70 + '%' : 'No data'}</span>
          </div>
        `)
        .onPolygonHover(hoverD => {
          // Respect the global hover-enabled flag. If disabled, do nothing.
          if (!polygonHoverEnabled) return;

          globeInstance
            .polygonAltitude(d => d === hoverD ? 0.08 : 0.06)
            .polygonCapColor(d => d === hoverD ? '#E7F20F' : colorForVal(d.properties.Access_70));
        })
        .polygonsTransitionDuration(300)
        .onPolygonClick(feat => {
          const { lat, lng } = featureCentroid(feat);
          // Disable hover temporarily to avoid hover interfering with the random focus animation.
          polygonHoverEnabled = false;
          if (hoverEnableTimeoutId) clearTimeout(hoverEnableTimeoutId);
          hoverEnableTimeoutId = setTimeout(() => {
            polygonHoverEnabled = true;
            hoverEnableTimeoutId = null;
          }, 1000);
          globeInstance
            .pointOfView({ lat, lng, altitude: 1.5 }, 1000)
            .polygonAltitude(d => d === feat ? 0.20 : 0.06)
            .polygonCapColor(d => d === feat ? '#E7F20F' : colorForVal(d.properties.Access_70))
            .polygonStrokeColor(d => d === feat ? '#E7F20F' : 'rgba(255,255,255,0.06)')
 
          const iso = feat.properties.ADM0_A3;
          const extra = countryDataMap[iso];

          // LOG EVERYTHING TO CONSOLE
          console.log("--- Click Debug ---");
          console.log("Clicked Country:", feat.properties.SOVEREIGNT);
          console.log("ISO Key Used:", iso);
          console.log("Data Found in Map:", extra);

          openPopup({
            name: feat.properties.SOVEREIGNT,
            internetAccessPct: feat.properties.Access_70 ?? null,
            extra: extra
          });
        });

      globeInstance.controls().autoRotate      = true;
      globeInstance.controls().autoRotateSpeed = 0.2;
    })
    .catch(err => console.error('Globe GeoJSON load failed:', err));
}

document.addEventListener('DOMContentLoaded', initGlobe);

/* ══════════════════════════════════
   COUNTRY POPUP
══════════════════════════════════ */
async function openPopup(countryProps) {
  const container = document.getElementById('country-popup');
  const overlay = document.getElementById('popup-overlay');
  const overlayText = document.getElementById('overlay-text');

  container.style.display = 'block';

  const pct = countryProps.internetAccessPct ?? 0;
  if (pct < 50 && overlay) {
    overlay.style.display = 'flex';
    overlayText.textContent = `Low internet access (${pct}%) detected. Please wait.`;
    await new Promise(resolve => setTimeout(resolve, 5000));
    overlay.style.display = 'none';
  } else if (overlay) {
    overlay.style.display = 'none';
  }

  document.getElementById('popup-country-name').textContent = countryProps.name || '—';
  document.getElementById('access-pct').textContent = pct + '%';
  document.getElementById('access-bar').style.width = pct + '%';

  if (countryProps.extra) {
    document.getElementById('stat-pop').textContent = countryProps.extra.population;
    document.getElementById('stat-shutdowns').textContent = countryProps.extra.shutdowns_per_year;
    
    const riskEl = document.getElementById('stat-risk');
    const riskDot = document.getElementById('risk-dot');
    const riskVal = countryProps.extra.shutdown_risk.toLowerCase();
    
    riskEl.textContent = countryProps.extra.shutdown_risk;
    riskDot.className = 'risk-dot';

    if (riskVal.includes('low')) {
            riskDot.classList.add('risk-low');
        } else if (riskVal.includes('moderate')) {
            riskDot.classList.add('risk-moderate');
        } else if (riskVal.includes('high') || riskVal.includes('severe')) {
            riskDot.classList.add('risk-high');
        }
    
    document.getElementById('stat-gini').textContent = countryProps.extra.gini_index;
    document.getElementById('stat-mpi').textContent = countryProps.extra.mpi;
    document.getElementById('stat-hdi').textContent = countryProps.extra.hdi;
  } else {
    // Handle case where extra data is missing
    const elements = ['stat-pop', 'stat-shutdowns', 'stat-risk', 'stat-gini', 'stat-mpi', 'stat-hdi'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'N/A';
    });
  }
}

window.closePopup = function () {
  document.getElementById('country-popup').style.display = 'none';
};

/* ══════════════════════════════════
   RANDOM COUNTRY
   Picks a random country from all loaded features.
══════════════════════════════════ */
function featureCentroid(feat) {
  const geom = feat.geometry;
  if (!geom) return { lat: 0, lng: 0 };
  // Flatten all coordinate rings to [lng, lat] pairs
  const rings = geom.type === 'Polygon'
    ? [geom.coordinates[0]]
    : geom.coordinates.map(poly => poly[0]);  // MultiPolygon: outer ring of each part
  const pts = rings.flat();
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lat, lng };
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('country-popup').style.display = 'none';
  document.getElementById('btn-random').addEventListener('click', () => {
    if (!loadedFeatures.length) return;
    // Disable hover temporarily to avoid hover interfering with the random focus animation.
    polygonHoverEnabled = false;
    if (hoverEnableTimeoutId) clearTimeout(hoverEnableTimeoutId);
    hoverEnableTimeoutId = setTimeout(() => {
      polygonHoverEnabled = true;
      hoverEnableTimeoutId = null;
    }, 1000);
    const feat = loadedFeatures[Math.floor(Math.random() * loadedFeatures.length)];
    const iso = feat.properties.ADM0_A3;

    // if (globeInstance) {
    //   const { lat, lng } = featureCentroid(feat);
    //   globeInstance.pointOfView({ lat, lng, altitude: 2 }, 1000);
    // }

    const { lat, lng } = featureCentroid(feat);
          globeInstance
            .pointOfView({ lat, lng, altitude: 1.5 }, 1000)
            .polygonAltitude(d => d === feat ? 0.20 : 0.06)
            .polygonCapColor(d => d === feat ? '#E7F20F' : colorForVal(d.properties.Access_70))
            .polygonStrokeColor(d => d === feat ? '#E7F20F' : 'rgba(255,255,255,0.06)')
 

    openPopup({
      name:              feat.properties.SOVEREIGNT,
      internetAccessPct: feat.properties.Access_70 ?? null,
      extra: countryDataMap[iso]
    });
  });


// Stop / Play controls
const btnStop = document.getElementById('btn-stop');
const btnPlay = document.getElementById('btn-play');


if (btnStop) {
  btnStop.addEventListener('click', () => {
    if (globeInstance && globeInstance.controls) {
      globeInstance.controls().autoRotate = false;
    }
    btnStop.classList.add('active');
    btnPlay.classList.remove('active');
  });
}


if (btnPlay) {
  btnPlay.addEventListener('click', () => {
    if (globeInstance && globeInstance.controls) {
      globeInstance.controls().autoRotate = true;
      globeInstance.controls().autoRotateSpeed = 0.2;
    }
    btnPlay.classList.add('active');
    btnStop.classList.remove('active');
  });
}
});
