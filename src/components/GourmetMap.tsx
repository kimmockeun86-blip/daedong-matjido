import { useEffect, useRef } from 'react';
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
  onSelectRestaurant: (restaurant: RestaurantRaw) => void;
  mapRef: React.MutableRefObject<L.Map | null>; // App.tsx에서 제어하기 위해 mapRef를 넘겨 받음
}

export default function GourmetMap({
  restaurants,
  selectedRestaurant,
  onSelectRestaurant,
  mapRef
}: GourmetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const markerGroupRef = useRef<L.FeatureGroup | null>(null);

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

    // CartoDB Dark Matter tile layer (사이버펑크에 어울리는 최상급 다크 테마)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // 줌 컨트롤을 우하단(bottomright)에 배치
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    mapRef.current = map;
    markerGroupRef.current = L.featureGroup().addTo(map);

    // 클린업
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. 맛집 핀 마커 렌더링 및 갱신 (restaurants 변경 시)
  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !markerGroup) return;

    // 기존 마커 전체 삭제
    markerGroup.clearLayers();
    markersRef.current = {};

    if (restaurants.length === 0) return;

    // 새 맛집들 추가
    restaurants.forEach((res) => {
      if (res.latitude === undefined || res.longitude === undefined) return;

      const position: L.LatLngExpression = [res.latitude, res.longitude];
      const categoryColor = CATEGORY_COLORS[res.category] || CATEGORY_COLORS['기타'];

      // 텍스트를 제거하고 은은하게 빛나는 네온 펄스 링 형태의 HTML 마커 생성
      const customIcon = L.divIcon({
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

      // 마커 객체 생성
      const marker = L.marker(position, { icon: customIcon });

      // 마커 클릭 이벤트 연동
      marker.on('click', () => {
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
      markersRef.current[res.name] = marker;
    });

  }, [restaurants]);

  // 3. 외부 선택 맛집 변경 시 (selectedRestaurant 변경 시)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRestaurant) return;

    const marker = markersRef.current[selectedRestaurant.name];
    if (marker) {
      const coords = marker.getLatLng();
      
      // 해당 핀으로 뷰포트 이동 (기존 줌이 너무 낮으면 15레벨로 줌인, 이미 줌인되어 있다면 유지)
      const currentZoom = map.getZoom();
      const targetZoom = currentZoom < 14 ? 15 : currentZoom;
      map.setView(coords, targetZoom, { animate: true, duration: 0.5 });
      
      // 팝업 열기
      marker.openPopup();

      // 마커 엘리먼트들에 'marker-active' 클래스를 토글하여 펄스 반짝임 강조
      Object.keys(markersRef.current).forEach((name) => {
        const m = markersRef.current[name];
        const el = m.getElement();
        if (el) {
          const innerEl = el.querySelector('.cyber-marker');
          if (innerEl) {
            if (name === selectedRestaurant.name) {
              innerEl.classList.add('marker-active');
            } else {
              innerEl.classList.remove('marker-active');
            }
          }
        }
      });
    }
  }, [selectedRestaurant]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        zIndex: 0 
      }} 
    />
  );
}
