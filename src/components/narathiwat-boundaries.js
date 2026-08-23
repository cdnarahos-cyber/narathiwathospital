import { downloadAreaReportPdf } from '../services/area-report-pdf.js';

const boundarySources = {
  districts: './public/gis/narathiwat-districts.geojson',
  tambons: './public/gis/narathiwat-tambons.geojson'
};

const cache = {};
const appliedMaps = new WeakSet();

const loadBoundary = async name => {
  if (!cache[name]) {
    cache[name] = fetch(boundarySources[name]).then(response => {
      if (!response.ok) throw new Error(`ไม่สามารถโหลดขอบเขต ${name}`);
      return response.json();
    });
  }
  return cache[name];
};

const caseCount = place => JSON.parse(localStorage.getItem('ndss-investigations') || '[]')
  .filter(item => [item.subdistrict, item.district, item.location].filter(Boolean).join(' ').includes(place)).length;

const caseColor = count => count >= 5 ? '#dc2626' : count >= 2 ? '#f59e0b' : count >= 1 ? '#16a34a' : '#0b63b6';

const styleFor = (feature, level) => {
  const place = level === 'district' ? feature.properties.district : feature.properties.tambon;
  const count = caseCount(place);
  const color = caseColor(count);
  return level === 'district'
    ? { color, weight: 2, fillColor: color, fillOpacity: count ? 0.16 : 0.04 }
    : { color, weight: 0.8, dashArray: '3 4', fillColor: color, fillOpacity: count ? 0.1 : 0 };
};

const makeLayer = (L, data, level, pane) => L.geoJSON(data, {
  pane,
  style: feature => styleFor(feature, level),
  onEachFeature: (feature, layer) => {
    const isDistrict = level === 'district';
    const name = isDistrict ? feature.properties.district : feature.properties.tambon;
    const parent = isDistrict ? '' : ` · อ.${feature.properties.district}`;
    const count = caseCount(name);
    layer.bindTooltip(`${isDistrict ? 'อำเภอ' : 'ตำบล'}${name}${parent}`, { sticky: true });
    layer.bindPopup(`<b>${isDistrict ? 'อำเภอ' : 'ตำบล'}${name}</b><br>${isDistrict ? '' : `อำเภอ${feature.properties.district}<br>`}จำนวนเคสที่บันทึก: ${count} เคส`);
    layer.on('mouseover', () => layer.setStyle({ ...styleFor(feature, level), weight: isDistrict ? 3.2 : 1.6, fillOpacity: 0.25 }));
    layer.on('mouseout', () => { if (!layer.__ndssSelected) layer.setStyle(styleFor(feature, level)); });
    layer.on('click', () => layer._map?.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: isDistrict ? 12 : 14 }));
  }
});

