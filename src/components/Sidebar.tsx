import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, MapPin, Compass, Navigation, BarChart3, X } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';
import L from 'leaflet';
import { CATEGORY_IMAGES } from '../constants/images';

const safeCopyToClipboard = (text: string): Promise<void> => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise<void>((resolve, reject) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        resolve();
      } else {
        reject(new Error('Fallback copy failed'));
      }
    } catch (err) {
      reject(err);
    }
  });
};

const getShareOrigin = (): string => {
  const origin = window.location.origin;
  if (!origin || origin.includes('localhost') || origin.includes('capacitor://') || origin.includes('file://')) {
    return 'https://daedong.matjido.app';
  }
  return origin;
};

interface SidebarProps {
  restaurants: RestaurantRaw[];
  filteredRestaurants: RestaurantRaw[];
  selectedRestaurant: RestaurantRaw | null;
  onSelectRestaurant: (restaurant: RestaurantRaw) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedRegion: string;
  setSelectedRegion: (region: string) => void;
  onResetData: () => void;
  onGPSClick: () => void; // GPS 버튼 클릭 핸들러
  isMobile?: boolean;
  mapRef: React.MutableRefObject<L.Map | null>;
  unlockProgress: { shares: number; logs: number; isUnlocked: boolean };
  top10Ids: string[];
  onOpenToolkitTab?: (tab: 'roulette' | 'mbti' | 'couple' | 'worldcup' | 'share' | 'instagram' | 'shop' | 'course' | 'quiz') => void;
}

// 카테고리별 아이콘 배지 매핑
const CATEGORY_EMOJIS: Record<string, string> = {
  '전체': '🍴',
  '한식': '🍜',
  '중식': '🥢',
  '일식': '🍣',
  '양식': '🍕',
  '분식': '🍢',
  '육류': '🥩',
  '기타': '🍽️'
};

const categories = ['전체', '한식', '중식', '일식', '양식', '분식', '육류', '기타'];

