document.addEventListener("DOMContentLoaded", function () {

  const SHEET_URL =
    "https://docs.google.com/spreadsheets/d/1DvPAuHNLp5BXGb0nnZDGNoiIwEeu2ogdXEIDvT4Hyfk/export?format=csv&gid=1484157943";
  
  const container = document.getElementById("flat-map-container");
  const slider = document.getElementById("timeSlider");
  const playBtn = document.getElementById("playPauseBtn");
  const yearLabel = document.getElementById("yearLabel");
  const ticks = document.getElementById("yearTicks");
  
  const statTotal = document.getElementById("stat-total");
  const statCountries = document.getElementById("stat-countries");
  const countriesListContainer = document.getElementById("affected-countries-list");
  const statYearLabel = document.getElementById("stat-year");
  
  let playing = true;
  let timer;
  
  let rawData = []; // Store raw data for historical/current tracking
  let countryEvents = {};
  let world, minDate, maxDate;
  let currentDate;
  
  // MAP
  const svg = d3.select("#flat-map-container")
    .append("svg")
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0);
  
  Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv(SHEET_URL)
  ]).then(([geo, data]) => {
  
    geo.features.forEach(feature => {
      if (feature.properties && feature.properties.name === "Russia") {
        feature.properties.name = "Russian Federation";
      }
    });
  
    world = geo;
    rawData = data;
  
    data.forEach(d => {
      d.start_date = new Date(d.start_date);
      d.end_date =
        d.end_date && d.end_date.trim() !== ""
          ? new Date(d.end_date)
          : null;
    });
  
    data.forEach(d => {
      if (!countryEvents[d.country]) countryEvents[d.country] = [];
      countryEvents[d.country].push({
        start: d.start_date,
        end: d.end_date
      });
    });
  
    // Calculate bounds on spreadsheet limits
    minDate = d3.min(data, d => d.start_date);
    maxDate = d3.max(data, d => d.end_date || d.start_date); 
  
    setupSlider();
    drawMap();
    start();
  });
  
  // SLIDER + TICKS 
  function setupSlider() {
    slider.min = 0;
    slider.max = 1000;
    slider.value = 0;
  
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
  
    ticks.innerHTML = "";
  
    for (let y = startYear; y <= endYear; y += 2) {
      const div = document.createElement("div");
      div.textContent = y;
      ticks.appendChild(div);
    }
  
    slider.addEventListener("input", () => {
      currentDate = new Date(
        minDate.getTime() +
        (slider.value / 1000) *
        (maxDate - minDate)
      );
      render(currentDate);
    });
  }
  
  // MAP 
  function drawMap() {
    const width = container.clientWidth;
    const height = 500;
  
    const projection = d3.geoNaturalEarth1()
      .fitSize([width, height], world);
  
    const path = d3.geoPath(projection);
  
    svg.attr("width", width).attr("height", height);
  
    svg.selectAll("path")
      .data(world.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("stroke", "#444")
      .attr("fill", "#fff");
  
    currentDate = new Date(minDate);
    render(currentDate);
  }
 // RENDER 
  function render(date) {
    
    let activeEventsCount = 0;
    let activeCountriesSet = new Set();
  
    // 1. Color Map
    svg.selectAll("path")
      .attr("fill", d => {
        const name = d.properties.name;
        const active = isActive(name, date);
        return active ? "#000" : "#fff";
      });
  
    // Scan data collection for items matching our current timestamp frame
    rawData.forEach(d => {
      const startsBeforeOrOn = date >= d.start_date;
      const endsAfterOrOn = !d.end_date || date <= d.end_date;
      
      if (startsBeforeOrOn && endsAfterOrOn) {
        activeEventsCount++;
        if (d.country) {
          activeCountriesSet.add(d.country);
        }
      }
    });
  
    // Convert active unique countries to an organized, sorted list array
    const sortedCountries = Array.from(activeCountriesSet).sort();
  
    // Print calculations instantly to UI elements
    if (statTotal) statTotal.textContent = activeEventsCount;
    if (statCountries) statCountries.textContent = sortedCountries.length;
    
    if (statYearLabel) {
      const yearStr = date.getFullYear();
      const monthStr = date.toLocaleDateString("en-US", { month: "long" });
      statYearLabel.textContent = `in ${yearStr} ${monthStr}`;
    }
  
    // 4. Inject the names of affected countries directly below the number
    const namesContainer = document.getElementById("affected-countries-names");
    if (namesContainer) {
      if (sortedCountries.length > 0) {
        namesContainer.innerHTML = `<strong>Active:</strong> ${sortedCountries.join(", ")}`;
      } else {
        namesContainer.innerHTML = `<span style="font-style: italic; color: #666;">No active shutdowns</span>`;
      }
    }
  
    // Format date to show "Year Month" 
    const year = date.getFullYear();
    const month = date.toLocaleDateString("en-US", { month: "long" });
  
    yearLabel.textContent = `${year} ${month}`;
  
    const progress = (date - minDate) / (maxDate - minDate);
    slider.value = progress * 1000;
  }
  
  // LOGIC
  function isActive(country, date) {
    const events = countryEvents[country] || [];
    return events.some(e => {
      if (!e.end) return date >= e.start;
      return date >= e.start && date <= e.end;
    });
  }
  
  // PLAY 
  function start() {
      if (timer) {
        clearInterval(timer);
      }
  
    timer = setInterval(() => {
      if (!playing) return; 
      currentDate = new Date(
        currentDate.getTime() + 7 * 86400000
      );
  
      if (currentDate > maxDate) {
        currentDate = new Date(minDate);
      }
  
      render(currentDate);
    }, 60);
  }
  
  // PLAY/PAUSE
  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "❚❚" : "▶";
  });
  
});