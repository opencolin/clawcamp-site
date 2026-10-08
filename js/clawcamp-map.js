/**
 * ClawCamp Leaflet Map Module
 * Shared interactive map for homepage hero and events page.
 * Note: innerHTML usage below is safe — all values are derived from
 * internal cityCoords/event data, not user input.
 */

/* ── City coordinates ── */
var cityCoords = {
  'oakland': [37.8044, -122.2712],
  'san-francisco': [37.7749, -122.4194],
  'ho-chi-minh-city': [10.8231, 106.6297],
  'austin': [30.2672, -97.7431],
  'bentonville': [36.3729, -94.2088],
  'seattle': [47.6062, -122.3321],
  'singapore': [1.3521, 103.8198],
  'tokyo': [35.6762, 139.6503],
  'bucharest': [44.4268, 26.1025],
  'istanbul': [41.0082, 28.9784],
  'ghent': [51.0543, 3.7174],
  'toulouse': [43.6047, 1.4442],
  'new-york': [40.7128, -74.0060],
  'berlin': [52.5200, 13.4050],
  'victoria': [48.4284, -123.3656],
  'raleigh': [35.7796, -78.6382],
  'kitchener': [43.4516, -80.4925],
  'boulder': [40.0150, -105.2705],
  'amsterdam': [52.3676, 4.9041],
  'toronto': [43.6532, -79.3832],
  'vancouver': [49.2827, -123.1207],
  'chiang-mai': [18.7883, 98.9853],
  'oslo': [59.9139, 10.7522],
  'bangalore': [12.9716, 77.5946],
  'bengaluru': [12.9716, 77.5946],
  'london': [51.5074, -0.1278],
  'los-angeles': [34.0522, -118.2437],
  'valencia': [39.4699, -0.3763],
  'ann-arbor': [42.2808, -83.7430],
  'sao-paulo': [-23.5505, -46.6333],
  'guadalajara': [20.6597, -103.3496],
  'rio-de-janeiro': [-22.9068, -43.1729],
  'copenhagen': [55.6761, 12.5683],
  'chicago': [41.8781, -87.6298],
  'ankara': [39.9334, 32.8597],
  'belo-horizonte': [-19.9167, -43.9345],
  'boston': [42.3601, -71.0589],
  'philadelphia': [39.9526, -75.1652],
  'seoul': [37.5665, 126.9780],
  'mexico-city': [19.4326, -99.1332],
  'bogota': [4.7110, -74.0721],
  'porto-alegre': [-30.0346, -51.2177],
  'shanghai': [31.2304, 121.4737],
  'buenos-aires': [-34.6037, -58.3816],
  'paris': [48.8566, 2.3522],
  'stockholm': [59.3293, 18.0686],
  'melbourne': [-37.8136, 144.9631],
  'dallas': [32.7767, -96.7970],
  'atlanta': [33.7490, -84.3880],
  'houston': [29.7604, -95.3698],
  'portland': [45.5152, -122.6784],
  'san-diego': [32.7157, -117.1611],
  'auckland': [-36.8485, 174.7633],
  'waterloo': [43.4643, -80.5204],
  'helsinki': [60.1699, 24.9384],
  'stamford': [41.0534, -73.5387],
  'peoria': [40.6936, -89.5890],
  'virginia-beach': [36.8529, -75.9780],
  'hartford': [41.7658, -72.6734],
  'wellington': [-41.2865, 174.7762],
  'dunedin': [-45.8788, 170.5028],
  'christchurch': [-43.5321, 172.6362],
  'goteborg': [57.7089, 11.9746],
  'toledo': [41.6528, -83.5379],
  'mountain-view': [37.3861, -122.0839],
  'barbados': [13.1939, -59.5432],
  'ahmedabad': [23.0098, 72.5244],
  'arequipa': [-16.4116, -71.5234],
  'arlington': [32.7512, -97.0829],
  'atherton': [37.4575, -122.1978],
  'aventura': [25.9557, -80.1418],
  'bayan-lepas': [5.324, 100.2822],
  'beijing': [39.9042, 116.4074],
  'berkeley': [37.8815, -122.2467],
  'brest': [48.3894, -4.4979],
  'brisbane-city': [-27.4699, 153.0222],
  'bruxelles': [50.845, 4.355],
  'bucuresti': [44.4278, 26.0546],
  'bunkyo-city': [35.709, 139.7601],
  'c1426bmi': [-34.5647, -58.4459],
  'cagayan-de-oro-city': [8.4798, 124.6526],
  'cambridge': [42.3597, -71.08],
  'canberra': [-35.2766, 149.1302],
  'cankaya': [39.8832, 32.8065],
  'cannes': [43.5524, 7.0132],
  'charleston': [32.7914, -79.9398],
  'chengdu': [30.5723, 104.0665],
  'chennai': [12.9909, 80.2431],
  'chiyoda-city': [35.6868, 139.7681],
  'ciudad-de-mexico': [19.3846, -99.1833],
  'cluj-napoca': [46.775, 23.587],
  'cu': [10.7653, 106.6866],
  'cyberjaya': [2.9263, 101.6425],
  'daan-district': [25.0292, 121.5418],
  'denver': [39.7475, -104.9899],
  'detroit': [42.3329, -83.0752],
  'dubai': [25.2263, 55.289],
  'dublin-1': [53.3493, -6.2476],
  'dublin-8': [53.3426, -6.2775],
  'durango': [23.9776, -104.6692],
  'durham': [35.8972, -78.8605],
  'dusseldorf': [51.2158, 6.7517],
  'ecublens': [46.5381, 6.5766],
  'florianopolis': [-27.541, -48.5026],
  'fort-lauderdale': [26.1207, -80.1356],
  'fort-worth': [32.7382, -97.3255],
  'frankfurt-am-main': [50.1391, 8.6787],
  'gelang-patah': [1.3412, 103.59],
  'gent': [51.0534, 3.7211],
  'guangzhou': [22.7992, 113.5667],
  'hai-chau': [16.0672, 108.224],
  'hamburg': [53.5547, 9.989],
  'hang-zhou-shi': [30.2488, 120.2131],
  'indore': [22.7653, 75.8997],
  'ji-nan-shi': [36.6799, 116.909],
  'kabupaten-badung': [-8.8204, 115.1506],
  'kbenhavn': [55.652, 12.5444],
  'kensington': [-33.9164, 151.2285],
  'kings-county': [40.7144, -73.9672],
  'kota-jakarta-selatan': [-6.226, 106.8048],
  'lansing': [42.7603, -84.5201],
  'las-vegas': [36.1271, -115.1648],
  'leipzig': [51.3321, 12.3735],
  'linz': [48.3373, 14.3164],
  'ljubljana': [46.047, 14.4609],
  'loule': [37.143, -8.0244],
  'madrid': [40.4382, -3.6803],
  'magdalena-del-mar': [-12.0922, -77.0585],
  'makati-city': [14.5462, 121.0164],
  'mandaue': [10.342, 123.9212],
  'menlo-park': [37.4851, -122.1762],
  'minato-city': [35.6382, 139.728],
  'minneapolis': [44.9722, -93.286],
  'montevideo': [-34.928, -56.1573],
  'montreal': [45.5293, -73.6139],
  'muang': [18.7793, 98.9958],
  'munchen': [48.1307, 11.6204],
  'newport-beach': [33.6133, -117.9286],
  'newton': [41.0582, -74.754],
  'noida': [28.5845, 77.3144],
  'omaha': [41.2574, -95.9656],
  'ong-a': [21.009, 105.8257],
  'opfikon': [47.4234, 8.5689],
  'orlando': [28.5473, -81.3865],
  'palo-alto': [37.4195, -122.1364],
  'pappanaickenpalayam': [11.014, 76.986],
  'provincia-di-treviso': [45.5644, 12.4365],
  'quan-1': [10.7738, 106.6975],
  'redwood-city': [37.5221, -122.2553],
  'reno': [39.5199, -119.8117],
  'richmond': [-37.8241, 144.9917],
  'san-jose': [37.3714, -121.9148],
  'san-juan': [18.4452, -66.0659],
  'san-pedro-garza-garcia': [25.6594, -100.3747],
  'san-salvador': [13.6923, -89.2439],
  'sandy': [40.5743, -111.9015],
  'saryer': [41.1047, 29.0258],
  'shah-alam': [3.1951, 101.5744],
  'shen-zhen-shi': [22.5573, 113.941],
  'shenzhen': [22.5429, 114.0596],
  'shibuya': [35.6591, 139.7037],
  'shinjuku-city': [35.698, 139.7049],
  'shkent': [41.3383, 69.3362],
  'singapura': [1.3019, 103.9061],
  'sisli': [41.0651, 28.9871],
  'son-tra': [16.0675, 108.2314],
  'south-jakarta': [-6.2469, 106.8045],
  'stanford': [37.4259, -122.1601],
  'strongsville': [41.3192, -81.8298],
  'stuttgart': [48.7223, 9.1684],
  'subang-jaya': [3.0646, 101.6164],
  'surry-hills': [-33.8892, 151.2141],
  'taguig': [14.5516, 121.0491],
  'tallinn': [59.4391, 24.7292],
  'tel-aviv-yafo': [32.0709, 34.7877],
  'thanh-pho-ho-chi-minh': [10.7676, 106.7232],
  'torino': [45.0557, 7.6795],
  'vigo': [42.24, -8.7274],
  'vilnius': [54.673, 25.2693],
  'wien': [48.2085, 16.411],
  'yenimahalle': [39.9948, 32.7511],
  'yerevan': [40.1866, 44.5099],
  'zagreb': [45.819, 16.0078],
  'zhongzheng-district': [25.0133, 121.5333],
  'mandal': [18.7800, 84.0900],
  'santa-clara': [37.3541, -121.9552],
  'zanzibar': [-6.1659, 39.2026],
  'sunnyvale': [37.3688, -122.0363],
  'salt-lake-city': [40.7608, -111.8910],
  'dublin': [53.3498, -6.2603],
  'adelaide': [-34.9285, 138.6007],
  'delhi': [28.7041, 77.1025],
  'nairobi': [-1.2921, 36.8219],
  'innsbruck': [47.2692, 11.4041],
  'barcelona': [41.3874, 2.1686],
  'charlotte': [35.2271, -80.8431],
  'naples': [26.1420, -81.7948],
  'sacramento': [38.5816, -121.4944],
  'sandy-springs': [33.9304, -84.3733],
  'rancho-cordova': [38.5891, -121.3028],
  'washington': [38.9072, -77.0369],
  'miami': [25.7617, -80.1918],
  'dhaka': [23.8103, 90.4125],
  'accra': [5.6037, -0.1870],
  'cape-town': [-33.9249, 18.4241],
  'mumbai': [19.0760, 72.8777],
  'colombo': [6.9271, 79.8612],
  'manta': [-0.9500, -80.7333],
  'jakarta': [-6.2088, 106.8456],
  'taipei': [25.0330, 121.5654],
  'hong-kong': [22.3193, 114.1694],
  'berea': [37.5687, -84.2963],
  'kota-bekasi': [-6.2383, 106.9756],
  'thunder-bay': [48.3809, -89.2477],
  'vero-beach': [27.6386, -80.3973],
  'palm-beach': [26.7056, -80.0364],
  'cary': [35.7915, -78.7811],
  'utrecht': [52.0907, 5.1214],
  'tel-aviv-jaffa': [32.0853, 34.7818],
  'kuala-lumpur': [3.1390, 101.6869],
  'milano': [45.4642, 9.1900],
  'roma': [41.9028, 12.4964],
  'lisboa': [38.7223, -9.1393],
  'koln': [50.9375, 6.9603],
  'köln': [50.9375, 6.9603],
  'hurth': [50.8784, 6.8765],
  'hürth': [50.8784, 6.8765],
  'athina': [37.9838, 23.7275],
  'brooklyn': [40.6782, -73.9442],
  'nashville': [36.1627, -86.7816],
  'barranco': [-12.1408, -77.0203],
  'macao': [22.1987, 113.5439],
  'nangang-district': [25.0554, 121.6177],
  'hlavni-mesto-praha': [50.0755, 14.4378],
  'hlavní-město-praha': [50.0755, 14.4378],
  'dong-da': [21.0181, 105.8294],
  'đống-đa': [21.0181, 105.8294],
  'online': null
};

