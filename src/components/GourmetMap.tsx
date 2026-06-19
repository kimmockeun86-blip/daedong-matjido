import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { RestaurantRaw } from '../utils/excel';

// Cyberpunk color mapping for categories
const CATEGORY_COLORS: Record<string, string> = {
  '한식': '#ef4444',       // Neon Red
  '일식': '#3b82f6',       // Neon Blue
  '중식': '#8b5cf6',       // Neon Purple
  '양식': '#10b981',       // Neon Green
  '분식': '#ec4899',       // Neon Pink
  '육류': '#f97316',       // Neon Orange
  '기타': '#64748b'        // Slate/Muted
};

interface GourmetMapProps {
  restaurants: RestaurantRaw[];
  selectedRestaurant: RestaurantRaw | null;
  onSelectRestaurant: (restaurant: RestaurantRaw | null) => void;
  mapRef: React.MutableRefObject<L.Map | null>; // App.tsx에서 제어하기 위해 mapRef를 넘겨 받음
  routeRestaurants?: RestaurantRaw[];
}

interface CustomMarker extends L.Marker {
  defaultIcon?: L.DivIcon;
  activeIcon?: L.DivIcon;
}

export default function GourmetMap({
  restaurants,
  selectedRestaurant,
  onSelectRestaurant,
  mapRef,
  routeRestaurants
}: GourmetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, CustomMarker>>({});
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);

  // Keep callback fresh without map re-initialization
  const onSelectRestaurantRef = useRef(onSelectRestaurant);
  useEffect(() => {
    onSelectRestaurantRef.current = onSelectRestaurant;
  }, [onSelectRestaurant]);

  // Premium map skin state & refs
  const [mapSkin, setMapSkin] = useState<'cyberpunk' | 'smooth' | 'light'>('cyberpunk');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  // 1. 지도 초기화 (최초 1회 실행)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // 대한민국 중심부 조망 (Daejeon 부근)
    const initialCenter: L.LatLngExpression = [35.907757, 127.766922];
    const initialZoom = 7.5; // 전국 맛집 핀이 전부 보이는 알맞은 줌 레벨

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      minZoom: 6,
      maxZoom: 18
    }).setView(initialCenter, initialZoom);

    // Initial tile layer reference
    const tile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    tileLayerRef.current = tile;

    // 줌 컨트롤을 우하단(bottomright)에 배치
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;
    markerGroupRef.current = L.featureGroup().addTo(map);

    // 지도 빈 공간 클릭 시 선택 해제 및 상세 패널 닫기
    map.on('click', () => {
      onSelectRestaurantRef.current(null);
    });

    // 클린업
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapRef]);

  // Premium Map Skin Switcher effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    if (mapSkin === 'smooth') {
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    } else if (mapSkin === 'light') {
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }

    tileLayerRef.current = L.tileLayer(url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Apply body class for themed scrollbars
    document.body.className = `theme-${mapSkin}`;

    // Apply filter effects to the tiles container
    const container = map.getPane('tilePane');
    if (container) {
      if (mapSkin === 'smooth') {
        container.style.filter = 'sepia(0.8) contrast(0.9) brightness(0.95)';
      } else if (mapSkin === 'cyberpunk') {
        container.style.filter = 'hue-rotate(0deg) saturate(1.2) contrast(1.1)';
      } else {
        container.style.filter = 'none';
      }
    }
  }, [mapSkin, mapRef]);

  // 2. 맛집 핀 마커 렌더링 및 갱신 (restaurants 변경 시)
  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // 기존 마커 전체 삭제
    markerGroup.clearLayers();
    markersRef.current = {};

    // Combine restaurants and routeRestaurants to render all relevant markers
    const renderedList = [...restaurants];
    if (routeRestaurants) {
      routeRestaurants.forEach(rr => {
        if (!renderedList.some(r => r.id === rr.id)) {
          renderedList.push(rr);
        }
      });
    }

    if (renderedList.length === 0) return;

    // 새 맛집들 추가
    renderedList.forEach((res) => {
      if (res.latitude === undefined || res.longitude === undefined) return;

      const position: L.LatLngExpression = [res.latitude, res.longitude];
      const categoryColor = CATEGORY_COLORS[res.category] || CATEGORY_COLORS['기타'];

      const routeIdx = routeRestaurants ? routeRestaurants.findIndex(r => r.id === res.id) : -1;
      const isRouteItem = routeIdx !== -1;

      // Default neon marker icon
      let customIcon: L.DivIcon;
      let activeIcon: L.DivIcon;

      if (isRouteItem) {
        customIcon = L.divIcon({
          className: 'custom-leaflet-marker-route',
          html: `
            <div class="cyber-marker-route" style="
              background-color: #0f172a;
              border: 2px solid ${categoryColor};
              color: #f8fafc;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 800;
              box-shadow: 0 0 10px ${categoryColor};
            ">${routeIdx + 1}</div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        activeIcon = L.divIcon({
          className: 'custom-leaflet-marker-route',
          html: `
            <div class="cyber-marker-route marker-active" style="
              background-color: ${categoryColor};
              border: 2px solid #ffffff;
              color: #020617;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 900;
              box-shadow: 0 0 15px #ffffff;
            ">${routeIdx + 1}</div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
      } else {
        customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div class="cyber-marker" style="
              color: ${categoryColor};
              background-color: ${categoryColor};
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        activeIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div class="cyber-marker marker-active" style="
              color: ${categoryColor};
              background-color: ${categoryColor};
            "></div>
          `,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
      }

      // 마커 객체 생성
      const marker = L.marker(position, { icon: customIcon }) as CustomMarker;
      marker.defaultIcon = customIcon;
      marker.activeIcon = activeIcon;

      // 마커 클릭 이벤트 연동
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRestaurant(res);
      });

      // 팝업 설정 (네온 테마)
      const popupContent = `
        <div style="font-family: inherit;">
          <h4 style="font-size: 13px; font-weight: 700; color: #f8fafc; margin-bottom: 2px;">${res.name}</h4>
          <p style="font-size: 11px; color: ${categoryColor}; font-weight: 600; margin-bottom: 4px;">★ ${res.rating.toFixed(1)} (${res.category})</p>
          <p style="font-size: 10px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${res.address}</p>
        </div>
      `;
      
      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -6]
      });

      // 그룹에 등록 및 캐싱
      markerGroup.addLayer(marker);
      markersRef.current[res.id || res.name] = marker;
    });

  }, [restaurants, mapRef, onSelectRestaurant, routeRestaurants]);

  // 2.5 routeRestaurants 변경 시 polyline 렌더링
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!routeRestaurants || routeRestaurants.length < 2) return;

    const latLngs = routeRestaurants
      .filter(r => r.latitude !== undefined && r.longitude !== undefined)
      .map(r => L.latLng(r.latitude!, r.longitude!));

    if (latLngs.length >= 2) {
      const polyline = L.polyline(latLngs, {
        color: 'var(--accent-cyan)',
        weight: 3,
        dashArray: '5, 10',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      polylineRef.current = polyline;

      // Fit bounds if route changes
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
    }
  }, [routeRestaurants, mapRef]);

  // 3. 외부 선택 맛집 변경 시 (selectedRestaurant 변경 시)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedRestaurant) {
      const marker = markersRef.current[selectedRestaurant.id || selectedRestaurant.name];
      if (marker) {
        const coords = marker.getLatLng();
        
        // 해당 핀으로 뷰포트 이동 (기존 줌이 너무 낮으면 15레벨로 줌인, 이미 줌인되어 있다면 유지)
        const currentZoom = map.getZoom();
        const targetZoom = currentZoom < 14 ? 15 : currentZoom;
        map.setView(coords, targetZoom, { animate: true, duration: 0.5 });
        
        // 팝업 열기
        marker.openPopup();
      }
    }

    // Bug 5: Update icon state using marker.setIcon() to avoid zoom/pan DOM reset issues
    Object.keys(markersRef.current).forEach((id) => {
      const m = markersRef.current[id];
      if (selectedRestaurant && (id === selectedRestaurant.id || id === selectedRestaurant.name)) {
        if (m.activeIcon) {
          m.setIcon(m.activeIcon);
        }
      } else {
        if (m.defaultIcon) {
          m.setIcon(m.defaultIcon);
        }
      }
    });

  }, [selectedRestaurant, restaurants, mapRef, routeRestaurants]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%' }} 
      />
      {/* Map Skin Switcher */}
      <div 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1.5px solid var(--accent-cyan)',
        borderRadius: '10px',
        padding: '10px',
        boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>
          MAP SKIN SWITCHER
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'cyberpunk' as const, name: 'Neon Dark' },
            { id: 'smooth' as const, name: 'Joseon Vintage Scroll' },
            { id: 'light' as const, name: 'CartoDB Light' }
          ].map((skin) => (
            <button
              key={skin.id}
              onClick={() => {
                setMapSkin(skin.id);
              }}
              style={{
                padding: '4px 8px',
                background: mapSkin === skin.id ? 'var(--accent-cyan)' : 'transparent',
                border: '1px solid var(--border-glass)',
                borderRadius: '6px',
                color: mapSkin === skin.id ? '#020617' : '#94a3b8',
                fontSize: '10px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {skin.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
