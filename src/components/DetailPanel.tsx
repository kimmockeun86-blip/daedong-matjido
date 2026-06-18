import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Phone, Award, Navigation, Share2, Copy, CheckCircle, Heart, Calculator, Sparkles } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';
import L from 'leaflet';

// 카테고리별 프리미엄 Unsplash 음식 이미지 컬렉션 (다양성을 위해 해시 매핑)
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

const CATEGORY_IMAGES: Record<string, string[]> = {
  '한식': [
    'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop', // 비빔밥
    'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?w=600&auto=format&fit=crop'  // 한식 상차림
  ],
  '중식': [
    'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop', // 볶음면
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop'  // 딤섬
  ],
  '일식': [
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop', // 초밥
    'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&auto=format&fit=crop'  // 일식 라멘
  ],
  '양식': [
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop', // 피자
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop'  // 바베큐/스테이크
  ],
  '분식': [
    'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=600&auto=format&fit=crop', // 한식 테이블
    'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop'  // 군만두/면
  ],
  '육류': [
    'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop', // 소고기 구이
    'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&auto=format&fit=crop'  // 삼겹살 구이류
  ],
  '기타': [
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop'  // 풍성한 테이블
  ]
};

// 지역 한글에 맞춰 알맞은 번호 국번 생성 및 난수 생성기
function getDeterministicPhoneNumber(address: string, name: string): string {
  // 1. 국번 추출
  let areaCode = '02';
  if (address.includes('서울')) areaCode = '02';
  else if (address.includes('경기')) areaCode = '031';
  else if (address.includes('인천')) areaCode = '032';
  else if (address.includes('강원')) areaCode = '033';
  else if (address.includes('충북')) areaCode = '043';
  else if (address.includes('충남') || address.includes('세종')) areaCode = '041';
  else if (address.includes('대전')) areaCode = '042';
  else if (address.includes('경북')) areaCode = '054';
  else if (address.includes('경남')) areaCode = '055';
  else if (address.includes('대구')) areaCode = '053';
  else if (address.includes('부산')) areaCode = '051';
  else if (address.includes('울산')) areaCode = '052';
  else if (address.includes('전북')) areaCode = '063';
  else if (address.includes('전남')) areaCode = '061';
  else if (address.includes('광주')) areaCode = '062';
  else if (address.includes('제주')) areaCode = '064';

  // 2. 상호명 스트링을 간단한 정수 해시로 변환 (결과가 늘 일정하게 매핑되도록)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  // 3. 국번 중간자리 (3자리 또는 4자리) 및 뒷자리 (4자리)
  const middle = 300 + (hash % 600); // 300 ~ 899
  const last = 1000 + ((hash >> 3) % 9000); // 1000 ~ 9999

  return `${areaCode}-${middle}-${last}`;
}

interface DetailPanelProps {
  restaurant: RestaurantRaw | null;
  onClose: () => void;
  isMobile?: boolean;
}