/* ── City name aliases for search ── */
var cityNames = {
  'oakland': 'oakland', 'san francisco': 'san-francisco', 'sf': 'san-francisco',
  'ho chi minh': 'ho-chi-minh-city', 'saigon': 'ho-chi-minh-city',
  'austin': 'austin', 'bentonville': 'bentonville', 'seattle': 'seattle',
  'singapore': 'singapore', 'tokyo': 'tokyo', 'bucharest': 'bucharest',
  'istanbul': 'istanbul', 'ghent': 'ghent', 'toulouse': 'toulouse',
  'new york': 'new-york', 'nyc': 'new-york', 'berlin': 'berlin',
  'victoria': 'victoria', 'raleigh': 'raleigh', 'kitchener': 'kitchener',
  'waterloo': 'kitchener', 'boulder': 'boulder', 'amsterdam': 'amsterdam',
  'toronto': 'toronto', 'vancouver': 'vancouver', 'chiang mai': 'chiang-mai',
  'oslo': 'oslo', 'bangalore': 'bangalore', 'bengaluru': 'bangalore',
  'london': 'london', 'los angeles': 'los-angeles', 'la': 'los-angeles',
  'valencia': 'valencia', 'ann arbor': 'ann-arbor', 'sao paulo': 'sao-paulo',
  'guadalajara': 'guadalajara', 'rio de janeiro': 'rio-de-janeiro', 'rio': 'rio-de-janeiro',
  'copenhagen': 'copenhagen', 'chicago': 'chicago', 'ankara': 'ankara',
  'belo horizonte': 'belo-horizonte', 'boston': 'boston', 'philadelphia': 'philadelphia',
  'philly': 'philadelphia', 'seoul': 'seoul', 'mexico city': 'mexico-city',
  'cdmx': 'mexico-city', 'bogota': 'bogota', 'porto alegre': 'porto-alegre',
  'shanghai': 'shanghai', 'buenos aires': 'buenos-aires', 'paris': 'paris',
  'stockholm': 'stockholm', 'melbourne': 'melbourne', 'dallas': 'dallas',
  'atlanta': 'atlanta', 'houston': 'houston', 'portland': 'portland',
  'san diego': 'san-diego', 'auckland': 'auckland',
  'helsinki': 'helsinki', 'stamford': 'stamford', 'peoria': 'peoria',
  'virginia beach': 'virginia-beach', 'hartford': 'hartford', 'wellington': 'wellington',
  'dunedin': 'dunedin', 'christchurch': 'christchurch', 'goteborg': 'goteborg',
  'gothenburg': 'goteborg', 'toledo': 'toledo', 'mountain view': 'mountain-view',
  'salt lake city': 'salt-lake-city', 'slc': 'salt-lake-city', 'dublin': 'dublin',
  'adelaide': 'adelaide', 'delhi': 'delhi', 'new delhi': 'delhi',
  'nairobi': 'nairobi', 'innsbruck': 'innsbruck', 'barcelona': 'barcelona',
  'charlotte': 'charlotte', 'naples': 'naples', 'sacramento': 'sacramento',
  'sandy springs': 'sandy-springs', 'washington': 'washington', 'dc': 'washington',
  'miami': 'miami', 'dhaka': 'dhaka', 'accra': 'accra', 'cape town': 'cape-town',
  'rancho cordova': 'rancho-cordova', 'mumbai': 'mumbai', 'colombo': 'colombo',
  'manta': 'manta', 'jakarta': 'jakarta', 'taipei': 'taipei',
  'hong kong': 'hong-kong', 'berea': 'berea', 'palm beach': 'palm-beach'
};