export const addNarathiwatBoundaries = async map => {
  if (!map || appliedMaps.has(map) || !window.L) return;
  try {
    const [districts, tambons] = await Promise.all([loadBoundary('districts'), loadBoundary('tambons')]);
    if (appliedMaps.has(map)) return;
    const paneName = 'ndssBoundaryPane';
    if (!map.getPane(paneName)) map.createPane(paneName);
    map.getPane(paneName).style.zIndex = '380';
    const districtLayer = makeLayer(window.L, districts, 'district', paneName);
    const tambonLayer = makeLayer(window.L, tambons, 'tambon', paneName);
    districtLayer.addTo(map);
    const areaBounds = new Map();
    const areaLayers = new Map();
    districtLayer.eachLayer(layer => {
      const key = `district:${layer.feature.properties.district}`;
      areaBounds.set(key, layer.getBounds());
      areaLayers.set(key, layer);
    });
    tambonLayer.eachLayer(layer => {
      const key = `tambon:${layer.feature.properties.tambonCode}`;
      areaBounds.set(key, layer.getBounds());
      areaLayers.set(key, layer);
    });
    window.L.control.layers(null, {
      'ขอบเขตอำเภอ': districtLayer,
      'ขอบเขตตำบล': tambonLayer
    }, { collapsed: false, position: 'topright' }).addTo(map);
    const searchWrap = document.createElement('div');
    searchWrap.className = 'map-area-search no-print';
    searchWrap.style.cssText = 'display:flex;gap:10px;align-items:center;margin:0 0 12px;padding:10px 12px;background:#f5f9fd;border:1px solid #d8e5f1;border-radius:10px';
    searchWrap.innerHTML = '<span style="color:#0b3f76;font-weight:700;white-space:nowrap">ค้นหาอำเภอ / ตำบล</span><input type="search" list="ndss-area-options" placeholder="พิมพ์ชื่ออำเภอหรือตำบล แล้วกด Enter" style="flex:1;min-width:220px;border:1px solid #b9cfe4;border-radius:7px;padding:8px 10px;color:#071d38" /><button type="button" disabled style="border:0;border-radius:7px;padding:9px 12px;background:#0b63b6;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap">สร้าง PDF รายพื้นที่</button><datalist id="ndss-area-options"></datalist>';
    const mapContainer = map.getContainer();
    mapContainer.before(searchWrap);
    const input = searchWrap.querySelector('input');
    const reportButton = searchWrap.querySelector('button');
    const optionList = searchWrap.querySelector('datalist');
    const places = [
      ...districts.features.map(feature => ({ label: `อำเภอ${feature.properties.district}`, key: `district:${feature.properties.district}`, district: true, level: 'district', name: feature.properties.district, code: feature.properties.districtCode, geometry: feature.geometry })),
      ...tambons.features.map(feature => ({ label: `ตำบล${feature.properties.tambon} · อำเภอ${feature.properties.district}`, key: `tambon:${feature.properties.tambonCode}`, district: false, level: 'tambon', name: feature.properties.tambon, code: feature.properties.tambonCode, geometry: feature.geometry }))
    ];
    let selectedPlace;
    optionList.innerHTML = places.map(place => `<option value="${place.label}"></option>`).join('');
    const zoomToPlace = () => {
      const query = input.value.trim().toLowerCase();
      if (!query) return;
      const place = places.find(item => item.label.toLowerCase() === query)
        || places.find(item => item.label.toLowerCase().includes(query));
      const bounds = place && areaBounds.get(place.key);
      if (bounds?.isValid()) {
        areaLayers.forEach(layer => {
          if (layer.__ndssSelected) {
            layer.__ndssSelected = false;
            const level = layer.feature.properties.tambon ? 'tambon' : 'district';
            layer.setStyle(styleFor(layer.feature, level));
          }
        });
        const selectedLayer = areaLayers.get(place.key);
        if (selectedLayer) {
          selectedLayer.__ndssSelected = true;
          selectedLayer.setStyle({ color: '#062f57', weight: 4, fillColor: '#0b63b6', fillOpacity: 0.34, dashArray: null });
          selectedLayer.bringToFront();
        }
        selectedPlace = place;
        reportButton.disabled = false;
        reportButton.style.opacity = '1';
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: place.district ? 12 : 14 });
      }
    };
    input.addEventListener('change', zoomToPlace);
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); zoomToPlace(); } });
    reportButton.addEventListener('click', async () => {
      if (!selectedPlace) return;
      const label = reportButton.textContent;
      reportButton.disabled = true;
      reportButton.textContent = 'กำลังสร้าง PDF…';
      try { await downloadAreaReportPdf(selectedPlace); }
      finally { reportButton.disabled = false; reportButton.textContent = label; }
    });
    const resetView = window.L.control({ position: 'topleft' });
    resetView.onAdd = () => {
      const button = window.L.DomUtil.create('button');
      button.type = 'button';
      button.title = 'ดูภาพรวมจังหวัดนราธิวาส';
      button.textContent = 'ภาพรวมจังหวัด';
      button.style.cssText = 'background:#fff;border:0;border-radius:4px;padding:7px 10px;margin:4px;box-shadow:0 1px 5px #1234;color:#0b3f76;font-weight:700;cursor:pointer';
      window.L.DomEvent.disableClickPropagation(button);
      window.L.DomEvent.on(button, 'click', () => map.fitBounds(districtLayer.getBounds(), { padding: [28, 28] }));
      return button;
    };
    resetView.addTo(map);
    const legend = window.L.control({ position: 'bottomright' });
    legend.onAdd = () => {
      const box = window.L.DomUtil.create('div');
      box.style.cssText = 'background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 2px 9px #1233;font:12px sans-serif;line-height:1.7';
      box.innerHTML = '<b>จำนวนเคสในพื้นที่</b><br><span style="color:#0b63b6">●</span> 0 เคส &nbsp; <span style="color:#16a34a">●</span> 1 เคส<br><span style="color:#f59e0b">●</span> 2–4 เคส &nbsp; <span style="color:#dc2626">●</span> 5+ เคส';
      return box;
    };
    legend.addTo(map);
    appliedMaps.add(map);
  } catch (error) {
    console.warn('ไม่สามารถแสดงขอบเขต GIS ได้', error);
  }
};
