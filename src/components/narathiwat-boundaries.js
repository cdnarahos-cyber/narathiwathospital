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

const makeLayer = (L, data, level, pane) => L.geoJSON(data, {
  pane,
  style: level === 'district'
    ? { color: '#0b63b6', weight: 2, fillColor: '#1683e7', fillOpacity: 0.04 }
    : { color: '#418ac8', weight: 0.8, dashArray: '3 4', fillOpacity: 0 },
  onEachFeature: (feature, layer) => {
    const isDistrict = level === 'district';
    const name = isDistrict ? feature.properties.district : feature.properties.tambon;
    const parent = isDistrict ? '' : ` · อ.${feature.properties.district}`;
    const count = caseCount(name);
    layer.bindTooltip(`${isDistrict ? 'อำเภอ' : 'ตำบล'}${name}${parent}`, { sticky: true });
    layer.bindPopup(`<b>${isDistrict ? 'อำเภอ' : 'ตำบล'}${name}</b><br>${isDistrict ? '' : `อำเภอ${feature.properties.district}<br>`}จำนวนเคสที่บันทึก: ${count} เคส`);
  }
});

export const addNarathiwatBoundaries = async map => {
  if (!map || appliedMaps.has(map) || !window.L) return;
  try {
    const [districts, tambons] = await Promise.all([loadBoundary('districts'), loadBoundary('tambons')]);
    if (appliedMaps.has(map)) return;
    const pane = map.getPane('ndssBoundaryPane') || map.createPane('ndssBoundaryPane');
    pane.style.zIndex = '380';
    const districtLayer = makeLayer(window.L, districts, 'district', pane);
    const tambonLayer = makeLayer(window.L, tambons, 'tambon', pane);
    districtLayer.addTo(map);
    window.L.control.layers(null, {
      'ขอบเขตอำเภอ': districtLayer,
      'ขอบเขตตำบล': tambonLayer
    }, { collapsed: false, position: 'topright' }).addTo(map);
    appliedMaps.add(map);
  } catch (error) {
    console.warn('ไม่สามารถแสดงขอบเขต GIS ได้', error);
  }
};