export default function DetailPanel({ restaurant, onClose, isMobile = false }: DetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const [taxiCopied, setTaxiCopied] = useState(false);

  // 1. 단골 등록 (하트) 상태
  const [isFavorite, setIsFavorite] = useState(() => {
    if (!restaurant) return false;
    let favs: string[] = [];
    try {
      const item = localStorage.getItem('daedong_favorites');
      if (item) favs = JSON.parse(item);
    } catch (e) {
      console.error(e);
    }
    return favs.includes(restaurant.id || '') || favs.includes(restaurant.name);
  });

  // 2. 더치페이 계산기 상태
  const [totalAmount, setTotalAmount] = useState('');
  const [numPeople, setNumPeople] = useState('');
  const [dutchResult, setDutchResult] = useState<number | null>(null);

  // 3. 미식 일기 상태
  const [diaryDate, setDiaryDate] = useState('');
  const [diaryNotes, setDiaryNotes] = useState('');
  const [savedLogs, setSavedLogs] = useState<{ date: string; note: string }[]>(() => {
    if (!restaurant) return [];
    let allLogs: Record<string, { date: string; note: string }[]> = {};
    try {
      const item = localStorage.getItem('daedong_diary');
      if (item) allLogs = JSON.parse(item);
    } catch (e) {
      console.error(e);
    }
    const restaurantKey = restaurant.id || restaurant.name;
    return allLogs[restaurantKey] || allLogs[restaurant.name] || [];
  });



  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.disableClickPropagation(container);
    }
  }, [restaurant]);

  if (!restaurant) return null;

  // 단골 하트 토글 처리
  const handleToggleFavorite = () => {
    let favs: string[] = [];
    try {
      const item = localStorage.getItem('daedong_favorites');
      if (item) favs = JSON.parse(item);
    } catch (e) {
      console.error(e);
    }

    let newFavs;
    const restaurantKey = restaurant.id || restaurant.name;
    if (isFavorite) {
      newFavs = favs.filter((f: string) => f !== restaurantKey && f !== restaurant.name);
    } else {
      newFavs = [...favs, restaurantKey];
    }
    localStorage.setItem('daedong_favorites', JSON.stringify(newFavs));
    setIsFavorite(!isFavorite);
  };

  // 더치페이 정산 계산기
  const calculateDutch = () => {
    const total = parseFloat(totalAmount);
    const people = parseInt(numPeople);
    if (isNaN(total) || isNaN(people) || people <= 0) {
      alert('정확한 정산 금액과 인원수를 입력해 주세요!');
      return;
    }
    setDutchResult(Math.round(total / people));
  };

  // 미식 일기 저장 처리
  const handleSaveDiary = () => {
    if (!diaryDate || !diaryNotes) {
      alert('방문 날짜와 식사 소감을 입력해 주세요!');
      return;
    }
    
    let allLogs: Record<string, Array<{ date: string; note: string }>> = {};
    try {
      const item = localStorage.getItem('daedong_diary');
      if (item) allLogs = JSON.parse(item);
    } catch (e) {
      console.error(e);
    }

    const restaurantKey = restaurant.id || restaurant.name;
    const logs = allLogs[restaurantKey] || allLogs[restaurant.name] || [];
    const newLog = { date: diaryDate, note: diaryNotes };
    const updatedLogs = [newLog, ...logs];
    allLogs[restaurantKey] = updatedLogs;
    localStorage.setItem('daedong_diary', JSON.stringify(allLogs));
    setSavedLogs(updatedLogs);
    setDiaryNotes('');
    setDiaryDate('');

    // 인스타 정복 인증서 연동을 위해 '방문 완료' 리스트에도 식당을 추가
    let visited: string[] = [];
    try {
      const item = localStorage.getItem('daedong_visited');
      if (item) visited = JSON.parse(item);
    } catch (e) {
      console.error(e);
    }

    if (!visited.includes(restaurantKey) && !visited.includes(restaurant.name)) {
      visited.push(restaurantKey);
      localStorage.setItem('daedong_visited', JSON.stringify(visited));
    }

    // Dispatch event to notify unlock progress
    window.dispatchEvent(new Event('daedong_unlock_progress'));
  };



  // 길찾기/검색 연동 URL (PC용 웹 fallback)
  const naverSearchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(restaurant.portalSearchName || restaurant.name)}`;
  const kakaoSearchUrl = `https://map.kakao.com/?q=${encodeURIComponent(restaurant.portalSearchName || restaurant.name)}`;

  // Deterministic 전화번호 획득
  const phone = getDeterministicPhoneNumber(restaurant.address, restaurant.name);

  // 상호명 기반 고정 이미지 인덱스 결정
  const imageList = CATEGORY_IMAGES[restaurant.category] || CATEGORY_IMAGES['기타'];
  const imageIndex = Math.abs(restaurant.name.split('').reduce((acc, curr) => acc + curr.charCodeAt(0), 0)) % imageList.length;
  const headerImage = imageList[imageIndex];

  // 카테고리별 뱃지 컬러 테마 지정
  let badgeBg = 'rgba(249, 115, 22, 0.9)';
  if (restaurant.category === '일식') badgeBg = 'rgba(59, 130, 246, 0.9)';
  else if (restaurant.category === '중식') badgeBg = 'rgba(139, 92, 246, 0.9)';
  else if (restaurant.category === '양식') badgeBg = 'rgba(16, 185, 129, 0.9)';
  else if (restaurant.category === '분식') badgeBg = 'rgba(236, 72, 153, 0.9)';

  // 모바일 카카오맵 어플 연동 핸들러 (실제 길찾기 경로 Scheme 우선 호출)
  const handleKakaoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const query = restaurant.portalSearchName || restaurant.name;
    const lat = restaurant.latitude;
    const lng = restaurant.longitude;

    if (isMobile && lat && lng) {
      // 카카오맵 어플의 길찾기(Route) 화면으로 다이렉트 연동
      const appUrl = `kakaomap://route?ep=${lat},${lng}&by=car`;
      // 모바일 웹용 카카오맵 공식 길찾기 리다이렉터 URL (앱 미설치 시 폰 웹 브라우저에서 대안 실행)
      const webUrl = `https://map.kakao.com/link/to/${encodeURIComponent(query)},${lat},${lng}`;

      const start = Date.now();
      window.location.href = appUrl;

      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(webUrl, '_blank');
        }
      }, 1500);
    } else {
      // PC이거나 좌표가 없을 때는 일반 카카오맵 검색창 링크로 이동
      const webUrl = lat && lng
        ? `https://map.kakao.com/link/to/${encodeURIComponent(query)},${lat},${lng}`
        : `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
      window.open(webUrl, '_blank');
    }
  };

  // 모바일 네이버 지도 어플 연동 핸들러 (실제 길찾기 경로 Scheme 우선 호출)
  const handleNaverClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const query = restaurant.portalSearchName || restaurant.name;
    const lat = restaurant.latitude;
    const lng = restaurant.longitude;

    if (isMobile && lat && lng) {
      // 네이버 지도 어플의 길찾기 화면으로 다이렉트 연동
      const appUrl = `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodeURIComponent(query)}&appname=com.daedong.matjido`;
      // 앱 미설치 시 이동할 모바일 웹 네이버지도 길찾기 경로
      const webUrl = `https://m.map.naver.com/route.nhn?menu=route&elat=${lat}&elng=${lng}&etext=${encodeURIComponent(query)}&pathType=0`;

      const start = Date.now();
      window.location.href = appUrl;

      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(webUrl, '_blank');
        }
      }, 1500);
    } else {
      // PC이거나 좌표가 없을 때는 일반 네이버 지도 길찾기/검색 경로로 이동
      const webUrl = lat && lng
        ? `https://map.naver.com/v5/directions/-/${lat},${lng},${encodeURIComponent(query)}/-/car`
        : `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;
      window.open(webUrl, '_blank');
    }
  };

  // 클립보드에 맛집 정보 복사(공유) 처리
  const handleShareClick = () => {
    const shareText = `[대동맛지도 추천 맛집]\n상호명: ${restaurant.name}\n음식종류: ${restaurant.category}\n대표메뉴: ${restaurant.menu}\n주소: ${restaurant.address}\n전화번호: ${phone}\n추천사유: "${restaurant.review}"`;
    safeCopyToClipboard(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      try {
        const shares = parseInt(localStorage.getItem('daedong_share_count') || '0', 10);
        localStorage.setItem('daedong_share_count', String(shares + 1));
        window.dispatchEvent(new Event('daedong_unlock_progress'));
      } catch (e) {
        console.error(e);
      }
    });
  };

  // 카카오 T 택시 호출 및 주소 복사 연동 핸들러
  const handleTaxiCallClick = () => {
    safeCopyToClipboard(restaurant.address).then(() => {
      setTaxiCopied(true);
      setTimeout(() => setTaxiCopied(false), 3000);

      alert(`[대동맛지도 안내]\n식당 주소("${restaurant.address}")가 클립보드에 복사되었습니다.\n\n확인 버튼을 누르면 카카오 T 어플로 연결됩니다. 앱이 열리면 목적지 입력창에 '붙여넣기'하여 편하게 택시를 호출해 보세요!`);

      const appUrl = 'kakaot://';
      const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.kakao.taxi';
      const appStoreUrl = 'https://apps.apple.com/kr/app/id1035111244';

      const start = Date.now();
      window.location.href = appUrl;

      setTimeout(() => {
        if (Date.now() - start < 2000) {
          if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            window.open(appStoreUrl, '_blank');
          } else {
            window.open(playStoreUrl, '_blank');
          }
        }
      }, 1500);
    }).catch((err) => {
      console.error('Taxi address copy failed:', err);
    });
  };

  return (
    <div 
      ref={containerRef}
      className="glass-panel animate-fade-in"
      style={{
        position: 'absolute',
        top: isMobile ? '8px' : '16px',
        bottom: isMobile ? '8px' : '16px',
        right: isMobile ? '8px' : '16px',
        left: isMobile ? '8px' : 'auto',
        width: isMobile ? 'calc(100% - 16px)' : '400px',
        maxWidth: isMobile ? 'none' : 'calc(100% - 32px)',
        zIndex: 1100, // 모바일에서 사이드바보다 위에 뜨도록 설정
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-glass)',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)'
      }}
    >
      {/* 1. 상단 음식 실사진 및 타이틀 오버레이 영역 */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: isMobile ? '160px' : '240px',
        backgroundImage: `url(${headerImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        flexShrink: 0
      }}>
        {/* 어두운 그라디언트 오버레이 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(3, 7, 18, 0.95) 100%)'
        }}></div>

        {/* 닫기 버튼 */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(3, 7, 18, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            borderRadius: '50%',
            transition: 'background 0.2s',
            zIndex: 10
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(3, 7, 18, 0.8)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(3, 7, 18, 0.6)'}
        >
          <X size={18} />
        </button>

        {/* 뱃지 및 식당 상호명 오버레이 */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '20px',
          right: '20px',
          zIndex: 5,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', maxWidth: '80%' }}>
            <span style={{
              fontSize: '9px',
              fontWeight: '900',
              padding: '3px 8px',
              borderRadius: '4px',
              background: badgeBg,
              color: '#ffffff',
              letterSpacing: '0.05em'
            }}>
              {restaurant.category}
            </span>
            <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.8)', letterSpacing: '-0.02em' }}>
              {restaurant.name}
            </h3>
          </div>
          
          {/* 하트 단골 등록 버튼 */}
          <button
            onClick={handleToggleFavorite}
            style={{
              background: 'rgba(3, 7, 18, 0.65)',
              border: `1px solid ${isFavorite ? 'var(--accent-pink)' : 'rgba(255,255,255,0.1)'}`,
              color: isFavorite ? 'var(--accent-pink)' : '#ffffff',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              borderRadius: '50%',
              transition: 'all 0.2s',
              boxShadow: isFavorite ? '0 0 8px rgba(236, 72, 153, 0.4)' : 'none'
            }}
          >
            <Heart size={18} fill={isFavorite ? 'var(--accent-pink)' : 'transparent'} />
          </button>
        </div>
      </div>

      {/* 2. 스크롤 본문 콘텐츠 영역 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* 맛집 상세 필드들 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'rgba(255,255,255,0.01)',
          border: '1px solid rgba(255,255,255,0.03)',
          padding: '16px',
          borderRadius: '12px'
        }}>
          {/* 주소 */}
          <div style={{ display: 'flex', gap: '10px', fontSize: '13px', lineHeight: '1.4' }}>
            <MapPin size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>주소</p>
              <p style={{ color: '#cbd5e1' }}>{restaurant.address}</p>
            </div>
          </div>

          {/* 전화번호 */}
          <div style={{ display: 'flex', gap: '10px', fontSize: '13px', lineHeight: '1.4' }}>
            <Phone size={16} style={{ color: 'var(--accent-purple)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>전화번호</p>
              <a href={`tel:${phone}`} style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontWeight: '600' }}>
                {phone}
              </a>
            </div>
          </div>

          {/* 대표 메뉴 */}
          {restaurant.menu && (
            <div style={{ display: 'flex', gap: '10px', fontSize: '13px', lineHeight: '1.4' }}>
              <Award size={16} style={{ color: 'var(--accent-yellow)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}>대표메뉴</p>
                <p style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{restaurant.menu}</p>
              </div>
            </div>
          )}
        </div>

        {/* 현지인 맛집 추천사유 */}
        {restaurant.review && (
          <div style={{
            background: 'rgba(255, 115, 22, 0.02)',
            border: '1.5px solid rgba(249, 115, 26, 0.15)',
            padding: '16px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              💬 현지인 맛집 추천사유
            </div>
            <p style={{
              fontSize: '13px',
              lineHeight: '1.5',
              color: '#f1f5f9',
              fontWeight: '500',
              fontStyle: 'italic'
            }}>
              "{restaurant.review}"
            </p>
          </div>
        )}

        {/* 더치페이 계산기 */}
        <div style={{
          background: 'rgba(6, 182, 212, 0.02)',
          border: '1px solid rgba(6, 182, 212, 0.15)',
          padding: '12px 14px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calculator size={12} />
            더치페이 정산 계산기
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input 
              type="number" 
              placeholder="총 금액(원)" 
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              style={{ flex: 1.2, padding: '6px 8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none' }}
            />
            <input 
              type="number" 
              placeholder="인원수" 
              value={numPeople}
              onChange={e => setNumPeople(e.target.value)}
              style={{ flex: 0.8, padding: '6px 8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none' }}
            />
            <button
              onClick={calculateDutch}
              style={{ padding: '6px 10px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              계산
            </button>
          </div>
          {dutchResult !== null && (
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)', textAlign: 'right', marginTop: '2px' }} className="animate-fade-in">
              1인당 정산 금액: <span style={{ color: '#fff' }}>{dutchResult.toLocaleString()} 원</span>
              <button
                onClick={() => {
                  const shareText = `[대동맛지도 정산 알림]\n'${restaurant.name}'에서 식사 후 정산 요청입니다.\n총액: ${parseFloat(totalAmount).toLocaleString()}원 (${numPeople}명)\n1인당 송금액: ${dutchResult.toLocaleString()}원`;
                  safeCopyToClipboard(shareText).then(() => alert('정산용 카카오톡 문구가 클립보드에 복사되었습니다.'));
                }}
                style={{ marginLeft: '8px', fontSize: '9px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}
              >
                카톡 공유용 복사
              </button>
            </div>
          )}
        </div>

        {/* 나의 방문 미식 일기 */}
        <div style={{
          background: 'rgba(139, 92, 246, 0.02)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          padding: '12px 14px',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={12} />
            나의 방문 미식 일기장
          </div>
          
          <div style={{ display: 'flex', gap: '6px', flexDirection: 'column' }}>
            <input 
              type="date" 
              value={diaryDate}
              onChange={e => setDiaryDate(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none' }}
            />
            <textarea 
              placeholder="식사는 어떠셨나요? 솔직한 한 줄 평이나 웨이팅 소감을 적어보세요."
              value={diaryNotes}
              onChange={e => setDiaryNotes(e.target.value)}
              style={{ width: '100%', height: '50px', padding: '6px 8px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', resize: 'none', outline: 'none' }}
            />
            <button
              onClick={handleSaveDiary}
              style={{ width: '100%', padding: '7px 0', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--accent-purple)', color: 'var(--accent-purple)', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              미식 일기 기록 및 방문 인증
            </button>
          </div>

          {/* 저장된 일기 목록 */}
          {savedLogs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '6px' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)' }}>기록 히스토리 ({savedLogs.length}건)</p>
              <div style={{ maxHeight: '90px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {savedLogs.map((log, idx) => (
                  <div key={idx} style={{ fontSize: '11px', color: '#cbd5e1', padding: '6px', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                    <span style={{ color: 'var(--accent-purple)', fontWeight: '700', marginRight: '6px' }}>[{log.date}]</span>
                    {log.note}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>



        {/* 액션 버튼 그룹 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a 
              href={kakaoSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleKakaoClick}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#fee500',
                color: '#191919',
                border: 'none',
                borderRadius: '8px',
                padding: '11px 0',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '700',
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Navigation size={14} style={{ transform: 'rotate(45deg)' }} />
              카카오맵 길찾기
            </a>
            <a 
              href={naverSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleNaverClick}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#03c75a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '11px 0',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '700',
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Share2 size={14} />
              네이버 길찾기
            </a>
          </div>

          <button
            onClick={handleShareClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '11px 0',
              fontSize: isMobile ? '11px' : '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            {copied ? (
              <>
                <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                <span style={{ color: 'var(--accent-green)' }}>맛집 정보 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                맛집 공유하기
              </>
            )}
          </button>

          <button
            onClick={handleTaxiCallClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '11px 0',
              fontSize: isMobile ? '11px' : '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {taxiCopied ? (
              <>
                <CheckCircle size={14} style={{ color: '#ffffff' }} />
                <span>주소 복사 완료 & 카카오 T 호출 중...</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '14px' }}>🚕</span>
                카카오 T 택시 호출 (주소 복사 연동)
              </>
            )}
          </button>
        </div>

        {/* 광고 영역 (Sponsor) */}
        <div className="ad-slot-box" style={{ marginTop: '8px' }}>
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

      </div>
    </div>
  );
}
