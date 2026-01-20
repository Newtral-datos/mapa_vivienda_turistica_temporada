document.addEventListener("DOMContentLoaded", function() {
  let protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const CONFIG = {
    pmtilesFile: 'https://newtral-datos.github.io/mapa_vivienda_turistica_temporada/mapa_rua.pmtiles', 
    sourceLayer: 'mapa_rua',        
    center: [-3.7038, 40.4168],
    zoom: 5,
    flyToZoom: 11,
    countryCode: 'es',
    fields: {
      municipio: 'nombre_municipio',      
      poblacion: 'POBLACION_MUNI', 
      turisticas: 'turisticas',    
      temporada: 'temporada'       
    }
  };

  // FUNCIÓN AUXILIAR: Evita el error NaN y devuelve 0 formateado
  const safeFormat = (val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num === null || val === undefined) return "0";
    return num.toLocaleString('es-ES');
  };

  const POLYGON_LAYER_ID = 'capa_fill';
  
  const getFillColor = (dataField) => [
    'interpolate', ['linear'], ['to-number', ['get', dataField], 0],
    0,    '#f7fcf5',
    1,    '#CCEBC8',
    10,   '#A1D99B',
    50,   '#83D79B',
    100,  '#79D69A',
    500,  '#51D399',
    1000, '#01CC96',
    2000, '#01A378',
    3000, '#018E69',
    5000, '#007959' 
  ];

  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'carto-light': {
          type: 'raster',
          tiles: ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
          tileSize: 256
        }
      },
      layers: [{ id: 'base', type: 'raster', source: 'carto-light' }]
    },
    center: CONFIG.center,
    zoom: CONFIG.zoom
  });

  map.on('load', function() {
    map.addSource('datos', {
      type: 'vector',
      url: `pmtiles://${CONFIG.pmtilesFile}`
    });

    const typeFilter = document.getElementById("alquilerTypeFilter");

    map.addLayer({
      id: POLYGON_LAYER_ID,
      type: 'fill',
      source: 'datos',
      'source-layer': CONFIG.sourceLayer,
      paint: {
        'fill-color': getFillColor(typeFilter.value),
        'fill-opacity': 0.75,
        'fill-outline-color': 'rgba(0,0,0,0.2)'
      }
    });

    const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px' });

    typeFilter.addEventListener("change", function() {
      map.setPaintProperty(POLYGON_LAYER_ID, 'fill-color', getFillColor(this.value));
      if (popup.isOpen()) popup.remove();
    });

    // Evento de clic para el Popup con validación de números
    map.on('click', POLYGON_LAYER_ID, (e) => {
      const p = e.features[0].properties;
      const activo = typeFilter.value; 
      const labelTipo = activo === 'turisticas' ? 'Viviendas Turísticas' : 'Alquiler de Temporada';
      
      const contenidoPopup = `
        <div class="popup-container">
          <div class="popup-header">
            <div style="font-size: 16px; font-weight: 800; color: #333;">${p[CONFIG.fields.municipio] || 'Desconocido'}</div>
            <div style="font-size: 11px; color: #888; font-weight: 600;">Población: ${safeFormat(p[CONFIG.fields.poblacion])} hab.</div>
          </div>
          <div class="popup-body">
            <div style="font-size: 12px; font-weight: 500; color: #555;">${labelTipo}</div>
            <div class="popup-valor-destacado">
              ${safeFormat(p[activo])} unidades
            </div>
          </div>
        </div>
      `;

      popup.setLngLat(e.lngLat).setHTML(contenidoPopup).addTo(map);
    });

    map.on('mouseenter', POLYGON_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', POLYGON_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    // Botón Aleatorio con validación de números
    document.getElementById('randomLocation').addEventListener('click', () => {
      const features = map.queryRenderedFeatures({ layers: [POLYGON_LAYER_ID] });
      
      if (features.length > 0) {
        const feat = features[Math.floor(Math.random() * features.length)];
        const center = turf.center(feat).geometry.coordinates;
        map.flyTo({ center, zoom: CONFIG.flyToZoom, speed: 0.8 });
        
        setTimeout(() => {
            const labelTipo = typeFilter.value === 'turisticas' ? 'Viviendas Turísticas' : 'Alquiler de Temporada';
            popup.setLngLat(center).setHTML(`
                <div class="popup-container">
                  <div class="popup-header">
                    <div style="font-size: 16px; font-weight: 800;">${feat.properties[CONFIG.fields.municipio] || 'Municipio'}</div>
                    <div style="font-size: 11px; color: #888;">Población: ${safeFormat(feat.properties[CONFIG.fields.poblacion])} hab.</div>
                  </div>
                  <div class="popup-valor-destacado">
                    ${safeFormat(feat.properties[typeFilter.value])} unidades
                  </div>
                </div>
            `).addTo(map);
        }, 600);
      }
    });

    // Configuración del Buscador
    const geocoder = new MaplibreGeocoder({
      forwardGeocode: async (config) => {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(config.query)}&format=geojson&countrycodes=es&limit=5`);
        const json = await response.json();
        return { features: json.features.map(f => ({
          type: 'Feature', geometry: f.geometry, place_name: f.properties.display_name, center: f.geometry.coordinates
        }))};
      }
    }, { maplibregl, placeholder: "Buscar municipio...", marker: false });

    document.getElementById("geocoder-container").appendChild(geocoder.onAdd(map));
  });
});
