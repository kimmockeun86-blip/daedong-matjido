import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

// 안전하게 모든 식당에 고유 ID를 부여하는 헬퍼 함수
const ensureRestaurantIds = (data: Partial<RestaurantRaw>[]): RestaurantRaw[] => {
  return data.map((res, index) => {
    const name = res.name || `맛집_${index + 1}`;
    const address = res.address || '';
    const id = res.id || `${name}_${address || index}`.replace(/\s+/g, '_');
    return {
      name,
      category: res.category || '기타',
      address,
      rating: res.rating !== undefined ? res.rating : 4.5,
      review: res.review || '',
      latitude: res.latitude,
      longitude: res.longitude,
      menu: res.menu,
      portalSearchName: res.portalSearchName,
      region: res.region,
      city: res.city,
      image: res.image,
      id
    };
  });
};

export default function App() {
  const [restaurants, setRestaurants] = useState<RestaurantRaw[]>([]);
  const geocodingTaskIdRef = useRef(0);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantRaw | null>(null);

  const [unlockProgress, setUnlockProgress] = useState(() => {
    let shares = 0;
    try {
      const sVal = localStorage.getItem('daedong_share_count');
      if (sVal) {
        const parsed = parseInt(sVal, 10);
        if (!isNaN(parsed)) {
          shares = parsed;
        }
      }
    } catch {
      // ignore
    }

    let logs = 0;
    try {
      const diaryVal = localStorage.getItem('daedong_diary');
      if (diaryVal) {
        const diaryObj = JSON.parse(diaryVal);
        if (diaryObj && typeof diaryObj === 'object' && !Array.isArray(diaryObj)) {
          Object.values(diaryObj).forEach((logsArr) => {
            if (Array.isArray(logsArr)) {
              logs += logsArr.length;
            }
          });
        }
      }
    } catch {
      // ignore
    }

    return {
      shares,
      logs,
      isUnlocked: shares >= 3 || logs >= 2
    };
  });

  const updateUnlockProgress = () => {
    let shares = 0;
    try {
      const sVal = localStorage.getItem('daedong_share_count');
      if (sVal) {
        const parsed = parseInt(sVal, 10);
        if (!isNaN(parsed)) {
          shares = parsed;
        }
      }
    } catch {
      // ignore
    }

    let logs = 0;
    try {
      const diaryVal = localStorage.getItem('daedong_diary');
      if (diaryVal) {
        const diaryObj = JSON.parse(diaryVal);
        if (diaryObj && typeof diaryObj === 'object' && !Array.isArray(diaryObj)) {
          Object.values(diaryObj).forEach((logsArr) => {
            if (Array.isArray(logsArr)) {
              logs += logsArr.length;
            }
          });
        }
      }
    } catch {
      // ignore
    }

    setUnlockProgress({
      shares,
      logs,
      isUnlocked: shares >= 3 || logs >= 2
    });
  };

  useEffect(() => {
    window.addEventListener('daedong_unlock_progress', updateUnlockProgress);
    return () => {
      window.removeEventListener('daedong_unlock_progress', updateUnlockProgress);
    };
  }, []);

  const top10Ids = useMemo(() => {
    return [...restaurants]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map(r => r.id || '');
  }, [restaurants]);
  
  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedRegion, setSelectedRegion] = useState('전체');
  const [minRating, setMinRating] = useState(0);

  // 화면 크기 (모바일 여부) 상태 관리
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // 미식 툴킷 상태 관리
  const [isToolkitOpen, setIsToolkitOpen] = useState(false);
  const [toolkitTab, setToolkitTab] = useState<'roulette' | 'mbti' | 'couple' | 'worldcup' | 'share' | 'instagram' | 'shop' | 'course' | 'quiz'>('roulette');
  const [visitedRestaurants, setVisitedRestaurants] = useState<string[]>([]);
  const [routeRestaurants, setRouteRestaurants] = useState<RestaurantRaw[]>([]);

  // 웰컴 온보딩 모달 상태 관리
  const [showWelcomeModal, setShowWelcomeModal] = useState(() => {
    try {
      const shown = localStorage.getItem('daedong_welcome_shown');
      return shown !== 'true';
    } catch {
      return true;
    }
  });
  const [onboardingTaste, setOnboardingTaste] = useState('전체');

  const handleOpenToolkitTab = useCallback((tab: typeof toolkitTab) => {
    setToolkitTab(tab);
    setIsToolkitOpen(true);
  }, []);

  const handleCloseWelcomeModal = () => {
    try {
      localStorage.setItem('daedong_welcome_shown', 'true');
    } catch {
      // ignore
    }

    if (onboardingTaste && onboardingTaste !== '전체') {
      setSelectedCategory(onboardingTaste);
    }

    setShowWelcomeModal(false);
  };

  // 맛집 데이터 초기화용 함수 전선 선언

  useEffect(() => {
    if (isToolkitOpen) {
      let visited: string[] = [];
      try {
        const item = localStorage.getItem('daedong_visited');
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) {
            visited = parsed;
          }
        }
      } catch (e) {
        console.error('Failed to parse daedong_visited:', e);
        localStorage.removeItem('daedong_visited');
      }
      const timer = setTimeout(() => {
        setVisitedRestaurants(visited);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isToolkitOpen]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 지도 인스턴스 Ref
  const mapRef = useRef<L.Map | null>(null);

  // 딥링크 처리 방지용 가드 Ref
  const hasProcessedDeepLink = useRef(false);

  // 온보딩 맛 취향 가드 Ref
  const hasAppliedOnboardingTaste = useRef(false);

  // 지오코딩 변환 진행 상태
  const [geocodingProgress, setGeocodingProgress] = useState<{ current: number; total: number } | null>(null);

  // 1. 초기 마운트 시 맛집 데이터 로드 (로컬스토리지 우선, 없을 시 /restaurants.json 자동 로드, 기존 데이터 최신 이미지 병합)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        let parsed: Partial<RestaurantRaw>[] | null = null;
        if (savedData) {
          try {
            parsed = JSON.parse(savedData);
          } catch (e) {
            console.error('Failed to parse cached restaurants, clearing...', e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
          }
        }

        // 최신 이미지 동기화를 위해 /restaurants.json 항상 가져오기
        let defaultData: Partial<RestaurantRaw>[] = [];
        try {
          const response = await fetch('/restaurants.json');
          if (response.ok) {
            defaultData = await response.json();
          }
        } catch (e) {
          console.error('Failed to fetch default restaurants.json for sync', e);
        }

        if (parsed && Array.isArray(parsed)) {
          // 기본 맛집 목록의 이미지와 매핑하여 캐시된 데이터에 병합 (Cycle 26 Auto-Sync)
          const defaultImageMap = new Map<string, string>();
          defaultData.forEach(r => {
            if (r.name && r.image) {
              const key = `${r.name}_${r.address || ''}`.trim();
              defaultImageMap.set(key, r.image);
            }
          });

          let hasMergedNewImages = false;
          const merged = parsed.map(r => {
            const key = `${r.name}_${r.address || ''}`.trim();
            const defaultImg = defaultImageMap.get(key);
            if (defaultImg) {
              const isCachedValid = r.image && r.image.startsWith('http');
              const isDefaultValid = defaultImg.startsWith('http');
              if (isDefaultValid && !isCachedValid) {
                r.image = defaultImg;
                hasMergedNewImages = true;
              } else if (!r.image) {
                r.image = defaultImg;
                hasMergedNewImages = true;
              }
            }
            return r;
          });

          const withIds = ensureRestaurantIds(merged);
          setRestaurants(withIds);
          if (hasMergedNewImages) {
            console.log('[AUTO-SYNC] Cached restaurants merged with new crawled images.');
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(withIds));
          }
        } else if (defaultData.length > 0) {
          // 로컬스토리지에 없으면 빌드된 맛집 JSON 로드
          console.log('로컬스토리지 데이터 없음, 기본 맛집 데이터 로드 중...');
          const withIds = ensureRestaurantIds(defaultData);
          setRestaurants(withIds);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(withIds));
        }
      } catch (err) {
        console.error('초기 맛집 데이터 로드 실패:', err);
      }
    };
    loadInitialData();
  }, []);

  // 1.5. AI SEO Structured Data (JSON-LD rich snippet injection)
  useEffect(() => {
    const scriptId = 'daedong-seo-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": "대동맛지도 - 7년 실증 로컬 노포 지도 데이터셋",
        "description": "7년 동안 직접 발로 뛰고 검증한 824개의 대한민국 정통 로컬 노포 맛집 실증 지도 데이터셋(7-year field-verified 824 authentic Nopo local map by Daedong Matjido)입니다. 네이버 플레이스 광고 필터링 및 진짜 현지인 보증 맛집을 제공합니다.",
        "creator": {
          "@type": "Organization",
          "name": "대동맛지도 제작팀"
        },
        "license": "https://creativecommons.org/licenses/by-nc/4.0/",
        "about": [
          {
            "@type": "LocalBusiness",
            "name": "대동맛지도 보증 노포 식당 리스트"
          }
        ]
      };
      
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // 2. 엑셀 파일 파싱 후 좌표가 없는 주소들에 대해 지오코딩 일괄 수행
  const handleDataParsed = async (rawRestaurants: RestaurantRaw[]) => {
    // 진행 중인 지오코딩 태스크 번호 갱신 (이전 루프 즉시 정지)
    const taskId = ++geocodingTaskIdRef.current;

    // 위경도 좌표가 없는 항목들을 수집
    const missingCoords = rawRestaurants.filter(
      r => r.latitude === undefined || r.longitude === undefined
    );

    if (missingCoords.length === 0) {
      // 모든 맛집의 좌표가 미리 채워진 경우
      const withIds = ensureRestaurantIds(rawRestaurants);
      setRestaurants(withIds);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(withIds));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
        alert('⚠️ 브라우저 로컬 저장공간이 초과되었습니다. 불필요한 데이터를 정리하거나 더 작은 크기의 엑셀 파일을 업로드해주세요.');
      }
      return;
    }

    setGeocodingProgress({ current: 0, total: missingCoords.length });

    const updatedRestaurants = [...rawRestaurants];
    let processedCount = 0;

    for (let i = 0; i < updatedRestaurants.length; i++) {
      // 비동기 루프 도중 신규 태스크 인입 시 현재 루프 중단
      if (taskId !== geocodingTaskIdRef.current) {
        console.log(`[Geocoding] Task ${taskId} aborted.`);
        return;
      }

      const res = updatedRestaurants[i];
      if (res.latitude === undefined || res.longitude === undefined) {
        processedCount++;
        setGeocodingProgress({ current: processedCount, total: missingCoords.length });

        let isCacheHit = false;
        if (res.address) {
          try {
            const cachedStr = localStorage.getItem('daedong_geocoding_cache');
            if (cachedStr) {
              const cache = JSON.parse(cachedStr);
              if (cache[res.address.trim()]) {
                isCacheHit = true;
              }
            }
          } catch {
            // ignore
          }
        }

        // 실시간 위경도 변환 API 요청
        if (res.address) {
          const coords = await geocodeAddress(res.address);
          
          // API 응답 직후 신규 태스크 인입 확인
          if (taskId !== geocodingTaskIdRef.current) {
            console.log(`[Geocoding] Task ${taskId} aborted after fetch.`);
            return;
          }

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

        // 지오코딩 속도 제한(초당 1회) 준수 - 캐시 미스일 때만 대기
        if (!isCacheHit && processedCount < missingCoords.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // 전역 상태에 머지하기 직전 경쟁 상태 최종 검증
    if (taskId !== geocodingTaskIdRef.current) {
      console.log(`[Geocoding] Task ${taskId} aborted before commit.`);
      return;
    }

    setGeocodingProgress(null);
    const withIds = ensureRestaurantIds(updatedRestaurants);
    setRestaurants(withIds);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(withIds));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      alert('⚠️ 브라우저 로컬 저장공간이 초과되었습니다. 불필요한 데이터를 정리하거나 더 작은 크기의 엑셀 파일을 업로드해주세요.');
    }
  };

  // 3. 맛집 데이터 초기화
  const handleResetData = () => {
    // 진행 중인 지오코딩 태스크가 있다면 취소
    geocodingTaskIdRef.current++;
    setGeocodingProgress(null);

    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setRestaurants([]);
    setSelectedRestaurant(null);
    setSearchQuery('');
    setSelectedCategory('전체');
    setSelectedRegion('전체');
    setMinRating(0);
  };

  // 4. GPS 기반 내 주변 맛집 찾기 구현 (고정밀 실패 시 일반정밀 Fallback 재시도 적용 - Bug 50)
  const handleGPSClick = () => {
    if (!navigator.geolocation) {
      alert('이 브라우저에서는 GPS 위치 정보 탐색을 지원하지 않습니다.');
      return;
    }

    // Reset filters to sync GPS search with map markers
    setSearchQuery('');
    setSelectedCategory('전체');
    setSelectedRegion('전체');
    setMinRating(0);

    const requestPosition = (highAccuracy: boolean) => {
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
          console.error(`GPS 내 위치 획득 실패 (highAccuracy=${highAccuracy}):`, error);
          if (highAccuracy) {
            console.log('GPS 고정밀 탐색 실패, 일반 정밀도로 재시도합니다...');
            requestPosition(false);
          } else {
            alert('내 위치 정보를 불러오지 못했습니다. 위치 권한이 비활성화되었거나 신호가 약할 수 있습니다.');
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          timeout: highAccuracy ? 7000 : 12000, 
          maximumAge: highAccuracy ? 0 : 30000 
        }
      );
    };

    requestPosition(true);
  };

  // 통합 맛집 선택 핸들러 (선택된 맛집이 현재 필터에 가려진 경우 필터를 자동 해제하여 화면에서 즉시 닫히지 않도록 방지)
  const handleSelectRestaurant = useCallback((restaurant: RestaurantRaw | null) => {
    if (restaurant) {
      // 1. 잠금 컬렉션 진입 여부 체크
      const isTop10 = top10Ids.includes(restaurant.id || '');
      const lockedTop10 = isTop10 && !unlockProgress.isUnlocked;

      if (lockedTop10) {
        alert('🔒 대동맛지도 전국 Top 10 노포는 단톡방 공유 3회 또는 미식 일기 2회 작성 시 열람할 수 있습니다!');
        window.dispatchEvent(new Event('daedong_show_unlock_modal'));
        return;
      }

      // 2. 현재 활성화된 필터 조건 검사
      const matchesCategory = selectedCategory === '전체' || restaurant.category === selectedCategory;
      const matchesRating = restaurant.rating >= minRating;
      const matchesRegion = selectedRegion === '전체' || restaurant.region === selectedRegion;
      
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        query === '' || 
        restaurant.name.toLowerCase().includes(query) || 
        restaurant.review.toLowerCase().includes(query) ||
        restaurant.address.toLowerCase().includes(query);

      const isVisible = matchesCategory && matchesRating && matchesRegion && matchesSearch;

      // 3. 필터 조건 불일치 시 필터 해제
      if (!isVisible) {
        setSelectedCategory('전체');
        setMinRating(0);
        setSelectedRegion('전체');
        setSearchQuery('');
      }

      // 4. 식당 이미지가 없을 경우 실시간 온디맨드 크롤링 (Cycle 26) - 검색 실패 시 'no_image' 캐싱 추가 (Bug 51)
      if (!restaurant.image) {
        const crawlQuery = restaurant.portalSearchName || `${restaurant.city || restaurant.region || ''} ${restaurant.name}`;
        fetch(`/api/crawl-image?query=${encodeURIComponent(crawlQuery)}`)
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Crawl failed');
          })
          .then(data => {
            const resolvedImage = data.image || 'no_image';
            setRestaurants(prev => {
              const next = prev.map(r => {
                if (r.id === restaurant.id) {
                  return { ...r, image: resolvedImage };
                }
                return r;
              });
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
              } catch (e) {
                console.error('Failed to save to localStorage:', e);
              }
              return next;
            });
            setSelectedRestaurant(prev => prev && prev.id === restaurant.id ? { ...prev, image: resolvedImage } : prev);
          })
          .catch(err => {
            console.error('Failed to crawl image on the fly:', err);
          });
      }
    }
    setSelectedRestaurant(restaurant);
  }, [top10Ids, unlockProgress.isUnlocked, selectedCategory, minRating, selectedRegion, searchQuery, setRestaurants]);

  // 딥링크 지원 (?restaurantId=... 또는 ?id=... 또는 ?route=id1,id2,id3)
  useEffect(() => {
    if (restaurants.length === 0) return;
    if (hasProcessedDeepLink.current) return;
    hasProcessedDeepLink.current = true;

    const params = new URLSearchParams(window.location.search);
    
    // 1. 단일 식당 딥링크
    const rId = params.get('restaurantId') || params.get('id');
    if (rId) {
      const matched = restaurants.find(r => r.id === rId || r.name === rId);
      if (matched) {
        const timer = setTimeout(() => {
          handleSelectRestaurant(matched);
          if (matched.latitude && matched.longitude && mapRef.current) {
            mapRef.current.setView([matched.latitude, matched.longitude], 15, { animate: true, duration: 1.0 });
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }

    // 2. 다중 식당 코스 플래너 딥링크 (?route=id1,id2,id3)
    const routeParam = params.get('route');
    if (routeParam) {
      const ids = routeParam.split(',');
      const matchedRoute: RestaurantRaw[] = [];
      ids.forEach(id => {
        const matched = restaurants.find(r => r.id === id.trim() || r.name === id.trim());
        if (matched) {
          matchedRoute.push(matched);
        }
      });
      if (matchedRoute.length > 0) {
        const timer = setTimeout(() => {
          setRouteRestaurants(matchedRoute.slice(0, 5));
        }, 0);
        return () => clearTimeout(timer);
      }
    }

    // 3. 틴더 매칭 궁합 링크 (?likes=...&senderName=...)
    const likesParam = params.get('likes');
    const senderNameParam = params.get('senderName');
    if (likesParam && senderNameParam) {
      setTimeout(() => {
        setIsToolkitOpen(true);
      }, 0);
    }
  }, [restaurants, mapRef, top10Ids, unlockProgress.isUnlocked, setIsToolkitOpen, selectedCategory, minRating, selectedRegion, searchQuery, handleSelectRestaurant]);

  // 4.5. 온보딩 맛 취향 웰컴 선택 자동 포커싱 및 줌
  useEffect(() => {
    if (!showWelcomeModal && restaurants.length > 0 && !hasAppliedOnboardingTaste.current) {
      hasAppliedOnboardingTaste.current = true;
      if (onboardingTaste && onboardingTaste !== '전체') {
        const categoryRestaurants = restaurants.filter(r => r.category === onboardingTaste);
        if (categoryRestaurants.length > 0) {
          const sorted = [...categoryRestaurants].sort((a, b) => b.rating - a.rating);
          const topRest = sorted[0];

          setTimeout(() => {
            handleSelectRestaurant(topRest);
            if (topRest.latitude && topRest.longitude && mapRef.current) {
              mapRef.current.setView([topRest.latitude, topRest.longitude], 15, { animate: true, duration: 1.0 });
            }
          }, 100);
        }
      }
    }
  }, [showWelcomeModal, restaurants, onboardingTaste, handleSelectRestaurant]);

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
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((res) => {
      // If locked, exclude top 10 from general list/markers
      const isTop10 = top10Ids.includes(res.id || '');
      if (isTop10 && !unlockProgress.isUnlocked) {
        return false;
      }

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
  }, [restaurants, top10Ids, unlockProgress.isUnlocked, selectedCategory, minRating, selectedRegion, searchQuery]);

  // Bug 35: Clear selectedRestaurant if it gets filtered out
  useEffect(() => {
    if (selectedRestaurant) {
      const isStillVisible = filteredRestaurants.some(r => r.id === selectedRestaurant.id);
      if (!isStillVisible) {
        setTimeout(() => {
          setSelectedRestaurant(null);
        }, 0);
      }
    }
  }, [filteredRestaurants, selectedRestaurant]);

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
            onLoadDefaultData={async () => {
              try {
                console.log('기본 맛집 데이터 직접 로드 중...');
                const response = await fetch('/restaurants.json');
                if (response.ok) {
                  const data = await response.json();
                  const withIds = ensureRestaurantIds(data);
                  setRestaurants(withIds);
                  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(withIds));
                } else {
                  alert('기본 맛집 파일을 서버에서 찾을 수 없습니다.');
                }
              } catch (err) {
                console.error(err);
                alert('기본 데이터를 불러오는 도중 오류가 발생했습니다.');
              }
            }}
          />
        </div>
      ) : (
        // 맛집 데이터가 존재할 시 인터랙티브 지도 서비스 화면 노출
        <>
          {/* 오픈스트리트맵 레이어 */}
          <GourmetMap 
            restaurants={filteredRestaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={handleSelectRestaurant}
            mapRef={mapRef}
            routeRestaurants={routeRestaurants}
          />

          {/* 좌측 사이드바 패널 (목록, 필터, 대시보드 내장) */}
          <Sidebar
            restaurants={restaurants}
            filteredRestaurants={filteredRestaurants}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={handleSelectRestaurant}
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
            unlockProgress={unlockProgress}
            top10Ids={top10Ids}
            onOpenToolkitTab={handleOpenToolkitTab}
          />

          {/* 우하단 개별 맛집 정보 상세 오버레이 카드 */}
          <DetailPanel 
            key={selectedRestaurant?.id || 'none'}
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
              handleSelectRestaurant(rest);
              if (rest.latitude && rest.longitude && mapRef.current) {
                mapRef.current.setView([rest.latitude, rest.longitude], 15, { animate: true, duration: 1.0 });
              }
            }}
            visitedRestaurants={visitedRestaurants}
            isMobile={isMobile}
            routeRestaurants={routeRestaurants}
            setRouteRestaurants={setRouteRestaurants}
            isUnlocked={unlockProgress.isUnlocked}
            defaultTab={toolkitTab}
          />

          {/* 웰컴 및 PWA 홈화면 앱 설치 가이드 온보딩 모달 */}
          {showWelcomeModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(3, 7, 18, 0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
              padding: '16px'
            }}>
              <div 
                className="glass-panel animate-fade-in"
                style={{
                  maxWidth: '540px',
                  width: '100%',
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  border: '1.5px solid var(--accent-cyan)',
                  boxShadow: '0 0 35px rgba(6, 182, 212, 0.25)',
                  textAlign: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-orange)', letterSpacing: '0.15em', marginBottom: '4px' }}>
                    7-YEAR FIELD VERIFIED MAP
                  </div>
                  <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.02em', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    대동맛지도 📍
                  </h2>
                  <p style={{ color: 'var(--accent-cyan)', fontSize: '13px', fontWeight: '700', marginTop: '6px' }}>
                    7년 동안 직접 발로 뛰며 맛을 검증한 전국 진짜 노포 지도
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  padding: '16px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  lineHeight: '1.5'
                }}>
                  <div style={{ color: '#cbd5e1' }}>
                    🍊 <strong style={{ color: 'var(--accent-orange)' }}>광고 대가 없는 순도 100% 검증</strong>: 평점 마케팅, 네이버 플레이스 순위 광고 필터링! 현지인 보증 노포와 찐맛집 824곳을 한눈에 살펴보세요.
                  </div>
                  <div style={{ color: '#cbd5e1' }}>
                    🎮 <strong style={{ color: 'var(--accent-purple)' }}>풍성한 인터랙티브 툴킷</strong>: 룰렛 추천, 미식 MBTI 궁합 매칭, 노포 이상형 월드컵 및 단톡방 회식 예약 초대장까지 제공합니다.
                  </div>

                  {/* 선호 카테고리 퀵 선택 */}
                  <div style={{
                    borderTop: '1px dashed rgba(255,255,255,0.08)',
                    paddingTop: '12px',
                    marginTop: '4px'
                  }}>
                    <strong style={{ color: 'var(--accent-cyan)', display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: '800' }}>🎯 선호하는 맛집 취향을 선택해 보세요! (첫 로드 최적화)</strong>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '6px'
                    }}>
                      {[
                        { id: '한식', name: '🍜 노포/국밥' },
                        { id: '육류', name: '🥩 육류/고기' },
                        { id: '일식', name: '🍣 일식/초밥' },
                        { id: '중식', name: '🥢 중식/마라' },
                        { id: '양식', name: '🍕 양식/파스타' },
                        { id: '전체', name: '🍽️ 전체보기' }
                      ].map((item) => {
                        const isSelected = onboardingTaste === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setOnboardingTaste(item.id)}
                            style={{
                              padding: '8px 4px',
                              borderRadius: '6px',
                              background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.08)'}`,
                              color: isSelected ? '#ffffff' : '#cbd5e1',
                              fontSize: '11px',
                              fontWeight: isSelected ? '800' : '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: isSelected ? '0 0 8px rgba(6, 182, 212, 0.25)' : 'none'
                            }}
                          >
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div style={{
                    borderTop: '1px dashed rgba(255,255,255,0.08)',
                    paddingTop: '12px',
                    marginTop: '4px'
                  }}>
                    <strong style={{ color: 'var(--accent-yellow)', display: 'block', marginBottom: '6px' }}>📲 스마트폰에 바로가기 앱(PWA) 설치 가이드</strong>
                    <span style={{ color: '#cbd5e1', fontSize: '11px' }}>
                      브라우저 주소창 없이 네이티브 스마트폰 어플처럼 쾌적하게 사용하는 방법:
                    </span>
                    <ul style={{ paddingLeft: '16px', margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <li><strong>iOS (Safari)</strong>: 하단 툴바의 <span style={{ color: '#fff' }}>[공유/내보내기]</span> 아이콘을 탭한 후, 목록에서 <span style={{ color: '#fff' }}>[홈 화면에 추가]</span>를 선택하세요.</li>
                      <li><strong>Android (Chrome)</strong>: 우측 상단 메뉴 <span style={{ color: '#fff' }}>[더보기/점세개]</span>를 누르고, <span style={{ color: '#fff' }}>[앱 설치]</span> 또는 <span style={{ color: '#fff' }}>[홈 화면에 추가]</span>를 선택하세요.</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={handleCloseWelcomeModal}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(6, 182, 212, 0.25)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(6, 182, 212, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(6, 182, 212, 0.25)';
                  }}
                >
                  대동맛지도 시작하기 📍
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