export default function Sidebar({
  restaurants,
  filteredRestaurants,
  selectedRestaurant,
  onSelectRestaurant,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedRegion,
  setSelectedRegion,
  onResetData,
  onGPSClick,
  isMobile = false,
  mapRef,
  unlockProgress,
  top10Ids,
  onOpenToolkitTab
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reportModalRef = useRef<HTMLDivElement | null>(null);
  const unlockModalRef = useRef<HTMLDivElement | null>(null);
  const shakeModalRef = useRef<HTMLDivElement | null>(null);

  // Shake Match State & Refs
  const [shakeResultRestaurant, setShakeResultRestaurant] = useState<RestaurantRaw | null>(null);
  const isShufflingRef = useRef(false);

  // 고유 카테고리 추출

  // 동적 지역별 분포 계산
  const regionsSorted = useMemo(() => {
    const regionMap: Record<string, number> = {};
    restaurants.forEach((r) => {
      if (r.region) {
        regionMap[r.region] = (regionMap[r.region] || 0) + 1;
      }
    });

    return Object.entries(regionMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [restaurants]);

  // Bug 7: invalidateSize on collapse/expand transition or resize
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [isCollapsed, isMobile, mapRef]);

  // Bug 8: disableScrollPropagation & disableClickPropagation on Sidebar
  // Leaflet's disableClickPropagation stops touchstart, which is sufficient to prevent map panning on scroll.
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.disableClickPropagation(container);
    }
  }, []);

  useEffect(() => {
    if (showUnlockModal && unlockModalRef.current) {
      L.DomEvent.disableScrollPropagation(unlockModalRef.current);
      L.DomEvent.disableClickPropagation(unlockModalRef.current);
    }
  }, [showUnlockModal]);

  useEffect(() => {
    if (shakeResultRestaurant && shakeModalRef.current) {
      L.DomEvent.disableScrollPropagation(shakeModalRef.current);
      L.DomEvent.disableClickPropagation(shakeModalRef.current);
    }
  }, [shakeResultRestaurant]);

  // Cycle 22: Shake / Sensor Match deciding logic
  const triggerShake = useCallback(() => {
    if (isShufflingRef.current) return;
    isShufflingRef.current = true;
    
    let count = 0;
    const interval = setInterval(() => {
      // Pick random filters for machine slot animation effect
      const randCat = categories[Math.floor(Math.random() * categories.length)];
      const randReg = regionsSorted.length > 0 
        ? regionsSorted[Math.floor(Math.random() * regionsSorted.length)].name 
        : '전체';
      setSelectedCategory(randCat);
      setSelectedRegion(randReg);
      count++;
      
      if (count > 8) {
        clearInterval(interval);
        
        // Final Selection: pick a random restaurant from the main list (excluding locked Top 10)
        if (restaurants.length > 0) {
          const candidates = restaurants.filter(
            r => !(top10Ids.includes(r.id || '') && !unlockProgress.isUnlocked)
          );
          if (candidates.length > 0) {
            const finalRest = candidates[Math.floor(Math.random() * candidates.length)];
            setSelectedCategory(finalRest.category || '전체');
            setSelectedRegion(finalRest.region || '전체');
            
            onSelectRestaurant(finalRest);
            setShakeResultRestaurant(finalRest);
            
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
          }
        }
        isShufflingRef.current = false;
      }
    }, 100);
  }, [restaurants, regionsSorted, setSelectedCategory, setSelectedRegion, onSelectRestaurant, top10Ids, unlockProgress.isUnlocked]);

  // Request sensor permission and trigger
  const handleShakeTrigger = async () => {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (permissionState === 'granted') {
          triggerShake();
        } else {
          triggerShake();
        }
      } catch (err) {
        console.error('Sensor permission request failed:', err);
        triggerShake();
      }
    } else {
      triggerShake();
    }
  };

  // Add devicemotion listener for shake detection
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastTime = 0;
    let shakeCount = 0;
    let lastShakeTime = 0;
    const SHAKE_THRESHOLD = 80; // 민감도를 낮추기 위해 임계값 대폭 상향 (기존 15)

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;

      const currentTime = Date.now();
      if ((currentTime - lastTime) > 100) {
        const diffTime = currentTime - lastTime;
        lastTime = currentTime;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;

        // 각 축의 변화량 절댓값 합산 (동적 움직임 축적)
        const change = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
        const speed = (change / diffTime) * 10000;

        if (speed > SHAKE_THRESHOLD * 10) {
          // 마지막 흔들림이 1초보다 길면 흔들기 횟수 리셋
          if (currentTime - lastShakeTime > 1000) {
            shakeCount = 0;
          }
          shakeCount++;
          lastShakeTime = currentTime;

          // 짧은 시간(1초) 내에 강하게 4번 이상 흔들었을 때만 셔플 매칭 발동
          if (shakeCount >= 4) {
            triggerShake();
            shakeCount = 0;
          }
        }

        lastX = x;
        lastY = y;
        lastZ = z;
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [triggerShake]);

  // Bug 32: Listen for custom event to trigger unlock modal from deep link block
  useEffect(() => {
    const handleShowUnlock = () => {
      setShowUnlockModal(true);
    };
    window.addEventListener('daedong_show_unlock_modal', handleShowUnlock);
    return () => {
      window.removeEventListener('daedong_show_unlock_modal', handleShowUnlock);
    };
  }, []);

  // 1. 맛집 제보 모달 상태
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportAddress, setReportAddress] = useState('');
  const [reportMenu, setReportMenu] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (showReportModal && reportModalRef.current) {
      L.DomEvent.disableScrollPropagation(reportModalRef.current);
      L.DomEvent.disableClickPropagation(reportModalRef.current);
    }
  }, [showReportModal]);

  // 2. 지하철역 중간지점 탐색 상태
  const [showStationSearch, setShowStationSearch] = useState(false);
  const [showToolkitSection, setShowToolkitSection] = useState(!isMobile);
  const [station1, setStation1] = useState('');
  const [station2, setStation2] = useState('');

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportName || !reportAddress || !reportReason) {
      alert('필수 제보 정보(식당 상호명, 주소, 추천 사유)를 입력해 주세요!');
      return;
    }
    setReportSuccess(true);
    setTimeout(() => {
      setReportSuccess(false);
      setShowReportModal(false);
      setReportName('');
      setReportAddress('');
      setReportMenu('');
      setReportReason('');
    }, 2200);
  };

  const handleStationSearch = () => {
    if (!station1.trim() || !station2.trim()) {
      alert('두 개의 약속 장소(도시명 또는 구/역 이름)를 입력해 주세요!');
      return;
    }
    const term1 = station1.trim().toLowerCase();
    const term2 = station2.trim().toLowerCase();

    const matches1 = restaurants.filter(r => r.address.toLowerCase().includes(term1));
    const matches2 = restaurants.filter(r => r.address.toLowerCase().includes(term2));

    if (matches1.length === 0 || matches2.length === 0) {
      alert('두 출발지 모두 근처에 맛집이 있어야 중간 지점을 찾을 수 있습니다. 두 출발지 각각의 맛집을 찾을 수 있는 지역명(예: 서울, 강릉, 부산 등)을 정확히 입력해 주세요.');
      return;
    }

    let sumLat1 = 0, sumLng1 = 0, count1 = 0;
    matches1.forEach(r => {
      if (r.latitude && r.longitude) {
        sumLat1 += r.latitude;
        sumLng1 += r.longitude;
        count1++;
      }
    });

    let sumLat2 = 0, sumLng2 = 0, count2 = 0;
    matches2.forEach(r => {
      if (r.latitude && r.longitude) {
        sumLat2 += r.latitude;
        sumLng2 += r.longitude;
        count2++;
      }
    });

    if (count1 === 0 || count2 === 0) {
      alert('두 출발지 근처 맛집 중 위도/경도 좌표가 존재하는 식당이 부족하여 연산할 수 없습니다.');
      return;
    }

    const avgLat1 = sumLat1 / count1;
    const avgLng1 = sumLng1 / count1;

    const avgLat2 = sumLat2 / count2;
    const avgLng2 = sumLng2 / count2;

    const midpointLat = (avgLat1 + avgLat2) / 2;
    const midpointLng = (avgLng1 + avgLng2) / 2;

    if (mapRef.current) {
      mapRef.current.setView([midpointLat, midpointLng], 11, { animate: true, duration: 1.2 });
      alert(`두 지역 매칭 완료! 양측 대표 맛집들의 1:1 정중앙 지점(위도: ${midpointLat.toFixed(4)}, 경도: ${midpointLng.toFixed(4)})으로 지도 시점이 이동되었습니다.`);
    }
  };



  return (
    <div 
      ref={containerRef}
      className="glass-panel"
      style={{
        position: 'absolute',
        top: isMobile ? '8px' : '16px',
        bottom: isMobile ? '8px' : '16px',
        left: isMobile ? '8px' : '16px',
        right: isMobile ? (isCollapsed ? 'auto' : '8px') : 'auto',
        width: isCollapsed ? '0px' : (isMobile ? 'calc(100% - 16px)' : '410px'),
        maxWidth: isMobile ? 'none' : '410px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s, right 0.3s',
        padding: isCollapsed ? '0px' : (isMobile ? '16px' : '24px'),
        borderWidth: isCollapsed ? '0px' : '1px',
        overflow: 'visible'
      }}
    >
      {/* 접기/펴기 조작 버튼 (사이버펑크 네온 테마 - collapsed 상태이거나 데스크탑 환경일 때만 절대경로 렌더링) */}
      {(isCollapsed || !isMobile) && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: 'absolute',
            top: '24px',
            right: '-32px',
            width: '32px',
            height: '48px',
            borderRadius: '0 8px 8px 0',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid var(--border-glass)',
            borderLeft: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            color: '#f8fafc',
            boxShadow: '4px 0 12px rgba(0,0,0,0.25)',
            fontSize: '11px',
            writingMode: 'vertical-lr',
            fontWeight: '700',
            zIndex: 1001
          }}
        >
          {isCollapsed ? '펼치기' : '접기'}
        </button>
      )}

      {/* 사이드바 콘텐츠 */}
      {!isCollapsed && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          width: '100%',
          overflow: 'hidden'
        }}>
          
          {/* 1. 고정 영역 (Sticky Header): 헤더 + 검색창 + 카테고리/지역 필터 + 검색결과 카운트 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0,
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            width: '100%'
          }}>
            {/* 최상단 헤더 영역 */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-orange)', letterSpacing: '0.15em', marginBottom: '2px' }}>
                大東味地圖
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.03em', lineHeight: '1.1' }}>
                    대동맛지도
                  </h1>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px', fontWeight: '500' }}>
                    전국 방방곡곡의 면밀한 맛집 탐색기
                  </p>
                </div>
                
                {/* 우측 조작 버튼 그룹 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* 목록 비우기 리셋 버튼 */}
                  <button
                    onClick={onResetData}
                    style={{
                      fontSize: '11px',
                      color: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.15)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                  >
                    목록 비우기
                  </button>

                  {/* 모바일 버전 전용 접기 버튼 */}
                  {isMobile && (
                    <button
                      onClick={() => setIsCollapsed(true)}
                      style={{
                        fontSize: '11px',
                        color: '#f8fafc',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                      접기
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 검색창 */}
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="식당명, 메뉴, 지역, 키워드로 서치..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px 11px 36px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-glass)'}
              />
            </div>

            {/* 카테고리 & 지역 필터 (모바일에서는 콤팩트 select 콤보박스로 1열 정렬, 데스크톱에서는 기존의 뱃지 레이아웃) */}
            {isMobile ? (
              <div style={{ display: 'flex', gap: '8px', width: '100%', flexShrink: 0 }}>
                {/* 카테고리 셀렉트 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-yellow)', letterSpacing: '0.05em' }}>음식 카테고리</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1.5px solid var(--accent-yellow)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '700',
                      outline: 'none',
                      boxShadow: '0 0 10px rgba(234, 179, 8, 0.1)',
                      cursor: 'pointer'
                    }}
                  >
                    {categories.map((cat, idx) => (
                      <option key={idx} value={cat} style={{ background: '#0f172a', color: '#fff' }}>
                        {(CATEGORY_EMOJIS[cat] || '🍽️') + ' ' + cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 지역 셀렉트 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>지역 분포 필터</label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1.5px solid var(--accent-cyan)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '700',
                      outline: 'none',
                      boxShadow: '0 0 10px rgba(6, 182, 212, 0.1)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="전체" style={{ background: '#0f172a', color: '#fff' }}>
                      전체 ({restaurants.length})
                    </option>
                    {regionsSorted.map((reg, idx) => (
                      <option key={idx} value={reg.name} style={{ background: '#0f172a', color: '#fff' }}>
                        {reg.name} ({reg.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <>
                {/* 카테고리 필터 (뱃지 스타일) */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  width: '100%'
                }}>
                  {categories.map((cat, idx) => {
                    const isActive = selectedCategory === cat;
                    const emoji = CATEGORY_EMOJIS[cat] || '🍽️';
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                          whiteSpace: 'nowrap',
                          padding: '7px 13px',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: isActive ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.06)',
                          background: isActive ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.03)',
                          color: isActive ? '#0f172a' : 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{emoji}</span>
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 지역별 맛도리 분포 필터 버튼 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={12} style={{ color: 'var(--accent-cyan)' }} />
                    지역별 맛도리 분포
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '6px', 
                    flexWrap: 'wrap', 
                    paddingBottom: '2px' 
                  }}>
                    {/* 전체 지역 지역 버튼 */}
                    <button
                      onClick={() => setSelectedRegion('전체')}
                      style={{
                        whiteSpace: 'nowrap',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: selectedRegion === '전체' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.04)',
                        background: selectedRegion === '전체' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.02)',
                        color: selectedRegion === '전체' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>전체</span>
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                        {restaurants.length}
                      </span>
                    </button>

                    {/* 정렬된 지역 버튼 렌더링 */}
                    {regionsSorted.map((reg, idx) => {
                      const isActive = selectedRegion === reg.name;
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedRegion(reg.name)}
                          style={{
                            whiteSpace: 'nowrap',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.04)',
                            background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.02)',
                            color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>{reg.name}</span>
                          <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '4px', color: '#94a3b8' }}>
                            {reg.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 검색 결과 카운트 정보 */}
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              검색된 맛집 <span style={{ color: 'var(--accent-yellow)' }}>{filteredRestaurants.length}</span>개
            </div>
          </div>

          {/* 2. 스크롤 영역 (Scrollable Content): 나머지 기능 위젯 + 맛집 리스트 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            paddingTop: '12px',
            paddingRight: '4px',
            minHeight: 0
          }}>
            {/* 7년 실방문 보증 네온 배너 (데스크톱 전용) */}
            {!isMobile && (
              <div style={{
                background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                lineHeight: '1.4',
                color: '#ffedd5',
                fontWeight: '600',
                boxShadow: '0 0 10px rgba(249, 115, 22, 0.1)',
                flexShrink: 0
              }}>
                🍊 <span style={{ color: 'var(--accent-orange)', fontWeight: '800' }}>7년 간 직접 가본 맛집으로만 만든 최고의 대동맛지도!</span>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: '500' }}>
                  광고나 홍보 대가 없는 순도 100% 현지인 검증 노포/맛집 824곳을 조망하세요.
                </div>
              </div>
            )}

            {/* GPS 및 맛집 제보 버튼 그룹 */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', flexShrink: 0 }}>
              <button
                onClick={onGPSClick}
                style={{
                  flex: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: '1px solid var(--accent-yellow)',
                  background: 'rgba(234, 179, 8, 0.03)',
                  color: 'var(--accent-yellow)',
                  borderRadius: '8px',
                  padding: '11px 0',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(234, 179, 8, 0.1)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(234, 179, 8, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(234, 179, 8, 0.03)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Navigation size={13} style={{ transform: 'rotate(45deg)' }} />
                내 주변 맛집 (GPS)
              </button>

              <button
                onClick={() => setShowReportModal(true)}
                style={{
                  flex: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  border: '1px solid var(--accent-orange)',
                  background: 'rgba(249, 115, 22, 0.03)',
                  color: 'var(--accent-orange)',
                  borderRadius: '8px',
                  padding: '11px 0',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 115, 22, 0.1)';
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(249, 115, 22, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(249, 115, 22, 0.03)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                ✍️ 맛집 제보
              </button>
            </div>

            {/* 지하철역 기준 중간지점 맛집 검색 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => setShowStationSearch(!showStationSearch)}
                style={{
                  width: '100%',
                  background: 'rgba(6, 182, 212, 0.03)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  color: 'var(--accent-cyan)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>🚇 중간지점 맛집 찾기</span>
                <span>{showStationSearch ? '▼' : '▶'}</span>
              </button>

              {showStationSearch && (
                <div 
                  className="animate-fade-in"
                  style={{
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-glass)',
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    친구와 나의 중간 지점(예: 신도림, 강남, 홍대 등) 맛집을 탐색합니다.
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="text" 
                      placeholder="출발지 1 (예: 강남)"
                      value={station1}
                      onChange={(e) => setStation1(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none' }}
                    />
                    <input 
                      type="text" 
                      placeholder="출발지 2 (예: 신촌)"
                      value={station2}
                      onChange={(e) => setStation2(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none' }}
                    />
                  </div>
                  <button
                    onClick={handleStationSearch}
                    style={{
                      padding: '8px 0',
                      background: 'var(--accent-cyan)',
                      color: '#020617',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    중간영역 검색 및 이동
                  </button>
                </div>
              )}
            </div>

            {/* 흔들어서 결정 (Shake/Shuffle) 버튼 */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', flexShrink: 0 }}>
              <button
                onClick={handleShakeTrigger}
                className="animate-pulse-cyan"
                style={{
                  width: '100%',
                  background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.1) 0%, rgba(6, 182, 212, 0.1) 100%)',
                  border: '1.5px dashed var(--accent-pink)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 12px rgba(236, 72, 153, 0.15)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(236, 72, 153, 0.18)';
                  e.currentTarget.style.borderColor = 'var(--accent-pink)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(236, 72, 153, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.5)';
                  e.currentTarget.style.boxShadow = '0 0 12px rgba(236, 72, 153, 0.15)';
                }}
              >
                <span>📳</span>
                <span>휴대폰 흔들기 또는 랜덤 셔플 🎲</span>
              </button>
            </div>

            {/* 전체 분석 리포트 카드 (데스크톱 전용) */}
            {!isMobile && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.03)',
                border: '1px solid rgba(139, 92, 246, 0.18)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flexShrink: 0
              }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={12} />
                  전체 분석리포트
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div>
                    강세 카테고리: <span style={{ color: '#f8fafc', fontWeight: '600' }}>한식(571곳), 기타(114곳)</span>
                  </div>
                  <div>
                    추천 대표메뉴: <span style={{ color: '#f8fafc', fontWeight: '600' }}>양꼬치, 돈까스, 매운탕</span>
                  </div>
                </div>
              </div>
            )}

            {/* 스폰서 광고 슬롯 (데스크톱 전용) */}
            {!isMobile && (
              <div className="ad-slot-box" style={{ flexShrink: 0 }}>
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '8px',
                  fontSize: '8px',
                  fontWeight: '700',
                  color: 'var(--accent-yellow)',
                  letterSpacing: '0.08em',
                  background: 'rgba(234, 179, 8, 0.08)',
                  padding: '1px 4px',
                  borderRadius: '3px'
                }}>
                  SPONSOR
                </span>
                <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: '700', marginBottom: '2px' }}>
                  광고 영역 (Ad Slot)
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                  구글 애드센스 광고가 게재될 공간입니다.
                </div>
              </div>
            )}

            {/* 🎮 미식 툴킷 즐길거리 (Interactive Tools) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => setShowToolkitSection(!showToolkitSection)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  color: '#f8fafc',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 0 10px rgba(6, 182, 212, 0.1)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🎮 대동맛지도 미식 툴킷 <span style={{ fontSize: '10px', fontWeight: '500', color: 'var(--accent-cyan)' }}>INTERACTIVE</span>
                </span>
                <span>{showToolkitSection ? '▼' : '▶'}</span>
              </button>

              {showToolkitSection && (
                <div 
                  className="animate-fade-in"
                  style={{
                    background: 'rgba(15, 23, 42, 0.45)',
                    border: '1px solid var(--border-glass)',
                    padding: '12px',
                    borderRadius: '10px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px'
                  }}
                >
                  {([
                    { id: 'roulette', name: '맛집 룰렛', icon: '🎯', desc: '결정장애 해소' },
                    { id: 'mbti', name: '미식 MBTI', icon: '🧠', desc: '스와이프 성향분석' },
                    { id: 'couple', name: '커플 궁합', icon: '👩‍❤️‍👨', desc: '데이트 식당 매칭' },
                    { id: 'worldcup', name: '이상형 월드컵', icon: '🏆', desc: '최애 노포 8강전' },
                    { id: 'share', name: '약속 메이커', icon: '💬', desc: '초대장 공유' },
                    { id: 'instagram', name: '인스타 카드', icon: '📸', desc: '인증서&Wrapped' },
                    { id: 'quiz', name: '미식 퀴즈', icon: '✏️', desc: '역사 맞추기' },
                    { id: 'shop', name: '기프트 샵', icon: '🎁', desc: '대동 굿즈' }
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onOpenToolkitTab?.(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                        e.currentTarget.style.background = 'rgba(6, 182, 212, 0.05)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>{item.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#f8fafc' }}>{item.name}</span>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{item.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Top 10 Featured Collection */}
            <div style={{
              background: 'rgba(236, 72, 153, 0.05)',
              border: '1.5px solid var(--accent-pink)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 0 15px rgba(236, 72, 153, 0.15)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👑 대동맛지도 전국 Top 10 인기 노포</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {top10Ids
                  .map(id => restaurants.find(r => r.id === id))
                  .filter((res): res is RestaurantRaw => !!res)
                  .map((res, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!unlockProgress.isUnlocked) {
                          setShowUnlockModal(true);
                        } else {
                          onSelectRestaurant(res);
                        }
                      }}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: 'rgba(30, 41, 59, 0.35)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-pink)';
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.55)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.35)';
                      }}
                    >
                      <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: '600' }}>
                        {idx + 1}. {res.name}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent-pink)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {!unlockProgress.isUnlocked && <span>🔒</span>}
                        {res.category} | {res.region || '전국'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* 맛집 리스트 카드 목록 */}
            {filteredRestaurants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                🔍 조건에 일치하는 맛집이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
                {filteredRestaurants.map((res, idx) => {
                  const isLockedItem = false;
                  const isSelected = selectedRestaurant?.id === res.id;
                  const isSponsored = res.name === '경상도집' || res.name === '굴다리식당';
                  
                  // 음식 종류에 따라 배지 컬러 지정
                  let badgeBg = 'rgba(249, 115, 22, 0.1)';
                  let badgeColor = 'var(--accent-orange)';
                  if (res.category === '일식') {
                    badgeBg = 'rgba(59, 130, 246, 0.1)';
                    badgeColor = 'var(--accent-blue)';
                  } else if (res.category === '중식') {
                    badgeBg = 'rgba(139, 92, 246, 0.1)';
                    badgeColor = 'var(--accent-purple)';
                  } else if (res.category === '양식') {
                    badgeBg = 'rgba(16, 185, 129, 0.1)';
                    badgeColor = 'var(--accent-green)';
                  } else if (res.category === '분식') {
                    badgeBg = 'rgba(236, 72, 153, 0.1)';
                    badgeColor = 'var(--accent-pink)';
                  }

                  const fallbackImage = CATEGORY_IMAGES[res.category]?.[0] || CATEGORY_IMAGES['기타'][0];
                  const initialImage = res.image && res.image !== 'no_image' ? res.image : fallbackImage;

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (isLockedItem) {
                          setShowUnlockModal(true);
                        } else {
                          onSelectRestaurant(res);
                        }
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'rgba(30, 41, 59, 0.35)',
                        border: isSelected 
                          ? '1.5px solid var(--accent-cyan)' 
                          : (isSponsored ? '1.5px solid rgba(234, 179, 8, 0.45)' : '1.5px solid rgba(255, 255, 255, 0.04)'),
                        boxShadow: isSponsored && !isSelected
                          ? '0 0 10px rgba(234, 179, 8, 0.15)'
                          : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.25s',
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '12px',
                        filter: isLockedItem ? 'blur(4.5px)' : 'none',
                        opacity: isLockedItem ? 0.5 : 1,
                        userSelect: isLockedItem ? 'none' : 'auto'
                      }}
                      onMouseEnter={(e) => {
                        if (isLockedItem) return;
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = isSponsored ? 'var(--accent-yellow)' : 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isLockedItem) return;
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = isSponsored ? 'rgba(234, 179, 8, 0.45)' : 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.35)';
                        }
                      }}
                    >
                      {/* 썸네일 이미지 */}
                      <div style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}>
                        <img 
                          src={initialImage} 
                          alt={res.name}
                          referrerPolicy="no-referrer"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            if (e.currentTarget.src !== fallbackImage) {
                              e.currentTarget.src = fallbackImage;
                            }
                          }}
                        />
                      </div>

                      {/* 우측 상세 정보 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        {/* 카드 헤더 (음식종류, 상호명, 주소) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '75%', minWidth: 0 }}>
                            <span style={{
                              fontSize: '9px',
                              fontWeight: '800',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: badgeBg,
                              color: badgeColor,
                              flexShrink: 0
                            }}>
                              {res.category}
                            </span>
                            {isSponsored && (
                              <span style={{
                                fontSize: '8px',
                                fontWeight: '800',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: 'rgba(234, 179, 8, 0.12)',
                                color: 'var(--accent-yellow)',
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                flexShrink: 0
                              }}>
                                🌟 제휴
                              </span>
                            )}
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {res.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                            <MapPin size={9} />
                            {res.city || res.region || '전국'}
                          </span>
                        </div>

                        {/* 대표메뉴 */}
                        {res.menu && (
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                            메뉴: <span style={{ color: '#cbd5e1', fontWeight: '500' }}>{res.menu}</span>
                          </div>
                        )}

                        {/* 추천사유 본문 */}
                        {res.review && (
                          <p style={{
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.3',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            margin: 0
                          }}>
                            {res.review}
                          </p>
                        )}

                        {/* 네온 하단 태그 */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                          <span style={{
                            fontSize: '8px',
                            fontWeight: '700',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            background: 'rgba(16, 185, 129, 0.04)',
                            color: 'var(--accent-green)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent-green)' }}></span>
                            핀 활성화
                          </span>
                          <span style={{
                            fontSize: '8px',
                            fontWeight: '700',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            border: '1px solid rgba(139, 92, 246, 0.25)',
                            background: 'rgba(139, 92, 246, 0.04)',
                            color: 'var(--accent-purple)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--accent-purple)' }}></span>
                            실사진
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 맛집 제보 모달 팝업 */}
      {showReportModal && (
        <div ref={reportModalRef} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 17, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }} className="animate-fade-in">
          <div style={{
            width: '100%',
            maxWidth: '340px',
            background: 'var(--bg-secondary)',
            border: '1.5px solid var(--accent-orange)',
            borderRadius: '12px',
            padding: '24px',
            position: 'relative',
            boxShadow: '0 0 25px rgba(249, 115, 22, 0.2)'
          }}>
            <button 
              onClick={() => setShowReportModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>

            {reportSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }} className="animate-fade-in">
                <span style={{ fontSize: '32px' }}>🍜</span>
                <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc', marginTop: '12px' }}>제보 완료!</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.5' }}>
                  소중한 제보 감사합니다.<br />
                  7년 실방문 맛집 보증 위원회 검증 완료 시,<br />
                  상세 페이지 상단에 제보자로 영구 박제됩니다!
                </p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc' }}>✍️ 찐 로컬 맛집 제보</h4>
                  <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>대동맛지도 7년 실방문 맛집 보증단에 제보하세요.</p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>맛집 상호명 *</label>
                  <input 
                    type="text" 
                    value={reportName}
                    onChange={e => setReportName(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                    placeholder="예: 백년노포 설렁탕"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>위치 주소 *</label>
                  <input 
                    type="text" 
                    value={reportAddress}
                    onChange={e => setReportAddress(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                    placeholder="예: 서울 마포구 공덕동 12-3"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>추천 메뉴 및 대표 메뉴</label>
                  <input 
                    type="text" 
                    value={reportMenu}
                    onChange={e => setReportMenu(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                    placeholder="예: 설렁탕 (소면 무한리필)"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>제보 추천 사유 *</label>
                  <textarea 
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    style={{ width: '100%', height: '60px', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none', resize: 'none' }}
                    placeholder="예: 30년 넘게 이 자리를 지켜온 진짜 노포로, 직접 가마솥에..."
                  />
                </div>

                <button
                  type="submit"
                  style={{ width: '100%', padding: '10px 0', background: 'var(--accent-orange)', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                >
                  맛집 제보하기 신청
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 시크릿 컬렉션 해금 모달 */}
      {showUnlockModal && (
        <div ref={unlockModalRef} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 17, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }} className="animate-fade-in">
          <div style={{
            width: '100%',
            maxWidth: '360px',
            background: 'var(--bg-secondary)',
            border: '1.5px solid var(--accent-pink)',
            borderRadius: '12px',
            padding: '24px',
            position: 'relative',
            boxShadow: '0 0 25px rgba(236, 72, 153, 0.2)'
          }}>
            <button 
              onClick={() => setShowUnlockModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <h4 style={{ fontSize: '20px', fontWeight: '900', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  🔒 시크릿 컬렉션 해금
                </h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  7년간 직접 발로 뛰어 발굴한 진짜 희소성 높은 전국 Top 10 최고의 노포 목록의 정보와 지도 위치를 해금합니다.
                </p>
              </div>

              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#f8fafc' }}>
                  해금 요구 조건 (택 1):
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>💬 단톡방 친구 초대 (공유)</span>
                  <span style={{ fontWeight: '700', color: unlockProgress.shares >= 3 ? 'var(--accent-green)' : 'var(--accent-pink)' }}>
                    {unlockProgress.shares} / 3회 {unlockProgress.shares >= 3 && '✓'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>✍️ 미식 일기 작성 (방문 완료)</span>
                  <span style={{ fontWeight: '700', color: unlockProgress.logs >= 2 ? 'var(--accent-green)' : 'var(--accent-pink)' }}>
                    {unlockProgress.logs} / 2회 {unlockProgress.logs >= 2 && '✓'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  const text = `[대동맛지도 초대장]\n7년간 직접 발로 뛴 전국 백년노포 대공개! 지금 대동맛지도에서 확인해보세요.\n링크: ${getShareOrigin()}`;
                  safeCopyToClipboard(text).then(() => {
                    alert('초대장 문구가 복사되었습니다! 친구나 단톡방에 공유해 보세요.');
                    try {
                      const shares = parseInt(localStorage.getItem('daedong_share_count') || '0', 10);
                      localStorage.setItem('daedong_share_count', String(shares + 1));
                      window.dispatchEvent(new Event('daedong_unlock_progress'));
                    } catch (e) {
                      console.error(e);
                    }
                  });
                }}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: 'linear-gradient(90deg, var(--accent-pink) 0%, var(--accent-purple) 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                💬 단톡방 공유용 초대장 복사하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📳 흔들기 결정 매칭 오버레이 모달 */}
      {shakeResultRestaurant && (
        <div ref={shakeModalRef} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(3, 7, 18, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '16px'
        }} className="animate-fade-in">
          <div 
            className="glass-panel"
            style={{
              width: '320px',
              padding: '24px',
              border: '1.5px solid var(--accent-pink)',
              boxShadow: '0 0 30px rgba(236, 72, 153, 0.3)',
              borderRadius: '16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              position: 'relative'
            }}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => setShakeResultRestaurant(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '12px'
              }}
            >
              ✕
            </button>

            <div>
              <span style={{ fontSize: '36px', display: 'block', animation: 'bounce 1s infinite' }}>🎰</span>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent-pink)', letterSpacing: '0.15em', marginTop: '8px' }}>
                SHAKE MATCH DECISION
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#f8fafc', marginTop: '4px' }}>
                흔들기 추천 완료!
              </h3>
            </div>

            {/* 결과 카드 */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.45)',
              border: '1px solid rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: '12px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: '800',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(236, 72, 153, 0.1)',
                  color: 'var(--accent-pink)'
                }}>
                  {shakeResultRestaurant.category}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--accent-yellow)', fontWeight: '700' }}>
                  ★ {shakeResultRestaurant.rating}
                </span>
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#f8fafc' }}>
                {shakeResultRestaurant.name}
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                📍 {shakeResultRestaurant.address}
              </p>
              {shakeResultRestaurant.menu && (
                <p style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '6px', fontWeight: '600' }}>
                  🍲 대표메뉴: {shakeResultRestaurant.menu}
                </p>
              )}
            </div>

            {/* 버튼들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  const shareText = `결정장애 종결! 대동맛지도를 흔들어서 5초 만에 결정한 오늘의 맛집: ${shakeResultRestaurant.name} (${shakeResultRestaurant.category}) - ${shakeResultRestaurant.address}\n바로 확인: ${getShareOrigin()}/?id=${shakeResultRestaurant.id}`;
                  safeCopyToClipboard(shareText)
                    .then(() => alert('결정된 맛집 정보가 클립보드에 복사되었습니다. 친구들과 카톡방에 공유해보세요!'))
                    .catch(() => alert('복사에 실패했습니다. 직접 복사해주세요.'));
                }}
                style={{
                  width: '100%',
                  padding: '10px 0',
                  background: 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-cyan) 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                🔗 결정 결과 카톡방에 공유하기
              </button>

              <button
                onClick={() => {
                  setShakeResultRestaurant(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
