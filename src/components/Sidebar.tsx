import { useState } from 'react';
import { Search, MapPin, Compass, Navigation, BarChart3, X } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';
import L from 'leaflet';

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
  mapRef
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 1. 맛집 제보 모달 상태
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportAddress, setReportAddress] = useState('');
  const [reportMenu, setReportMenu] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // 2. 지하철역 중간지점 탐색 상태
  const [showStationSearch, setShowStationSearch] = useState(false);
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

    const matches = restaurants.filter(r => 
      r.address.toLowerCase().includes(term1) || r.address.toLowerCase().includes(term2)
    );

    if (matches.length === 0) {
      alert('해당 장소 근처에 등록된 맛집이 없습니다. 다른 역명을 입력해 보세요 (예: 강남, 마포, 강릉 등).');
      return;
    }

    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    matches.forEach(r => {
      if (r.latitude && r.longitude) {
        sumLat += r.latitude;
        sumLng += r.longitude;
        count++;
      }
    });

    if (count > 0 && mapRef.current) {
      const avgLat = sumLat / count;
      const avgLng = sumLng / count;
      mapRef.current.setView([avgLat, avgLng], 13, { animate: true, duration: 1.0 });
      alert(`두 지역 매칭 완료! 중간 영역 맛집 ${count}곳 근처로 지도 시점이 이동되었습니다.`);
    }
  };

  // 고유 카테고리 추출
  const categories = ['전체', '한식', '중식', '일식', '양식', '분식', '육류'];

  // 동적 지역별 분포 계산
  const regionMap: Record<string, number> = {};
  restaurants.forEach((r) => {
    if (r.region) {
      regionMap[r.region] = (regionMap[r.region] || 0) + 1;
    }
  });

  const regionsSorted = Object.entries(regionMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div 
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', width: '100%' }}>
          
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

          {/* 7년 실방문 보증 네온 배너 */}
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

          {/* 검색창 */}
          <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
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

          {/* 전체 분석 리포트 카드 */}
          <div style={{
            background: 'rgba(139, 92, 246, 0.03)',
            border: '1px solid rgba(139, 92, 246, 0.18)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
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

          {/* 스폰서 광고 슬롯 */}
          <div className="ad-slot-box">
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

          {/* 검색 결과 카운트 정보 */}
          <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
            검색된 맛집 <span style={{ color: 'var(--accent-yellow)' }}>{filteredRestaurants.length}</span>개
          </div>

          {/* 스크롤 리스트 영역 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            paddingRight: '4px'
          }}>
            {filteredRestaurants.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
                🔍 조건에 일치하는 맛집이 없습니다.
              </div>
            ) : (
              filteredRestaurants.map((res, idx) => {
                const isSelected = selectedRestaurant?.name === res.name;
                
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

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectRestaurant(res)}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'rgba(30, 41, 59, 0.35)',
                      border: `1.5px solid ${isSelected ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.04)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.5)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.35)';
                      }
                    }}
                  >
                    {/* 카드 헤더 (음식종류, 상호명, 주소) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '70%' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: badgeBg,
                          color: badgeColor
                        }}>
                          {res.category}
                        </span>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {res.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <MapPin size={10} />
                        {res.address}
                      </span>
                    </div>

                    {/* 대표메뉴 */}
                    {res.menu && (
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        대표메뉴: <span style={{ color: '#f8fafc', fontWeight: '500' }}>{res.menu}</span>
                      </div>
                    )}

                    {/* 추천사유 본문 */}
                    {res.review && (
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {res.review}
                      </p>
                    )}

                    {/* 네온 하단 태그 */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        background: 'rgba(16, 185, 129, 0.04)',
                        color: 'var(--accent-green)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-green)' }}></span>
                        지도 핀 활성화
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                        background: 'rgba(139, 92, 246, 0.04)',
                        color: 'var(--accent-purple)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-purple)' }}></span>
                        실사진 보유
                      </span>
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 맛집 제보 모달 팝업 */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 17, 0.85)',
          backdropFilter: 'blur(8px)',
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
    </div>
  );
}
