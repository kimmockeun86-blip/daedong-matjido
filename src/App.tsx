import { useState, useEffect, useRef } from 'react';
import ExcelImporter from './components/ExcelImporter';
import GourmetMap from './components/GourmetMap';
import Sidebar from './components/Sidebar';
import DetailPanel from './components/DetailPanel';
import GourmetToolkit from './components/GourmetToolkit';
import type { RestaurantRaw } from './utils/excel';
import { geocodeAddress, getDefaultFallbackCoordinates } from './utils/geocoder';
import { Sparkles } from 'lucide-react';
import L from 'leaflet';

const LOCAL_STORAGE_KEY = 'daedong_restaurants_data';

export default function App() {
  const [restaurants, setRestaurants] = useState<RestaurantRaw[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantRaw | null>(null);
  
  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [minRating, setMinRating] = useState(0);

  // 화면 크기 (모바일 여부) 상태 관리
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 미식 툴킷 상태 관리
  const [isToolkitOpen, setIsToolkitOpen] = useState(false);
  const [visitedRestaurants, setVisitedRestaurants] = useState<string[]>([]);

  useEffect(() => {
    if (isToolkitOpen) {
      const visited = JSON.parse(localStorage.getItem('daedong_visited') || '[]');
      setVisitedRestaurants(visited);
    }
  }, [isToolkitOpen]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 지도 인스턴스 Ref
  const mapRef = useRef<L.Map | null>(null);

  // 지오코딩 변환 진행 상태
  const [geocodingProgress, setGeocodingProgress] = useState<{ current: number; total: number } | null>(null);

  // 1. 초기 마운트 시 맛집 데이터 로드 (로컬스토리지 우선, 없을 시 /restaurants.json 자동 로드)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
          setRestaurants(JSON.parse(savedData));
        } else {
          // 로컬스토리지에 없으면 빌드된 맛집 JSON 로드
          console.log('로컬스토리지 데이터 없음, 기본 맛집 데이터 로드 중...');
          const response = await fetch('/restaurants.json');
          if (response.ok) {
            const data = await response.json();
            setRestaurants(data);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
          }
        }
      } catch (err) {
        console.error('초기 맛집 데이터 로드 실패:', err);
      }
    };
    loadInitialData();
  }, []);

  // 2. 엑셀 파일 파싱 후 좌표가 없는 주소들에 대해 지오코딩 일괄 수행
  const handleDataParsed = async (rawRestaurants: RestaurantRaw[]) => {
    // 위경도 좌표가 없는 항목들을 수집
    const missingCoords = rawRestaurants.filter(
      r => r.latitude === undefined || r.longitude === undefined
    );

    if (missingCoords.length === 0) {
      // 모든 맛집의 좌표가 미리 채워진 경우
      setRestaurants(rawRestaurants);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rawRestaurants));
      return;
    }

    setGeocodingProgress({ current: 0, total: missingCoords.length });

    const updatedRestaurants = [...rawRestaurants];
    let processedCount = 0;

    for (let i = 0; i < updatedRestaurants.length; i++) {
      const res = updatedRestaurants[i];
      if (res.latitude === undefined || res.longitude === undefined) {
        processedCount++;
        setGeocodingProgress({ current: processedCount, total: missingCoords.length });

        // 실시간 위경도 변환 API 요청
        if (res.address) {
          const coords = await geocodeAddress(res.address);
          if (coords) {
            res.latitude = coords.latitude;
            res.longitude = coords.longitude;
          } else {
            // 주소 조회 실패 시 기본 서울 시청 근처 가상 좌표 부여
            const fallback = getDefaultFallbackCoordinates();
            res.latitude = fallback.latitude;
            res.longitude = fallback.longitude;
            res.review = `${res.review ? res.review + ' ' : ''}(주소 위치 조회 실패로 임의 좌표 지정)`;
          }
        } else {
          // 주소 자체가 없는 경우
          const fallback = getDefaultFallbackCoordinates();
          res.latitude = fallback.latitude;
          res.longitude = fallback.longitude;
        }

        // 지오코딩 속도 제한(초당 1회) 준수
        if (processedCount < missingCoords.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    setGeocodingProgress(null);
    setRestaurants(updatedRestaurants);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedRestaurants));
  };

  // 3. 맛집 데이터 초기화
  const handleResetData = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setRestaurants([]);
    setSelectedRestaurant(null);
    setSearchQuery('');
    setSelectedCategory('전체');
    setSelectedRegion('전체');
    setMinRating(0);
  };

  // 4. GPS 기반 내 주변 맛집 찾기 구현
  const handleGPSClick = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 GPS 위치 정보 탐색을 지원하지 않습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const map = mapRef.current;
        if (map) {
          // 사용자 위치로 지도 이동 (줌 레벨 14로 줌인)
          map.setView([latitude, longitude], 14, { animate: true, duration: 1.0 });

          // 로드된 맛집 중 사용자 위치에서 가장 가까운 맛집 탐색
          if (restaurants.length > 0) {
            let nearestRes: RestaurantRaw | null = null;
            let minDist = Infinity;

            restaurants.forEach((res) => {
              if (res.latitude !== undefined && res.longitude !== undefined) {
                const dLat = res.latitude - latitude;
                const dLon = res.longitude - longitude;
                const dist = dLat * dLat + dLon * dLon;
                if (dist < minDist) {
                  minDist = dist;
                  nearestRes = res;
                }
              }
            });

            // 위경도상 적정 오차 범위 이내인 경우 가장 가까운 맛집 자동 선택 포커싱
            if (nearestRes && minDist < 0.5) {
              setSelectedRestaurant(nearestRes);
            }
          }
        }
      },
      (error) => {
        console.error('GPS 내 위치 획득 실패:', error);
        alert('내 위치 정보를 불러오지 못했습니다. 위치 정보 엑세스 권한을 허용해주세요.');
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };

  // 5. 지역(selectedRegion) 필터 선택 시 지도 뷰포트 자동 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map || restaurants.length === 0) return;

    if (selectedRegion === '전체') {
      // 대한민국 전체 조망 중심 좌표로 복귀
      map.setView([35.907757, 127.766922], 7.5, { animate: true, duration: 0.8 });
    } else {
      // 선택된 지역에 속한 모든 맛집의 좌표들을 모아 경계구역(Bounds) 계산 후 자동 피팅
      const regionCoords = restaurants
        .filter(r => r.region === selectedRegion && r.latitude !== undefined && r.longitude !== undefined)
        .map(r => L.latLng(r.latitude!, r.longitude!));

      if (regionCoords.length > 0) {
        const bounds = L.latLngBounds(regionCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12, animate: true, duration: 0.8 });
      }
    }
  }, [selectedRegion, restaurants]);

  // 6. 필터링 로직 적용
  const filteredRestaurants = restaurants.filter((res) => {
    // 6.1. 카테고리 필터
    const matchesCategory = selectedCategory === '전체' || res.category === selectedCategory;

    // 6.2. 평점 필터
    const matchesRating = res.rating >= minRating;

    // 6.3. 지역 필터
    const matchesRegion = selectedRegion === '전체' || res.region === selectedRegion;

    // 6.4. 검색어 필터 (상호명, 리뷰 본문)
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      query === '' || 
      res.name.toLowerCase().includes(query) || 
      res.review.toLowerCase().includes(query) ||
      res.address.toLowerCase().includes(query);

    return matchesCategory && matchesRating && matchesRegion && matchesSearch;
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {restaurants.length === 0 ? (
        // 맛집 데이터가 비어있을 시 엑셀 파일 업로드 화면 노출
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)'
        }}>
          <ExcelImporter 
            onDataParsed={handleDataParsed} 
            geocodingProgress={geocodingProgress} 
          />
        </div>
      ) : (
        // 맛집 데이터가 존재할 시 인터랙티브 지도 서비스 화면 노출
        <>
          {/* 오픈스트리트맵 레이어 */}
          <GourmetMap 
            restaurants={filteredRestaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
            mapRef={mapRef}
          />

          {/* 좌측 사이드바 패널 (목록, 필터, 대시보드 내장) */}
          <Sidebar
            restaurants={restaurants}
            filteredRestaurants={filteredRestaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
            onResetData={handleResetData}
            onGPSClick={handleGPSClick}
            isMobile={isMobile}
            mapRef={mapRef}
          />

          {/* 우하단 개별 맛집 정보 상세 오버레이 카드 */}
          <DetailPanel 
            restaurant={selectedRestaurant}
            onClose={() => setSelectedRestaurant(null)}
            isMobile={isMobile}
          />

          {/* 미식 툴킷 플로팅 버튼 */}
          <button
            onClick={() => setIsToolkitOpen(true)}
            className="animate-pulse-cyan"
            style={{
              position: 'fixed',
              bottom: '24px',
              right: selectedRestaurant ? (isMobile ? '24px' : '432px') : '24px',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-cyan) 100%)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)',
              zIndex: 999,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            }}
          >
            <Sparkles size={24} />
          </button>

          {/* 미식 툴킷 모달 */}
          <GourmetToolkit
            isOpen={isToolkitOpen}
            onClose={() => setIsToolkitOpen(false)}
            restaurants={restaurants}
            onSelectRestaurant={(rest) => {
              setSelectedRestaurant(rest);
              if (rest.latitude && rest.longitude && mapRef.current) {
                mapRef.current.setView([rest.latitude, rest.longitude], 15, { animate: true, duration: 1.0 });
              }
            }}
            visitedRestaurants={visitedRestaurants}
            isMobile={isMobile}
          />
        </>
      )}
    </div>
  );
}