/* ── Tile layer presets ── */
var TILES = {
  dark: {
    url: 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
    attr: 'Imagery \u00a9 <a href="https://earthdata.nasa.gov">NASA EOSDIS GIBS</a>',
    maxNativeZoom: 8
  },
  light: {
    url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg?api_key=c752bb40-c70a-452e-98e1-9f02b1769f9e',
    attr: '\u00a9 <a href="https://stamen.com/">Stamen Design</a> \u00a9 <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }
};

/* ── Pretty city label from slug ── */
function cityLabel(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

/* ── Init map ── */
function initClawCampMap(containerId, opts) {
  opts = opts || {};
  var mode = opts.mode || 'dark';
  var interactive = opts.interactive !== false;
  var zoom = opts.zoom || 2;
  var center = opts.center || [20, 0];
  var onDotClick = opts.onDotClick || null;
  var showToggle = opts.showToggle !== false;
  var autoScroll = opts.autoScroll || false;

  var container = document.getElementById(containerId);
  if (!container) return null;

  // Restore saved preference
  try {
    var saved = localStorage.getItem('clawcamp-map-mode');
    if (saved && TILES[saved]) mode = saved;
  } catch(e) {}

  var map = L.map(containerId, {
    center: center,
    zoom: zoom,
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    dragging: interactive,
    touchZoom: interactive,
    doubleClickZoom: interactive,
    keyboard: interactive,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: interactive ? 8 : 4
  });

  // Attribution (subtle)
  L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

  // Zoom control for interactive maps
  if (interactive) {
    L.control.zoom({ position: 'bottomright' }).addTo(map);
  }

  // Tile layer
  var tileLayer = null;
  function setTiles(m) {
    if (tileLayer) map.removeLayer(tileLayer);
    var t = TILES[m] || TILES.dark;
    var opts = { attribution: t.attr, subdomains: 'abcd', maxZoom: 19 };
    if (t.maxNativeZoom) opts.maxNativeZoom = t.maxNativeZoom;
    tileLayer = L.tileLayer(t.url, opts).addTo(map);
  }
  setTiles(mode);

  // Markers layer group
  var markersGroup = L.layerGroup().addTo(map);

  // Toggle button
  var toggleBtn = null;
  if (showToggle) {
    var ToggleControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function() {
        var btn = L.DomUtil.create('button', 'leaflet-map-toggle');
        btn.textContent = mode === 'dark' ? '\u2606' : '\u263E';
        btn.title = 'Toggle map style';
        L.DomEvent.disableClickPropagation(btn);
        btn.addEventListener('click', function() {
          mode = mode === 'dark' ? 'light' : 'dark';
          setTiles(mode);
          btn.textContent = mode === 'dark' ? '\u2606' : '\u263E';
          try { localStorage.setItem('clawcamp-map-mode', mode); } catch(e) {}
        });
        toggleBtn = btn;
        return btn;
      }
    });
    map.addControl(new ToggleControl());
  }

  // Auto-scroll for decorative maps (homepage hero)
  var scrollInterval = null;
  if (autoScroll) {
    scrollInterval = setInterval(function() {
      map.panBy([0.5, 0], { animate: false });
      // Reset longitude when drifted too far to keep dots visible
      var center = map.getCenter();
      if (center.lng > 540) {
        map.setView([center.lat, center.lng - 360], map.getZoom(), { animate: false });
      }
    }, 50);
  }

  // Build dot icon
  function makeDotIcon(isFlagship) {
    var size = isFlagship ? 12 : 8;
    var cls = 'clawcamp-dot' + (isFlagship ? ' flagship' : '');
    var delay = (Math.random() * 4).toFixed(1);
    return L.divIcon({
      className: cls,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  // Public API
  return {
    map: map,

    setMode: function(m) {
      mode = m;
      setTiles(mode);
      if (toggleBtn) toggleBtn.textContent = mode === 'dark' ? '\u2606' : '\u263E';
      try { localStorage.setItem('clawcamp-map-mode', mode); } catch(e) {}
    },

    addEventDots: function(events, flagshipCities) {
      markersGroup.clearLayers();
      flagshipCities = flagshipCities || ['oakland'];

      // Group events by city
      var cities = {};
      events.forEach(function(ev) {
        var c = ev.city;
        if (!c || c === 'online') return;
        if (!cities[c]) cities[c] = { count: 0, names: [] };
        cities[c].count++;
        if (cities[c].names.length < 3) cities[c].names.push(ev.name);
      });

      // Longitude offsets for world copies so dots repeat as map scrolls
      var lngOffsets = autoScroll ? [-720, -360, 0, 360, 720, 1080, 1440, 1800, 2160, 2520] : [0];

      // Collect primary markers (offset 0) for auto-cycling
      var primaryMarkers = [];
      var cycleTimer = null;
      var cycleIndex = 0;
      var userInteracted = false;

      function stopCycling() {
        userInteracted = true;
        if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
      }

      function cycleTooltips() {
        if (userInteracted || primaryMarkers.length === 0) return;
        // Close all tooltips first
        primaryMarkers.forEach(function(m) { m.closeTooltip(); });
        // Filter to markers currently visible on screen
        var bounds = map.getBounds();
        var visible = primaryMarkers.filter(function(m) {
          return bounds.contains(m.getLatLng());
        });
        if (visible.length === 0) return;
        // Open the current one from visible set
        var current = visible[cycleIndex % visible.length];
        current.openTooltip();
        cycleIndex++;
      }

      Object.keys(cities).forEach(function(c) {
        var coords = cityCoords[c];
        if (!coords) return;
        var isFlagship = flagshipCities.indexOf(c) !== -1;
        var label = cityLabel(c);
        var info = cities[c];
        var countText = info.count + ' event' + (info.count > 1 ? 's' : '');
        var tooltipHtml = '<strong>' + label + '</strong><br><span class="dot-count">' + countText + '</span>';

        lngOffsets.forEach(function(offset) {
          var pos = [coords[0], coords[1] + offset];
          var marker = L.marker(pos, { icon: makeDotIcon(isFlagship) });

          marker.bindTooltip(tooltipHtml, {
            className: 'clawcamp-tooltip',
            direction: 'top',
            offset: [0, -8]
          });

          // Stop cycling on user interaction (interactive maps only)
          if (!autoScroll) {
            marker.on('click', function() { stopCycling(); });
            marker.on('mouseover', function() { stopCycling(); });
          }

          if (onDotClick) {
            marker.on('click', function() { onDotClick(c, coords, label); });
          }

          marker.on('add', function() {
            var el = this.getElement();
            if (el) el.style.setProperty('--breathe-delay', (Math.random() * 4).toFixed(1) + 's');
          });
          markersGroup.addLayer(marker);

          // Track markers for cycling — all copies for autoScroll, primary only otherwise
          if (autoScroll || offset === 0) primaryMarkers.push(marker);
        });
      });

      // Start auto-cycling tooltips after a short delay
      if (primaryMarkers.length > 0) {
        // Shuffle so it's not always the same order
        for (var i = primaryMarkers.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = primaryMarkers[i];
          primaryMarkers[i] = primaryMarkers[j];
          primaryMarkers[j] = temp;
        }
        // Show first tooltip immediately
        setTimeout(function() { cycleTooltips(); }, 800);
        // Cycle every 2 seconds
        cycleTimer = setInterval(cycleTooltips, 2000);
        // Stop cycling on user interaction (interactive maps only)
        if (!autoScroll) {
          map.on('click', stopCycling);
          map.on('mousedown', stopCycling);
        }
      }
    },

    destroy: function() {
      if (scrollInterval) clearInterval(scrollInterval);
      map.remove();
    }
  };
}
