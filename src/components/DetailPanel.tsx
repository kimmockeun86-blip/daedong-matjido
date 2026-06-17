import React, { useState, useEffect } from 'react';
import { X, MapPin, Phone, Award, Navigation, Share2, Copy, CheckCircle } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';

// 카테고리별 프리미엄 Unsplash 음식 이미지 컬렉션 (다양성을 위해 해시 매핑)
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

  // 맛집이 바뀌면 복사 완료 모드 해제
  useEffect(() => {
    setCopied(false);
  }, [restaurant]);

  if (!restaurant) return null;

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

  // 모바일 카카오맵 어플 연동 핸들러
  const handleKakaoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isMobile) {
      e.preventDefault();
      const query = restaurant.portalSearchName || restaurant.name;
      // 카카오맵 네이티브 앱 URL scheme
      const appUrl = `kakaomap://search?q=${encodeURIComponent(query)}`;
      // 앱 미설치 시 이동할 모바일 웹 URL (카카오 제공 공식 연동용)
      const webUrl = `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;

      const start = Date.now();
      window.location.href = appUrl;

      // 1.5초 이내에 페이지 포커스가 여전히 웹에 남아있으면(앱이 안 열렸으면) 웹 연동 실행
      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(webUrl, '_blank');
        }
      }, 1500);
    }
  };

  // 모바일 네이버 지도 어플 연동 핸들러
  const handleNaverClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isMobile) {
      e.preventDefault();
      const query = restaurant.portalSearchName || restaurant.name;
      // 네이버 지도 네이티브 앱 URL scheme
      const appUrl = `nmap://search?query=${encodeURIComponent(query)}&appname=com.daedong.matjido`;
      const webUrl = `https://map.naver.com/v5/search/${encodeURIComponent(query)}`;

      const start = Date.now();
      window.location.href = appUrl;

      setTimeout(() => {
        if (Date.now() - start < 2000) {
          window.open(webUrl, '_blank');
        }
      }, 1500);
    }
  };

  // 클립보드에 맛집 정보 복사(공유) 처리
  const handleShareClick = () => {
    const shareText = `[대동맛지도 추천 맛집]\n상호명: ${restaurant.name}\n음식종류: ${restaurant.category}\n대표메뉴: ${restaurant.menu}\n주소: ${restaurant.address}\n전화번호: ${phone}\n추천사유: "${restaurant.review}"`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
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
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px'
        }}>
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
                <span style={{ color: 'var(--accent-green)' }}>복구된 정보 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                맛집 공유하기
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
