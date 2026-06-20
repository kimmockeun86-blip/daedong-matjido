import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Gift, Share2, HelpCircle, RotateCcw, Camera, Heart, Trophy, MapPin, Award } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';
import L from 'leaflet';

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

interface GourmetToolkitProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: RestaurantRaw[];
  onSelectRestaurant: (restaurant: RestaurantRaw) => void;
  visitedRestaurants: string[]; // 방문한 식당 상호명 배열
  isMobile?: boolean;
  routeRestaurants: RestaurantRaw[];
  setRouteRestaurants: React.Dispatch<React.SetStateAction<RestaurantRaw[]>>;
  isUnlocked?: boolean;
  defaultTab?: 'roulette' | 'mbti' | 'couple' | 'worldcup' | 'share' | 'instagram' | 'shop' | 'course' | 'quiz';
}

// 미식 MBTI 문항 정의
interface QuizQuestion {
  question: string;
  options: { text: string; score: string }[];
}

const MBTI_QUESTIONS: QuizQuestion[] = [
  {
    question: "웨이팅이 무려 2시간인 노포 맛집, 당신의 선택은?",
    options: [
      { text: "2시간을 대기해서라도 본점의 찐한 맛을 느껴야 한다.", score: "M" }, // Master
      { text: "배고프다. 그냥 바로 근처에 대기 없는 옆집으로 간다.", score: "S" }  // Speed
    ]
  },
  {
    question: "국밥이 나왔을 때 당신의 양념(다대기) 스타일은?",
    options: [
      { text: "맑은 오리지널 국물을 충분히 즐긴 후 새우젓으로 간한다.", score: "D" }, // Delicate (섬세)
      { text: "나오자마자 고추 다대기와 후추를 팍팍 풀어 칼칼하게 먹는다.", score: "H" } // Hot (자극)
    ]
  },
  {
    question: "음식점을 고를 때 더 가중치를 두는 요소는?",
    options: [
      { text: "위생이나 주차가 아쉬워도, 맛과 세월의 포스가 느껴지면 OK.", score: "N" }, // Nopo (노포)
      { text: "맛도 맛이지만 깔끔한 화장실과 쾌적하고 조용한 실내가 필수.", score: "C" } // Clean (깔끔)
    ]
  },
  {
    question: "가게에 새로운 신메뉴가 출시되었을 때 당신은?",
    options: [
      { text: "원래 이 집에서 늘 먹던 대표 시그니처 메뉴를 시킨다.", score: "K" }, // Keeper (안정)
      { text: "이왕 온 김에 호기심으로 신메뉴나 이색 안주를 골라본다.", score: "E" } // Explorer (탐험)
    ]
  }
];

const QUIZ_QUESTIONS = [
  {
    question: "대동맛지도 선정 마포구 최고의 김치찌개 집은 어디일까요?",
    options: ["서대문옥반", "마포옥", "굴다리식당", "을지다락"],
    correct: 2,
    desc: "마포구 굴다리식당은 사골 육수와 부드러운 김치로 수십 년간 미식가들의 찬사를 받고 있는 노포입니다."
  },
  {
    question: "부산 밀면의 시초이자 가장 오랜 전통을 자랑하는 대동맛지도 등록 맛집은?",
    options: ["내호냉면", "할매국밥", "쌍둥이돼지국밥", "초량밀면"],
    correct: 0,
    desc: "우암동 내호냉면은 피란민 시절부터 메밀 대신 밀가루로 면을 뽑아 팔기 시작한 부산 밀면의 원조입니다."
  },
  {
    question: "서울 을지로 공구거리 뒤편에서 투박한 동그랑땡(연탄불 고추장 양념구이)으로 유명한 노포는?",
    options: ["안동장", "을지면옥", "경상도집", "양미옥"],
    correct: 2,
    desc: "경상도집은 연탄불 향이 그윽하게 밴 돼지갈비와 투박한 반찬들로 사랑받는 을지로 골목의 대표 성지입니다."
  }
];

export default function GourmetToolkit({
  isOpen,
  onClose,
  restaurants,
  onSelectRestaurant,
  visitedRestaurants = [],
  isMobile = false,
  routeRestaurants,
  setRouteRestaurants,
  isUnlocked = false,
  defaultTab
}: GourmetToolkitProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.disableClickPropagation(container);
    }
  }, [isOpen]);

  const top10Ids = useMemo(() => {
    return [...restaurants]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10)
      .map(r => r.id || '');
  }, [restaurants]);

  const [activeTab, setActiveTab] = useState<'roulette' | 'mbti' | 'couple' | 'worldcup' | 'share' | 'instagram' | 'shop' | 'course' | 'quiz'>('roulette');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen && defaultTab) {
      setActiveTab(defaultTab);
    }
  }

  // 1. 룰렛 관련 상태
  const [rouletteList, setRouletteList] = useState<RestaurantRaw[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteWinner, setRouletteWinner] = useState<RestaurantRaw | null>(null);

  // 2. MBTI 관련 상태
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [mbtiAnswers, setMbtiAnswers] = useState<string[]>([]);
  const [mbtiResult, setMbtiResult] = useState<{ title: string; desc: string; tag: string } | null>(null);

  // 3. 커플 맛집 궁합 관련 상태
  const [partner1, setPartner1] = useState('');
  const [partner2, setPartner2] = useState('');
  const [partner1Pref, setPartner1Pref] = useState('한식');
  const [partner2Pref, setPartner2Pref] = useState('한식');
  const [coupleResult, setCoupleResult] = useState<{
    score: number;
    recommendedRestaurant: RestaurantRaw;
    desc: string;
  } | null>(null);

  // 4. 맛집 월드컵 관련 상태
  const [worldcupStage, setWorldcupStage] = useState<'intro' | 'round_8' | 'round_4' | 'final' | 'winner'>('intro');
  const [worldcupList, setWorldcupList] = useState<RestaurantRaw[]>([]);
  const [worldcupIndex, setWorldcupIndex] = useState(0); // 현재 매치 인덱스 (0, 1, 2, 3...)
  const [worldcupNextRound, setWorldcupNextRound] = useState<RestaurantRaw[]>([]);
  const [worldcupWinner, setWorldcupWinner] = useState<RestaurantRaw | null>(null);

  // 5. 단톡방 약속 생성기 상태
  const [meetDate, setMeetDate] = useState('');
  const [meetTime, setMeetTime] = useState('');
  const [meetRest, setMeetRest] = useState('');
  const [meetMemo, setMeetMemo] = useState('');
  const [shareTextCopied, setShareTextCopied] = useState(false);

  // 6. 기프트 샵 상태
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptItem, setReceiptItem] = useState<{ name: string; price: number } | null>(null);

  // 7. 코스 플래너 상태
  const [courseSelectVal, setCourseSelectVal] = useState('');
  const [routeCopied, setRouteCopied] = useState(false);

  // 8. 미식 퀴즈 상태
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // 9. 미식 역사 연대기 Wrapped 상태 및 헬퍼
  const [instagramTabMode, setInstagramTabMode] = useState<'tier' | 'wrapped'>('tier');
  
  const getEstablishmentYear = (restaurant: RestaurantRaw): number => {
    const name = restaurant.name;
    if (name.includes('우래옥')) return 1946;
    if (name.includes('명동교자')) return 1966;
    if (name.includes('토속촌')) return 1983;
    if (name.includes('하동관')) return 1939;
    if (name.includes('이문설농탕')) return 1904;
    if (name.includes('삼백집')) return 1947;
    if (name.includes('쏭타이') || name.includes('타이')) return 2012;
    if (name.includes('스타벅스')) return 1999;
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const yearOffset = Math.abs(hash) % 65;
    return 1950 + yearOffset;
  };

  const visitedRests = useMemo(() => {
    return restaurants.filter(r => visitedRestaurants.includes(r.id || '') || visitedRestaurants.includes(r.name));
  }, [restaurants, visitedRestaurants]);

  const totalHeritageAge = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return visitedRests.reduce((sum, r) => sum + (currentYear - getEstablishmentYear(r)), 0);
  }, [visitedRests]);

  const getHeritageTitleWithEmoji = (totalAge: number): string => {
    if (totalAge >= 1000) return '👑 조선 최고 수라간 상선';
    if (totalAge >= 500) return '⚔️ 영의정 미식대감';
    if (totalAge >= 300) return '👔 한양 참판 식객';
    if (totalAge >= 100) return '🐎 조선 미식 방랑자';
    return '🥄 초보 마실 식객';
  };

  // 5.2 미식 역사 연대기 캔버스 카드 다운로드
  const downloadWrappedCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. 배경 채우기 (사이버펑크 다크 바이올렛 그라디언트)
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, '#020617');
    grad.addColorStop(1, '#1e1b4b'); // indigo/violet
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 500, 800);

    // 2. 네온 테두리 그리기
    ctx.strokeStyle = '#ec4899'; // Pink Neon
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, 470, 770);

    ctx.strokeStyle = '#8b5cf6'; // Purple Neon 보조 라인
    ctx.lineWidth = 1.5;
    ctx.strokeRect(22, 22, 456, 756);

    // 3. 타이틀 및 헤더
    ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#06b6d4'; // Cyan
    ctx.textAlign = 'center';
    ctx.fillText('大東味地圖 : WRAPPED', 250, 80);

    ctx.font = '900 42px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('미식 역사 연대기', 250, 135);

    ctx.font = '500 13px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('내가 맛본 노포들의 찬란한 헤리티지 총결산', 250, 168);

    // 4. 중앙 장식선
    ctx.beginPath();
    ctx.moveTo(80, 200);
    ctx.lineTo(420, 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();

    // 5. 통계 박스 그리기
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(50, 230, 400, 240);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, 230, 400, 240);

    // 통계 내용
    ctx.font = 'bold 16px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('내가 소비한 노포의 역사 합계', 250, 275);

    ctx.font = '900 52px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#eab308'; // Gold
    ctx.fillText(`총 ${totalHeritageAge}년`, 250, 345);

    ctx.font = '500 13px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`방문한 전통 노포 개수: ${visitedRests.length}곳`, 250, 395);
    ctx.fillText(`평균 역사: ${visitedRests.length > 0 ? Math.round(totalHeritageAge / visitedRests.length) : 0}년`, 250, 420);

    // 6. 계급 아웃라인 박스
    ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
    ctx.fillRect(80, 500, 340, 60);
    ctx.strokeStyle = '#06b6d4';
    ctx.strokeRect(80, 500, 340, 60);

    const title = getHeritageTitleWithEmoji(totalHeritageAge);
    ctx.font = 'bold 20px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`미식 작호: ${title}`, 250, 538);

    // 7. 하단 안내문구
    ctx.font = '500 12px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('본 카드는 대동맛지도 앱에서 생성되었습니다.', 250, 680);

    ctx.font = 'bold 15px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('daedong-matjido.app', 250, 715);

    // 8. 파일 다운로드 트리거 (모바일/웹뷰 다운로드 실패 방어)
    const dataUrl = canvas.toDataURL('image/png');
    const isCapacitor = (window as unknown as { Capacitor?: unknown }).Capacitor !== undefined;
    if (isCapacitor || isMobile) {
      setDownloadModalTitle('미식 역사 연대기');
      setDownloadModalImage(dataUrl);
    } else {
      const link = document.createElement('a');
      link.download = `대동맛지도_역사연대기_${title.split(' ')[1] || '식객'}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // 10. Tinder 스타일 스와이프 매칭 상태 및 헬퍼
  const [mbtiTabMode, setMbtiTabMode] = useState<'quiz' | 'swipe'>('quiz');
  const [downloadModalImage, setDownloadModalImage] = useState<string | null>(null);
  const [downloadModalTitle, setDownloadModalTitle] = useState<string>('');
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [swipeLikes, setSwipeLikes] = useState<string[]>([]);
  const [swipeCompleted, setSwipeCompleted] = useState(false);
  const [showCouponVoucher, setShowCouponVoucher] = useState(false);
  const [swipeUserName, setSwipeUserName] = useState('');
  const [swipeResult, setSwipeResult] = useState<{ title: string; desc: string; tag: string } | null>(null);
  const [swipeLinkCopied, setSwipeLinkCopied] = useState(false);
  const [swipePool, setSwipePool] = useState<RestaurantRaw[]>([]);
  const [matchedResults, setMatchedResults] = useState<{
    commonLikes: RestaurantRaw[];
    syncRate: number;
  } | null>(null);

  // Drag states for Tinder-style card swiping
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasAutoActivatedRef = useRef(false);

  const matchParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const likes = params.get('likes');
    const name = params.get('senderName');
    return {
      senderLikes: likes ? likes.split(',') : [],
      senderName: name || ''
    };
  }, []);

  // Auto-activate MBTI swipe mode if deep linked with likes & senderName
  useEffect(() => {
    if (isOpen && matchParams.senderLikes.length > 0 && matchParams.senderName && !hasAutoActivatedRef.current) {
      hasAutoActivatedRef.current = true;
      setTimeout(() => {
        setActiveTab('mbti');
        setMbtiTabMode('swipe');
        
        // Clear likes and senderName from URL to prevent sticky redirect on subsequent opens
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('likes');
          url.searchParams.delete('senderName');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        } catch (e) {
          console.error('Failed to clear matchmaking query params:', e);
        }
      }, 0);
    }
  }, [isOpen, matchParams]);

  useEffect(() => {
    if (activeTab === 'mbti' && swipePool.length === 0 && restaurants.length > 0) {
      const candidates = isUnlocked
        ? restaurants
        : restaurants.filter(r => !top10Ids.includes(r.id || ''));

      const pool: RestaurantRaw[] = [];

      // 1. If senderLikes are present, prioritize them in the swipe pool
      if (matchParams.senderLikes && matchParams.senderLikes.length > 0) {
        matchParams.senderLikes.forEach(id => {
          const matched = candidates.find(r => r.id === id);
          if (matched && !pool.some(p => p.id === matched.id)) {
            pool.push(matched);
          }
        });
      }

      // 2. Add category-specific restaurants if we have room
      const categoriesList = ['한식', '일식', '중식', '양식', '분식', '육류', '기타'];
      categoriesList.forEach(cat => {
        if (pool.length >= 8) return;
        const matches = candidates.filter(r => r.category === cat);
        if (matches.length > 0) {
          const available = matches.filter(r => !pool.some(p => p.id === r.id));
          if (available.length > 0) {
            pool.push(available[Math.floor(Math.random() * available.length)]);
          }
        }
      });

      // 3. Fill up to 8 with random candidates
      while (pool.length < 8 && candidates.length > pool.length) {
        const rand = candidates[Math.floor(Math.random() * candidates.length)];
        if (!pool.some(r => r.id === rand.id)) {
          pool.push(rand);
        }
      }
      const sponsoredCard: RestaurantRaw = {
        id: 'sponsored_voucher_makgeolli',
        name: '🍶 [쿠폰] 주문진 생막걸리 무료 증정',
        category: '스폰서',
        address: '전국 대동맛지도 제휴 노포 매장',
        rating: 5.0,
        review: '대동맛지도 B2B 단독 제휴! 이 카드를 오른쪽(LIKE)으로 밀면, 대동맛지도 제휴 맛집/노포 방문 시 당일 테이블당 1병 무료 제공되는 주문진 생막걸리 쿠폰이 즉시 발급됩니다!',
        menu: '주문진 생막걸리 1병 무료 쿠폰',
        latitude: 0,
        longitude: 0
      };

      setTimeout(() => {
        const finalPool = [...pool.slice(0, 7)];
        if (finalPool.length >= 3) {
          finalPool.splice(3, 0, sponsoredCard);
        } else {
          finalPool.push(sponsoredCard);
        }
        setSwipePool(finalPool);
      }, 0);
    }
  }, [activeTab, restaurants, swipePool.length, isUnlocked, top10Ids, matchParams.senderLikes]);

  const handleSwipeFinish = (likes: string[] = swipeLikes) => {
    const realLikes = likes.filter(id => id !== 'sponsored_voucher_makgeolli');
    const categoriesCount: Record<string, number> = {};
    realLikes.forEach(id => {
      const r = restaurants.find(item => item.id === id);
      if (r) {
        categoriesCount[r.category] = (categoriesCount[r.category] || 0) + 1;
      }
    });

    let topCat = '한식';
    let maxVal = 0;
    Object.entries(categoriesCount).forEach(([cat, count]) => {
      if (count > maxVal) {
        maxVal = count;
        topCat = cat;
      }
    });

    let title = 'GMAT: 미식 만능 엔터테이너';
    let desc = '한식, 일식, 양식 가리지 않고 도전하는 만능 식객입니다. 편식하지 않고 새로운 맛집을 찾아 모험을 떠나는 데 특화되어 있습니다.';
    let tag = '#올라운더 #맛의잡식가 #도전정신';

    if (realLikes.length === 0) {
      title = 'LITE: 청정 소식주의자';
      desc = '음식을 가볍게 즐기고 소량으로 깔끔하게 먹는 것을 즐깁니다. 분위기 좋은 카페나 정갈한 한 그릇 요리를 선호합니다.';
      tag = '#소식가 #정갈함 #깔끔한한그릇';
    } else if (topCat === '한식') {
      title = 'LNTS: 노포 전통 탐험가';
      desc = '연탄불 향이 나는 골목길 전통 노포와 진한 국밥 한 그릇에서 영혼의 치유를 얻습니다. 화려함보다는 깊은 내공의 맛을 찾습니다.';
      tag = '#노포성지순례 #국밥매니아 #깊은국물';
    } else if (topCat === '일식' || topCat === '중식') {
      title = 'OSDM: 동양 미식 연구가';
      desc = '신선한 생선회와 묵직한 라멘, 혹은 불맛이 가득한 짬뽕과 고급 딤섬에서 맛의 과학을 느낍니다. 섬세한 식재료의 밸런스를 중시합니다.';
      tag = '#불맛매니아 #생선회덕후 #디테일한입맛';
    } else if (topCat === '양식') {
      title = 'CNMS: 트렌디 시티 미식가';
      desc = '화려한 파스타와 정밀하게 구워진 스테이크, 그리고 이국적인 소스에서 도시적인 감성을 즐깁니다. 힙하고 이색적인 레스토랑을 애정합니다.';
      tag = '#파스타투어 #와인페어링 #인스타감성';
    }

    setSwipeResult({ title, desc, tag });
    setSwipeCompleted(true);

    if (matchParams.senderLikes.length > 0) {
      const common = restaurants.filter(r => likes.includes(r.id || '') && matchParams.senderLikes.includes(r.id || ''));
      const rate = Math.round((common.length / Math.max(1, likes.length)) * 100);
      setMatchedResults({
        commonLikes: common,
        syncRate: rate
      });
    }
  };

  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    setDragOffset({ x: deltaX, y: deltaY });
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const SWIPE_THRESHOLD = 80;
    if (dragOffset.x > SWIPE_THRESHOLD) {
      // LIKE
      const currentCard = swipePool[swipeIndex];
      if (currentCard) {
        if (currentCard.id === 'sponsored_voucher_makgeolli') {
          setShowCouponVoucher(true);
        }
        const newLikes = [...swipeLikes, currentCard.id || ''];
        setSwipeLikes(newLikes);
        if (swipeIndex < swipePool.length - 1) {
          setSwipeIndex(swipeIndex + 1);
        } else {
          handleSwipeFinish(newLikes);
        }
      }
    } else if (dragOffset.x < -SWIPE_THRESHOLD) {
      // PASS
      if (swipeIndex < swipePool.length - 1) {
        setSwipeIndex(swipeIndex + 1);
      } else {
        handleSwipeFinish();
      }
    }

    setDragOffset({ x: 0, y: 0 });
  };

  const generateSwipeLink = () => {
    const name = swipeUserName.trim() || '친구';
    const likesParam = swipeLikes.join(',');
    const link = `${getShareOrigin()}${window.location.pathname}?likes=${likesParam}&senderName=${encodeURIComponent(name)}`;
    safeCopyToClipboard(link).then(() => {
      setSwipeLinkCopied(true);
      setTimeout(() => setSwipeLinkCopied(false), 2000);
    });
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen) return null;

  // 1.1 룰렛 후보 식당 5곳 셔플
  const prepareRoulette = (): RestaurantRaw[] => {
    if (restaurants.length === 0) return [];
    const pool = !isUnlocked
      ? restaurants.filter(r => !top10Ids.includes(r.id || ''))
      : restaurants;
    if (pool.length === 0) return [];
    const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 5);
    setRouletteList(shuffled);
    setRouletteWinner(null);
    return shuffled;
  };

  // 1.2 룰렛 회전 애니메이션
  const startSpin = () => {
    let currentList = rouletteList;
    if (currentList.length === 0) {
      currentList = prepareRoulette();
    }
    setIsSpinning(true);
    setRouletteWinner(null);

    // 2.5초 동안 네온 회전 모사 후 당첨자 선택
    setTimeout(() => {
      if (currentList.length === 0) {
        setIsSpinning(false);
        return;
      }
      const winner = currentList[Math.floor(Math.random() * currentList.length)];
      setRouletteWinner(winner);
      setIsSpinning(false);
    }, 2000);
  };

  // 2.1 MBTI 문항 답변 처리
  const handleMbtiAnswer = (score: string) => {
    const nextAnswers = [...mbtiAnswers, score];
    setMbtiAnswers(nextAnswers);

    if (currentQuestionIndex < MBTI_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // 결과 계산
      const code = nextAnswers.join('');
      // M/S (대기) + D/H (다대기) + N/C (노포) + K/E (대표메뉴)
      let title: string;
      let desc: string;
      let tag: string;

      if (code.includes('M') && code.includes('D')) {
        title = '👑 정통 미식 아카데미 학자';
        desc = '웨이팅 2시간도 불사하고 재료 본연의 맛을 분석하며 먹는 고집 있는 대식가입니다. 기교 넘치는 요리보다 깊은 내공을 지닌 정통 한식과 맑은 국물을 선호합니다.';
        tag = '#MDNC';
      } else if (code.includes('M') && code.includes('H')) {
        title = '🔥 불꽃 피크타임 노포 대장';
        desc = '화끈한 매운맛과 강렬한 세월의 맛을 사랑하는 정열적인 푸드파이터입니다. 시끌벅적한 야외 원형 테이블과 붉은빛 볶음/탕류 안주가 당신의 영혼을 울립니다.';
        tag = '#MHNK';
      } else if (code.includes('S') && code.includes('D')) {
        title = '⚡ 스마트 가성비 미식 비서';
        desc = '시간 낭비를 혐오하며 쾌적하고 효율적인 식사를 선호합니다. 깔끔하고 잘 정돈된 환경에서 자극적이지 않으면서도 세련되게 맛있는 메뉴를 합리적으로 선택합니다.';
        tag = '#SDCE';
      } else {
        title = '🧭 로컬 골목 노포 탐험가';
        desc = '새로운 요리와 독특한 안주 도전에 두려움이 없는 모험가 스타일입니다. 위생보다는 투박한 정과 이모카세의 맛에 매료되며, 항상 지인들을 새로운 골목으로 인도합니다.';
        tag = '#SHNE';
      }

      setMbtiResult({ title, desc, tag });
    }
  };

  // 2.2 MBTI 테스트 초기화
  const resetMbti = () => {
    setCurrentQuestionIndex(0);
    setMbtiAnswers([]);
    setMbtiResult(null);
  };

  // 3.1 커플 맛집 궁합 분석 실행
  const calculateCoupleCompatibility = () => {
    if (!partner1.trim() || !partner2.trim()) {
      alert('두 사람의 이름을 모두 입력해 주세요!');
      return;
    }

    const combinedName = (partner1 + partner2).trim();
    let hash = 0;
    for (let i = 0; i < combinedName.length; i++) {
      hash = combinedName.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);

    const score = 75 + (hash % 25); // 75% ~ 99%

    const baseRestaurants = !isUnlocked
      ? restaurants.filter(r => !top10Ids.includes(r.id || ''))
      : restaurants;

    let pool = baseRestaurants.filter(r => r.category === partner1Pref || r.category === partner2Pref);
    if (pool.length === 0) pool = baseRestaurants;

    const recommendedRestaurant = pool[hash % pool.length];

    let desc = `미식 성향이 아주 잘 어울리는 한 쌍입니다! 두 분 모두 맛에 대한 열정이 남다릅니다. `;
    if (partner1Pref === partner2Pref) {
      desc += `특히 두 분 다 '${partner1Pref}' 분야를 원픽으로 꼽으시는 환상의 미식 메이트네요!`;
    } else {
      desc += `'${partner1Pref}'를 좋아하는 ${partner1}님과 '${partner2Pref}'를 선호하는 ${partner2}님의 입맛을 절묘하게 결합할 데이트 코스를 추천해 드립니다.`;
    }

    setCoupleResult({
      score,
      recommendedRestaurant,
      desc
    });
  };

  const resetCouple = () => {
    setPartner1('');
    setPartner2('');
    setCoupleResult(null);
  };

  // 4.1 맛집 월드컵 시작
  const startWorldcup = () => {
    const pool = !isUnlocked
      ? restaurants.filter(r => !top10Ids.includes(r.id || ''))
      : restaurants;
    if (pool.length < 8) {
      alert('등록된 맛집 데이터가 부족합니다!');
      return;
    }
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setWorldcupList(shuffled.slice(0, 8));
    setWorldcupStage('round_8');
    setWorldcupIndex(0);
    setWorldcupNextRound([]);
    setWorldcupWinner(null);
  };

  // 4.2 매치 승자 선택
  const handleWorldcupSelect = (winner: RestaurantRaw) => {
    const nextRound = [...worldcupNextRound, winner];
    setWorldcupNextRound(nextRound);

    const nextIndex = worldcupIndex + 2;
    if (worldcupStage === 'round_8') {
      if (nextIndex < 8) {
        setWorldcupIndex(nextIndex);
      } else {
        setWorldcupList(nextRound);
        setWorldcupStage('round_4');
        setWorldcupIndex(0);
        setWorldcupNextRound([]);
      }
    } else if (worldcupStage === 'round_4') {
      if (nextIndex < 4) {
        setWorldcupIndex(nextIndex);
      } else {
        setWorldcupList(nextRound);
        setWorldcupStage('final');
        setWorldcupIndex(0);
        setWorldcupNextRound([]);
      }
    } else if (worldcupStage === 'final') {
      setWorldcupWinner(winner);
      setWorldcupStage('winner');
    }
  };

  const resetWorldcup = () => {
    setWorldcupStage('intro');
    setWorldcupList([]);
    setWorldcupIndex(0);
    setWorldcupNextRound([]);
    setWorldcupWinner(null);
  };

  // 3.1 단톡방 약속 메시지 템플릿 생성
  const generateMeetText = () => {
    const restName = meetRest.trim() || '대동맛지도 추천 매장';
    const text = `[📌 대동맛지도 공식 미식 약속초대장]

“7년 동안 직접 발로 뛰며 검증한 진짜 로컬 맛지도로 초대합니다!”

📅 약속일자: ${meetDate || '추후 결정'}
⏰ 모임시간: ${meetTime || '추후 결정'}
📍 모임장소: ${restName}
✉️ 알림메모: ${meetMemo || '늦는 사람 벌금! 맛보장 노포로 갑니다.'}

🗺️ '대동맛지도'에서 장소/리뷰 상세보기:
https://daedong.matjido.app/?res=${encodeURIComponent(restName)}

※ 네이버 플레이스 광고에 속지 않는 진짜 현지인 보증 맛집입니다.`;

    safeCopyToClipboard(text).then(() => {
      setShareTextCopied(true);
      setTimeout(() => setShareTextCopied(false), 2000);
    });
  };

  // 4.1 가상 샵 구매 처리
  const buyItem = (name: string, price: number) => {
    setReceiptItem({ name, price });
    setShowReceipt(true);
  };

  // Tiers calculation helpers
  const getHistoricalTierWithEmoji = (visitedCount: number): string => {
    if (visitedCount >= 100) return '🗺️ 미식 대동여지도 제작자';
    if (visitedCount >= 50) return '👑 노포 영의정';
    if (visitedCount >= 20) return '👔 로컬 현감';
    if (visitedCount >= 5) return '🏃 초보 식객';
    return '🥄 일반 식객';
  };

  // 5.1 인스타그램 인증 캔버스 카드 다운로드
  const downloadInstagramCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. 배경 채우기 (사이버펑크 다크 블루 그라디언트)
    const grad = ctx.createLinearGradient(0, 0, 0, 800);
    grad.addColorStop(0, '#030712');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 500, 800);

    // 2. 네온 테두리 그리기
    ctx.strokeStyle = '#06b6d4'; // Cyan Neon
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, 470, 770);

    ctx.strokeStyle = '#ec4899'; // Pink Neon 보조 라인
    ctx.lineWidth = 1.5;
    ctx.strokeRect(22, 22, 456, 756);

    // 3. 한문 로고 & 헤더 텍스트 그리기
    ctx.font = 'bold 12px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#f97316'; // Orange
    ctx.textAlign = 'center';
    ctx.fillText('大東味地圖', 250, 80);

    ctx.font = '900 42px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('대동맛지도', 250, 135);

    // 4. 홍보 포인트 서브타이틀
    ctx.font = '500 13px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('7년 동안 전국을 직접 가보고 기록한 노포 실증 지도', 250, 168);

    // 5. 중앙 장식선
    ctx.beginPath();
    ctx.moveTo(80, 200);
    ctx.lineTo(420, 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();

    // 6. 통계 뱃지 카드 박스 그리기
    ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
    ctx.fillRect(50, 230, 400, 240);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 230, 400, 240);

    // 통계 타이틀
    ctx.font = 'bold 18px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('나의 노포 정복 통계', 250, 270);

    // 방문한 식당 수 / 정복률 계산
    const totalCount = restaurants.length || 824;
    const visitedCount = visitedRestaurants.length;
    const percentage = ((visitedCount / totalCount) * 100).toFixed(1);

    ctx.font = 'bold 14px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`총 등록 매장: ${totalCount}곳`, 250, 315);
    ctx.fillText(`방문 완료: ${visitedCount}곳`, 250, 345);

    ctx.font = '900 34px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#eab308'; // Yellow
    ctx.fillText(`정복도: ${percentage}%`, 250, 410);

    // 7. 유저 등급 계산 및 네온 아웃라인
    const userGrade = getHistoricalTierWithEmoji(visitedCount);

    ctx.fillStyle = 'rgba(236, 72, 153, 0.1)';
    ctx.fillRect(80, 500, 340, 60);
    ctx.strokeStyle = '#ec4899';
    ctx.strokeRect(80, 500, 340, 60);

    ctx.font = 'bold 20px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`나의 등급 : ${userGrade}`, 250, 538);

    // 8. 하단 카피 및 QR영역
    ctx.font = '500 12px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('본 카드는 대동맛지도 앱에서 생성되었습니다.', 250, 680);

    ctx.font = 'bold 15px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('daedong-matjido.app', 250, 715);

    // 9. 파일 다운로드 트리거 (모바일/웹뷰 다운로드 실패 방어)
    const dataUrl = canvas.toDataURL('image/png');
    const isCapacitor = (window as unknown as { Capacitor?: unknown }).Capacitor !== undefined;
    if (isCapacitor || isMobile) {
      setDownloadModalTitle('미식 등급 인증서');
      setDownloadModalImage(dataUrl);
    } else {
      const link = document.createElement('a');
      link.download = `대동맛지도_정복인증_${userGrade.split(' ')[1] || '식객'}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  return (
    <div ref={containerRef} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 17, 0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: isMobile ? '8px' : '20px'
    }}>
      {/* 본문 글래스모피즘 모달 */}
      <div 
        className="glass-panel"
        style={{
          width: '760px',
          maxWidth: '100%',
          height: isMobile ? '95%' : '600px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          boxShadow: '0 0 30px rgba(6, 182, 212, 0.15)'
        }}
      >
        {/* 닫기 버튼 (데스크톱 전용 절대 배치) */}
        {!isMobile && (
          <button 
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              zIndex: 10
            }}
          >
            <X size={16} />
          </button>
        )}

        {isMobile && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 16px 8px 16px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderBottom: '1px solid var(--border-glass)',
            flexShrink: 0
          }}>
            <div>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent-orange)', letterSpacing: '0.1em' }}>大東味地圖 TOOL</div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc' }}>미식 툴킷</div>
            </div>
            <button 
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex'
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 좌측 탭 네비게이션 */}
        <div style={{
          width: isMobile ? '100%' : '200px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRight: isMobile ? 'none' : '1px solid var(--border-glass)',
          borderBottom: isMobile ? '1px solid var(--border-glass)' : 'none',
          padding: isMobile ? '8px 16px' : '20px 16px',
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap: '8px',
          overflowX: isMobile ? 'auto' : 'visible',
          flexShrink: 0
        }}>
          {!isMobile && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--accent-orange)', letterSpacing: '0.1em' }}>大東味地圖 TOOL</div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc' }}>미식 툴킷</div>
            </div>
          )}

          {([
            { id: 'roulette', label: '🎯 맛집 룰렛', icon: RotateCcw },
            { id: 'mbti', label: '🧠 미식 MBTI', icon: HelpCircle },
            { id: 'couple', label: '👩‍❤️‍👨 커플 궁합', icon: Heart },
            { id: 'worldcup', label: '🏆 맛집 월드컵', icon: Trophy },
            { id: 'course', label: '🗺️ 코스 플래너', icon: MapPin },
            { id: 'quiz', label: '🧠 미식 퀴즈', icon: Award },
            { id: 'share', label: '💬 단톡방 공유', icon: Share2 },
            { id: 'instagram', label: '📸 인증서 발급', icon: Camera },
            { id: 'shop', label: '🎁 기프트 샵', icon: Gift }
          ] as const).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent-cyan)' : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 우측 상세 패널 영역 */}
        <div style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          
          {/* TAB 1: 룰렛 돌리기 */}
          {activeTab === 'roulette' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>🎯 오늘 뭐 먹지? 복불복 룰렛</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>결정장애 해소! 7년 직접 발로 뛰며 보증한 824곳 중 1곳을 추천해 줍니다.</p>
              </div>

              {/* 룰렛 디스플레이 박스 */}
              <div className="ad-slot-box" style={{
                width: '300px',
                height: '180px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
                border: '2px dashed var(--accent-cyan)',
                background: 'rgba(6, 182, 212, 0.02)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {isSpinning ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '3px solid transparent',
                      borderTopColor: 'var(--accent-cyan)',
                      borderRightColor: 'var(--accent-pink)',
                      animation: 'spin 0.6s linear infinite'
                    }}></div>
                    <style>{`
                      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    `}</style>
                    <span style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: '700' }}>맛집 후보 엄선 중...</span>
                  </div>
                ) : rouletteWinner ? (
                  <div style={{ textAlign: 'center', padding: '16px' }} className="animate-fade-in">
                    <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(234,179,8,0.15)', color: 'var(--accent-yellow)', padding: '2px 6px', borderRadius: '4px' }}>
                      {rouletteWinner.category}
                    </span>
                    <h4 style={{ fontSize: '22px', fontWeight: '900', color: '#f8fafc', marginTop: '8px', marginBottom: '4px' }}>
                      {rouletteWinner.name}
                    </h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      {rouletteWinner.address}
                    </p>
                    <button
                      onClick={() => {
                        onSelectRestaurant(rouletteWinner);
                        onClose();
                      }}
                      style={{
                        padding: '6px 14px',
                        background: 'var(--accent-cyan)',
                        color: '#020617',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      상세 정보 및 위치 보기
                    </button>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    [ 돌리기 ] 버튼을 클릭해 주세요!
                  </div>
                )}
              </div>

              {/* 조작 버튼 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={prepareRoulette}
                  style={{
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    color: '#f8fafc',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  후보 셔플하기
                </button>
                <button
                  onClick={startSpin}
                  disabled={isSpinning}
                  style={{
                    padding: '10px 24px',
                    background: 'var(--accent-cyan)',
                    color: '#020617',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)'
                  }}
                >
                  룰렛 START
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 미식 MBTI 테스트 및 틴더 스와이프 */}
          {activeTab === 'mbti' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '2px' }}>🧠 나의 미식 성향 테스트 (MBTI)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>재미있는 퀴즈나 틴더 스와이프를 통해 미식 성향과 친구 매칭을 즐겨보세요.</p>
              </div>

              {/* 모드 선택 토글 버튼 */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
                <button
                  onClick={() => setMbtiTabMode('quiz')}
                  style={{
                    padding: '6px 12px',
                    background: mbtiTabMode === 'quiz' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    color: mbtiTabMode === 'quiz' ? '#020617' : '#cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📝 질문지 성향 분석
                </button>
                <button
                  onClick={() => setMbtiTabMode('swipe')}
                  style={{
                    padding: '6px 12px',
                    background: mbtiTabMode === 'swipe' ? 'var(--accent-orange)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    color: mbtiTabMode === 'swipe' ? '#020617' : '#cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  🔥 틴더식 스와이프 매칭
                </button>
              </div>

              {mbtiTabMode === 'quiz' ? (
                // 1. 기존 질문지 모드
                !mbtiResult ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '20px',
                    borderRadius: '12px',
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--accent-orange)', fontWeight: '700' }}>
                      <span>미식 성향 진단 진행율</span>
                      <span>{currentQuestionIndex + 1} / {MBTI_QUESTIONS.length}</span>
                    </div>

                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.4' }}>
                      {MBTI_QUESTIONS[currentQuestionIndex].question}
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {MBTI_QUESTIONS[currentQuestionIndex].options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleMbtiAnswer(opt.score)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1.5px solid rgba(255,255,255,0.05)',
                            background: 'rgba(30, 41, 59, 0.4)',
                            color: '#cbd5e1',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-orange)';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.color = '#cbd5e1';
                          }}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(249, 115, 22, 0.03)',
                    border: '1.5px solid rgba(249, 115, 22, 0.25)',
                    padding: '20px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center',
                    textAlign: 'center'
                  }} className="animate-fade-in">
                    <span style={{ fontSize: '10px', color: 'var(--accent-orange)', fontWeight: '900', letterSpacing: '0.1em' }}>
                      YOUR GOURMET MBTI TYPE
                    </span>
                    <h4 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--accent-orange)' }}>
                      {mbtiResult.title}
                    </h4>
                    <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>
                      {mbtiResult.tag}
                    </span>
                    <p style={{ fontSize: '12px', lineHeight: '1.5', color: '#cbd5e1', margin: '4px 0', wordBreak: 'keep-all' }}>
                      {mbtiResult.desc}
                    </p>
                    
                    <button
                      onClick={resetMbti}
                      style={{
                        marginTop: '8px',
                        padding: '8px 16px',
                        background: 'rgba(249, 115, 22, 0.15)',
                        color: 'var(--accent-orange)',
                        border: '1px solid rgba(249, 115, 22, 0.3)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      테스트 다시하기
                    </button>
                  </div>
                )
              ) : (
                // 2. 틴더식 스와이프 매칭 모드
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  {matchParams.senderName && (
                    <div style={{
                      background: 'rgba(236, 72, 153, 0.15)',
                      border: '1px solid var(--accent-pink)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '11px',
                      color: '#fff',
                      textAlign: 'center',
                      marginBottom: '6px',
                      fontWeight: '700',
                      boxShadow: '0 0 10px rgba(236, 72, 153, 0.2)'
                    }}>
                      💌 {matchParams.senderName}님이 보낸 미식 궁합 챌린지! 스와이프 완료 후 매치 확인!
                    </div>
                  )}

                  {!swipeCompleted ? (
                    swipePool.length > 0 && swipeIndex < swipePool.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', maxWidth: '280px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                          매칭 카드 ({swipeIndex + 1} / {swipePool.length})
                        </div>
                        
                        <div 
                          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                          onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                          onMouseUp={handleDragEnd}
                          onMouseLeave={handleDragEnd}
                          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
                          onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
                          onTouchEnd={handleDragEnd}
                          style={{
                            width: '100%',
                            height: '220px',
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '2px solid var(--accent-orange)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)',
                            textAlign: 'center',
                            position: 'relative',
                            transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${dragOffset.x * 0.08}deg)`,
                            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            touchAction: 'none'
                          }}
                        >
                          {/* LIKE stamp */}
                          {dragOffset.x > 15 && (
                            <div style={{
                              position: 'absolute',
                              top: '20px',
                              left: '20px',
                              border: '3px solid #10b981',
                              color: '#10b981',
                              fontSize: '18px',
                              fontWeight: '900',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              transform: 'rotate(-15deg)',
                              opacity: Math.min(Math.abs(dragOffset.x) / 60, 0.9),
                              zIndex: 20,
                              pointerEvents: 'none'
                            }}>
                              LIKE
                            </div>
                          )}

                          {/* PASS stamp */}
                          {dragOffset.x < -15 && (
                            <div style={{
                              position: 'absolute',
                              top: '20px',
                              right: '20px',
                              border: '3px solid #ef4444',
                              color: '#ef4444',
                              fontSize: '18px',
                              fontWeight: '900',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              transform: 'rotate(15deg)',
                              opacity: Math.min(Math.abs(dragOffset.x) / 60, 0.9),
                              zIndex: 20,
                              pointerEvents: 'none'
                            }}>
                              PASS
                            </div>
                          )}
                          <div style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            fontSize: '9px',
                            background: 'rgba(255,255,255,0.08)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#94a3b8',
                            fontWeight: '800'
                          }}>
                            {swipePool[swipeIndex].category}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'center', fontSize: '38px', marginTop: '12px' }}>
                            {swipePool[swipeIndex].category === '한식' ? '🍜' : 
                             swipePool[swipeIndex].category === '일식' ? '🍣' : 
                             swipePool[swipeIndex].category === '중식' ? '🥢' : 
                             swipePool[swipeIndex].category === '양식' ? '🍕' : 
                             swipePool[swipeIndex].category === '분식' ? '🍢' : 
                             swipePool[swipeIndex].category === '육류' ? '🥩' : '🍽️'}
                          </div>

                          <div>
                            <h4 style={{ fontSize: '17px', fontWeight: '900', color: '#fff' }}>{swipePool[swipeIndex].name}</h4>
                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {swipePool[swipeIndex].address}
                            </p>
                          </div>

                          <p style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic', margin: '4px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            "{swipePool[swipeIndex].review}"
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                          <button
                            onClick={() => {
                              if (swipeIndex < swipePool.length - 1) {
                                setSwipeIndex(swipeIndex + 1);
                              } else {
                                handleSwipeFinish();
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1.5px solid #ef4444',
                              color: '#ef4444',
                              borderRadius: '8px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              fontSize: '12px',
                              transition: 'all 0.2s'
                            }}
                          >
                            🙅 PASS
                          </button>
                          <button
                            onClick={() => {
                              const currentCard = swipePool[swipeIndex];
                              if (currentCard.id === 'sponsored_voucher_makgeolli') {
                                setShowCouponVoucher(true);
                              }
                              const newLikes = [...swipeLikes, currentCard.id || ''];
                              setSwipeLikes(newLikes);
                              if (swipeIndex < swipePool.length - 1) {
                                setSwipeIndex(swipeIndex + 1);
                              } else {
                                handleSwipeFinish(newLikes);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1.5px solid #10b981',
                              color: '#10b981',
                              borderRadius: '8px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              fontSize: '12px',
                              transition: 'all 0.2s'
                            }}
                          >
                            🙆 LIKE
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>식당 데이터를 불러오는 중...</div>
                    )
                  ) : (
                    <div style={{
                      background: 'rgba(249, 115, 22, 0.03)',
                      border: '1.5px solid rgba(249, 115, 22, 0.25)',
                      padding: '16px',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      alignItems: 'center',
                      textAlign: 'center',
                      width: '100%',
                      maxWidth: '320px'
                    }} className="animate-fade-in">
                      <span style={{ fontSize: '9px', color: 'var(--accent-orange)', fontWeight: '900', letterSpacing: '0.15em' }}>
                        GOURMET SWIPE MATCH
                      </span>
                      <h4 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--accent-orange)' }}>
                        {swipeResult?.title}
                      </h4>
                      <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8' }}>
                        {swipeResult?.tag}
                      </span>
                      <p style={{ fontSize: '11px', lineHeight: '1.4', color: '#cbd5e1', margin: '2px 0' }}>
                        {swipeResult?.desc}
                      </p>

                      {matchedResults && matchParams.senderName && (
                        <div style={{
                          width: '100%',
                          background: 'rgba(236, 72, 153, 0.08)',
                          border: '1.5px solid var(--accent-pink)',
                          padding: '10px',
                          borderRadius: '8px',
                          textAlign: 'left',
                          marginTop: '2px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--accent-pink)', fontWeight: '800' }}>
                            <span>🤝 {matchParams.senderName}님과의 미식 싱크로율</span>
                            <span>{matchedResults.syncRate}%</span>
                          </div>
                          <div style={{ marginTop: '6px' }}>
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>서로 '가보고싶음' 응답한 매장:</div>
                            {matchedResults.commonLikes.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                                {matchedResults.commonLikes.map((r, i) => (
                                  <div key={i} style={{ fontSize: '10px', color: '#fff', fontWeight: '600' }}>
                                    🍜 {r.name} ({r.category})
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                겹치는 식당이 없습니다. 다른 메뉴로 함께 도전해 보세요!
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div style={{ width: '100%', marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                        <label style={{ display: 'block', fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: '700', textAlign: 'left' }}>
                          내 닉네임 입력
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="닉네임 입력..."
                            value={swipeUserName}
                            onChange={e => setSwipeUserName(e.target.value)}
                            style={{ flex: 1, padding: '5px 8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '11px', outline: 'none' }}
                          />
                          <button
                            onClick={generateSwipeLink}
                            style={{
                              padding: '5px 10px',
                              background: 'var(--accent-cyan)',
                              color: '#020617',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                          >
                            {swipeLinkCopied ? '복사 완료!' : '궁합 링크 생성'}
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSwipeIndex(0);
                          setSwipeLikes([]);
                          setSwipeCompleted(false);
                          setShowCouponVoucher(false);
                          setSwipeResult(null);
                          setMatchedResults(null);
                          setSwipePool([]);
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '6px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#cbd5e1',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          width: '100%'
                        }}
                      >
                        매칭 다시하기
                      </button>
                    </div>
                  )}
              {/* 🍶 스폰서 쿠폰 발급 오버레이 모달 */}
              {showCouponVoucher && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(2, 6, 17, 0.95)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 20
                }} className="animate-fade-in">
                  <div style={{
                    width: '280px',
                    background: '#1e293b',
                    border: '1.5px solid var(--accent-yellow)',
                    borderRadius: '12px',
                    padding: '20px',
                    position: 'relative',
                    textAlign: 'center',
                    boxShadow: '0 0 20px rgba(234, 179, 8, 0.3)'
                  }}>
                    <span style={{ fontSize: '24px' }}>🎁</span>
                    <h4 style={{ fontSize: '16px', fontWeight: '900', color: '#f8fafc', marginTop: '10px', marginBottom: '2px' }}>
                      스폰서 쿠폰 발급 완료!
                    </h4>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      대동맛지도 B2B 제휴 노포 방문 시 본 쿠폰을 제시해주세요.
                    </p>
                    
                    {/* 쿠폰 영수증 정보 */}
                    <div style={{
                      textAlign: 'left',
                      fontSize: '11px',
                      color: '#cbd5e1',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '12px',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      marginBottom: '16px',
                      fontFamily: 'monospace'
                    }}>
                      <div style={{ color: 'var(--accent-yellow)', fontWeight: '800' }}>[혜택] 주문진 생막걸리 1병 무료</div>
                      <div>[가맹] 전국 대동맛지도 제휴 노포</div>
                      <div>[기한] 2026년 12월 31일 까지</div>
                      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', textAlign: 'center', fontSize: '9px', letterSpacing: '2px', color: '#94a3b8' }}>
                        ||||| | |||| | ||| |||| ||
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '9px', color: '#64748b' }}>
                        DMAT-MAK-2026-NEON
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          safeCopyToClipboard('DMAT-MAK-2026-NEON')
                            .then(() => alert('쿠폰 코드가 복사되었습니다!'))
                            .catch(() => alert('복사에 실패했습니다.'));
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#cbd5e1',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        코드 복사
                      </button>
                      <button
                        onClick={() => setShowCouponVoucher(false)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          background: 'var(--accent-yellow)',
                          color: '#020617',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        확인
                      </button>
                    </div>
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
          )}

          {/* TAB: 커플 맛집 궁합 */}
          {activeTab === 'couple' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>👩‍❤️‍👨 커플 맛집 궁합 & 미식 데이트 매칭</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>두 사람의 최애 메뉴와 성향을 섞어 오늘 완벽한 100% 매칭 데이트 맛집을 추천합니다.</p>
              </div>

              {!coupleResult ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '20px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--accent-pink)', marginBottom: '4px', fontWeight: '700' }}>내 이름</label>
                      <input 
                        type="text" 
                        placeholder="이름 입력"
                        value={partner1}
                        onChange={e => setPartner1(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--accent-cyan)', marginBottom: '4px', fontWeight: '700' }}>상대방 이름</label>
                      <input 
                        type="text" 
                        placeholder="이름 입력"
                        value={partner2}
                        onChange={e => setPartner2(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>나의 선호 카테고리</label>
                      <select 
                        value={partner1Pref} 
                        onChange={e => setPartner1Pref(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      >
                        {['한식', '중식', '일식', '양식', '분식', '육류'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>상대방 선호 카테고리</label>
                      <select 
                        value={partner2Pref} 
                        onChange={e => setPartner2Pref(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', background: '#1e293b', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      >
                        {['한식', '중식', '일식', '양식', '분식', '육류'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={calculateCoupleCompatibility}
                    style={{
                      marginTop: '8px',
                      padding: '11px 0',
                      background: 'var(--accent-pink)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(236, 72, 153, 0.3)'
                    }}
                  >
                    💖 궁합 분석하기
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(236, 72, 153, 0.03)',
                  border: '1.5px solid rgba(236, 72, 153, 0.25)',
                  padding: '24px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignItems: 'center'
                }} className="animate-fade-in">
                  <span style={{ fontSize: '11px', color: 'var(--accent-pink)', fontWeight: '900', letterSpacing: '0.1em' }}>
                    GOURMET COUPLING MATCH
                  </span>
                  <h4 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-pink)' }}>
                    {partner1} ♥ {partner2} 미식 궁합: {coupleResult.score}%
                  </h4>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#e2e8f0', margin: '4px 0', wordBreak: 'keep-all' }}>
                    {coupleResult.desc}
                  </p>

                  <div style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid var(--border-glass)',
                    padding: '14px',
                    borderRadius: '8px',
                    width: '100%',
                    textAlign: 'left'
                  }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', padding: '2px 6px', borderRadius: '4px' }}>
                      추천 데이트 맛집
                    </span>
                    <h5 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginTop: '6px' }}>
                      {coupleResult.recommendedRestaurant.name} ({coupleResult.recommendedRestaurant.category})
                    </h5>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {coupleResult.recommendedRestaurant.address}
                    </p>
                    <p style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                      "{coupleResult.recommendedRestaurant.review}"
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                    <button
                      onClick={resetCouple}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#f8fafc',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      다시 분석하기
                    </button>
                    <button
                      onClick={() => {
                        onSelectRestaurant(coupleResult.recommendedRestaurant);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        background: 'var(--accent-cyan)',
                        color: '#020617',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      지도에서 보기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: 맛집 이상형 월드컵 */}
          {activeTab === 'worldcup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>🏆 824곳 보증 전국 맛집 월드컵 (8강)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>엄선된 대동맛지도 맛집 8곳 중 최종 나의 최애 식당 1곳을 찾아냅니다.</p>
              </div>

              {worldcupStage === 'intro' && (
                <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: '12px' }}>
                  <Trophy size={48} style={{ color: 'var(--accent-yellow)', marginBottom: '16px', marginInline: 'auto' }} />
                  <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginBottom: '8px' }}>전국 대동맛지도 월드컵</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '300px', marginInline: 'auto', lineHeight: '1.5' }}>
                    실제 7년 실방문 맛집 8곳을 랜덤 매칭하여 대결합니다. 친구들과 함께 골라보세요!
                  </p>
                  <button
                    onClick={startWorldcup}
                    style={{
                      padding: '11px 32px',
                      background: 'var(--accent-yellow)',
                      color: '#020617',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(234, 179, 8, 0.3)'
                    }}
                  >
                    월드컵 시작하기
                  </button>
                </div>
              )}

              {/* 월드컵 진행 화면 */}
              {(worldcupStage === 'round_8' || worldcupStage === 'round_4' || worldcupStage === 'final') && worldcupList.length >= 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* 헤더 정보 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: 'var(--accent-yellow)' }}>
                    <span>
                      {worldcupStage === 'round_8' ? '🔥 8강전' : worldcupStage === 'round_4' ? '🌟 준결승전 (4강)' : '👑 결승전'}
                    </span>
                    <span>
                      매치 { (worldcupIndex / 2) + 1 } / { worldcupList.length / 2 }
                    </span>
                  </div>

                  {/* 대결 격자 */}
                  <div style={{ display: 'flex', gap: '12px', flexDirection: isMobile ? 'column' : 'row' }}>
                    {/* 후보 매핑 */}
                    {[worldcupList[worldcupIndex], worldcupList[worldcupIndex + 1]].map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleWorldcupSelect(item)}
                        style={{
                          flex: 1,
                          background: 'rgba(30, 41, 59, 0.45)',
                          border: '1.5px solid rgba(255,255,255,0.04)',
                          borderRadius: '12px',
                          padding: '20px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '12px',
                          minHeight: '180px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent-yellow)';
                          e.currentTarget.style.background = 'rgba(234, 179, 8, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.background = 'rgba(30, 41, 59, 0.45)';
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                            {item.category}
                          </span>
                          <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#fff', marginTop: '10px' }}>{item.name}</h4>
                          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.address.split(' ').slice(0,2).join(' ')}</p>
                        </div>
                        <p style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          "{item.review}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 월드컵 우승자 화면 */}
              {worldcupStage === 'winner' && worldcupWinner && (
                <div style={{
                  background: 'rgba(234, 179, 8, 0.03)',
                  border: '1.5px solid rgba(234, 179, 8, 0.3)',
                  padding: '24px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignItems: 'center'
                }} className="animate-fade-in">
                  <Trophy size={40} style={{ color: 'var(--accent-yellow)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--accent-yellow)', fontWeight: '900', letterSpacing: '0.12em' }}>
                    YOUR FINAL WINNER
                  </span>
                  <h4 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-yellow)' }}>
                    {worldcupWinner.name}
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{worldcupWinner.address}</p>
                  
                  <div style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid var(--border-glass)',
                    padding: '12px',
                    borderRadius: '8px',
                    width: '100%',
                    textAlign: 'left'
                  }}>
                    <p style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5', fontStyle: 'italic' }}>
                      "{worldcupWinner.review}"
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                    <button
                      onClick={resetWorldcup}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#f8fafc',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      새 게임 시작
                    </button>
                    <button
                      onClick={() => {
                        onSelectRestaurant(worldcupWinner);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        background: 'var(--accent-cyan)',
                        color: '#020617',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      지도에서 보기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: 단톡방 공유기 */}
          {activeTab === 'share' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '2px' }}>💬 단톡방 회식/약속 메이커</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>모임 정보와 7년 검증 맛집의 고유 링크를 예쁜 초대장으로 가공해 복사합니다.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>약속 일자</label>
                    <input 
                      type="date" 
                      value={meetDate} 
                      onChange={e => setMeetDate(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>모임 시간</label>
                    <input 
                      type="time" 
                      value={meetTime} 
                      onChange={e => setMeetTime(e.target.value)}
                      style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>맛집명 지정</label>
                  <input 
                    type="text" 
                    placeholder="예: 짱수양꼬치 (824개 식당 중 약속 장소를 적으세요)" 
                    value={meetRest} 
                    onChange={e => setMeetRest(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: '700' }}>친구들에게 남길 메모</label>
                  <textarea 
                    placeholder="예: 지각 벌금 1만원! 7년 직접 발로 뛰며 맛 검증한 인생 맛집입니다." 
                    value={meetMemo} 
                    onChange={e => setMeetMemo(e.target.value)}
                    style={{ width: '100%', height: '50px', padding: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '6px', color: '#fff', fontSize: '12px', resize: 'none' }}
                  />
                </div>
              </div>

              <button
                onClick={generateMeetText}
                style={{
                  width: '100%',
                  padding: '11px 0',
                  background: shareTextCopied ? 'var(--accent-green)' : 'var(--accent-cyan)',
                  color: '#020617',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                {shareTextCopied ? '초대장 문구 복사 완료!' : '카카오톡 공유 문구 복사하기'}
              </button>
            </div>
          )}

          {/* TAB 4: 인스타그램 정복도 카드 및 미식 역사 연대기 Wrapped */}
          {activeTab === 'instagram' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>📸 미식 인증 및 연대기 카드 발급</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>나의 맛집 통계를 고화질 네온 카드로 발급받아 인스타 스토리에 공유하세요!</p>
              </div>

              {/* 스타일 선택 토글 */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '4px' }}>
                <button
                  onClick={() => setInstagramTabMode('tier')}
                  style={{
                    padding: '6px 12px',
                    background: instagramTabMode === 'tier' ? 'var(--accent-pink)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    color: instagramTabMode === 'tier' ? '#ffffff' : '#cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📸 대동 노포 도감
                </button>
                <button
                  onClick={() => setInstagramTabMode('wrapped')}
                  style={{
                    padding: '6px 12px',
                    background: instagramTabMode === 'wrapped' ? 'var(--accent-pink)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-glass)',
                    color: instagramTabMode === 'wrapped' ? '#ffffff' : '#cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  📊 미식 역사 연대기
                </button>
              </div>

              {instagramTabMode === 'tier' ? (
                // 1. 기존 노포 도감 프리뷰
                <div style={{
                  width: '190px',
                  height: '304px',
                  background: 'linear-gradient(to bottom, #030712, #0f172a)',
                  border: '2px solid var(--accent-cyan)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '6px', color: 'var(--accent-orange)', fontWeight: '800', letterSpacing: '0.15em' }}>大東味地圖</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#fff', marginTop: '2px' }}>대동맛지도</div>
                    <div style={{ fontSize: '5px', color: '#64748b', marginTop: '2px' }}>7년 실방문 맛집 보증 인증</div>
                  </div>

                  <div style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '10px', borderRadius: '4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: '8px', color: 'var(--accent-cyan)', fontWeight: '700', marginBottom: '4px' }}>나의 노포 정복 통계</div>
                    <div style={{ fontSize: '7px', color: '#cbd5e1' }}>방문 완료: {visitedRestaurants.length}곳</div>
                    <div style={{ fontSize: '14px', color: 'var(--accent-yellow)', fontWeight: '900', marginTop: '4px' }}>
                      정복률: {((visitedRestaurants.length / (restaurants.length || 824)) * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div style={{
                    background: 'rgba(236, 72, 153, 0.1)',
                    border: '1px solid #ec4899',
                    padding: '4px',
                    borderRadius: '3px',
                    textAlign: 'center',
                    fontSize: '8px',
                    color: '#fff',
                    fontWeight: '700'
                  }}>
                    등급: {getHistoricalTierWithEmoji(visitedRestaurants.length)}
                  </div>
                </div>
              ) : (
                // 2. 미식 역사 연대기 프리뷰 (Wrapped)
                <div style={{
                  width: '190px',
                  height: '304px',
                  background: 'linear-gradient(to bottom, #020617, #1e1b4b)',
                  border: '2px solid var(--accent-pink)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 0 15px rgba(236, 72, 153, 0.2)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '6px', color: 'var(--accent-cyan)', fontWeight: '800', letterSpacing: '0.1em' }}>大東味地圖 : WRAPPED</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#fff', marginTop: '2px' }}>역사 연대기</div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '4px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: '8px', color: 'var(--accent-pink)', fontWeight: '700', marginBottom: '2px' }}>노포의 역사 합계</div>
                    <div style={{ fontSize: '20px', color: 'var(--accent-yellow)', fontWeight: '900', margin: '2px 0' }}>{totalHeritageAge}년</div>
                    <div style={{ fontSize: '6px', color: '#cbd5e1' }}>방문 식당 수: {visitedRests.length}곳</div>
                  </div>

                  <div style={{
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid #06b6d4',
                    padding: '4px',
                    borderRadius: '3px',
                    textAlign: 'center',
                    fontSize: '7px',
                    color: '#fff',
                    fontWeight: '700'
                  }}>
                    작호: {getHeritageTitleWithEmoji(totalHeritageAge).split(' ')[1] || '식객'}
                  </div>
                </div>
              )}

              {/* 숨겨진 캔버스 */}
              <canvas 
                ref={canvasRef} 
                width={500} 
                height={800} 
                style={{ display: 'none' }} 
              />

              <button
                onClick={instagramTabMode === 'tier' ? downloadInstagramCard : downloadWrappedCard}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 24px',
                  background: 'var(--accent-pink)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(236, 72, 153, 0.4)'
                }}
              >
                <Camera size={14} />
                고화질 인증 카드 이미지 다운로드
              </button>
            </div>
          )}

          {/* TAB 5: 기프트 샵 */}
          {activeTab === 'shop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '2px' }}>🎁 대동맛지도 공식 기프트 샵</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>집에서도 즐기는 대동맛지도 보증 맛집들의 시그니처 전통주와 밀키트 컬렉션</p>
              </div>

              {/* 상품 목록 격자 그리드 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '12px',
                flex: 1
              }}>
                {[
                  { name: '🍲 강릉 망치매운탕 2인 밀키트', desc: '강릉 시골식당 비법 육수 그대로!', price: 24000 },
                  { name: '🍶 대동맛지도 전통주 페어링 세트', desc: '전국 양조장 협업 노포 전용 소주', price: 32000 },
                  { name: '🔥 공주 뼈다귀탕 뚝배기 간편 밀키트', desc: '25시 뼈다귀탕의 진한 고기듬뿍 탕', price: 18000 },
                  { name: '🍻 네온 홀로그램 전용 소맥잔 2ea', desc: '사이버펑크 네온 이펙트 굿즈', price: 9900 }
                ].map((item, idx) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'rgba(30, 41, 59, 0.4)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc' }}>{item.name}</h4>
                      <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{item.desc}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--accent-yellow)', fontWeight: '700' }}>{item.price.toLocaleString()} 원</span>
                      <button
                        onClick={() => buyItem(item.name, item.price)}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(234, 179, 8, 0.1)',
                          border: '1px solid rgba(234, 179, 8, 0.2)',
                          color: 'var(--accent-yellow)',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        주문하기
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 영수증 모달 오버레이 */}
              {showReceipt && receiptItem && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(2, 6, 17, 0.95)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 20
                }} className="animate-fade-in">
                  <div style={{
                    width: '280px',
                    background: '#1e293b',
                    border: '1.5px solid var(--accent-yellow)',
                    borderRadius: '12px',
                    padding: '20px',
                    position: 'relative',
                    textAlign: 'center',
                    boxShadow: '0 0 20px rgba(234, 179, 8, 0.3)'
                  }}>
                    <span style={{ fontSize: '24px' }}>🎉</span>
                    <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc', marginTop: '10px', marginBottom: '2px' }}>주문 완료!</h4>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '16px' }}>모의 결제가 무사히 완료되었습니다.</p>
                    
                    {/* 영수증 정보 */}
                    <div style={{
                      textAlign: 'left',
                      fontSize: '11px',
                      color: '#cbd5e1',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '12px',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      marginBottom: '16px',
                      fontFamily: 'monospace'
                    }}>
                      <div>[상품] {receiptItem.name.split(' ').slice(1).join(' ')}</div>
                      <div>[금액] {receiptItem.price.toLocaleString()} 원</div>
                      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px' }}>[승인] 모의 토스페이먼츠 승인</div>
                    </div>

                    <button
                      onClick={() => setShowReceipt(false)}
                      style={{
                        width: '100%',
                        padding: '8px 0',
                        background: 'var(--accent-yellow)',
                        color: '#020617',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      확인
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: 코스 플래너 */}
          {activeTab === 'course' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '2px' }}>🗺️ 노포 코스 플래너 (Course Planner)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  여러 노포 맛집을 차례대로 묶어 나만의 동선을 설계하고, 친구들과 지도 경로를 링크로 공유해보세요!
                </p>
              </div>

              {/* 맛집 추가 셀렉터 */}
              <div style={{
                display: 'flex',
                gap: '8px',
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <select
                  value={courseSelectVal}
                  onChange={(e) => setCourseSelectVal(e.target.value)}
                  style={{
                    flex: 1,
                    background: '#0f172a',
                    border: '1.5px solid var(--border-glass)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    padding: '8px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="">-- 추가할 노포 맛집 선택 --</option>
                  {restaurants
                    .filter(r => isUnlocked || !top10Ids.includes(r.id || ''))
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        [{r.category}] {r.name} - {r.address}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => {
                    if (!courseSelectVal) return;
                    if (routeRestaurants.length >= 5) {
                      alert('⚠️ 코스는 최대 5개 노포까지만 구성할 수 있습니다. (네이버/카카오 지도 길찾기 연동 한계)');
                      return;
                    }
                    const rest = restaurants.find(r => r.id === courseSelectVal);
                    if (rest && !routeRestaurants.some(r => r.id === rest.id)) {
                      setRouteRestaurants([...routeRestaurants, rest]);
                    }
                    setCourseSelectVal('');
                  }}
                  style={{
                    padding: '0 16px',
                    background: 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-cyan) 100%)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  코스 추가
                </button>
              </div>

              {/* 선택된 코스 목록 */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255,255,255,0.03)',
                borderRadius: '8px',
                padding: '12px',
                minHeight: '150px'
              }}>
                {routeRestaurants.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    textAlign: 'center',
                    lineHeight: '1.6'
                  }}>
                    선택된 코스가 없습니다.<br />위 셀렉터에서 방문할 맛집들을 코스에 순서대로 추가해주세요.
                  </div>
                ) : (
                  routeRestaurants.map((rest, index) => (
                    <div
                      key={rest.id}
                      style={{
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1.5px solid rgba(6, 182, 212, 0.15)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '20px',
                          height: '20px',
                          background: 'var(--accent-cyan)',
                          color: '#020617',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '900'
                        }}>
                          {index + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#f8fafc' }}>
                            {rest.name}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            [{rest.category}] {rest.address}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          disabled={index === 0}
                          onClick={() => {
                            const newRoute = [...routeRestaurants];
                            const temp = newRoute[index];
                            newRoute[index] = newRoute[index - 1];
                            newRoute[index - 1] = temp;
                            setRouteRestaurants(newRoute);
                          }}
                          style={{
                            padding: '4px 6px',
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: index === 0 ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                            borderRadius: '4px',
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '10px'
                          }}
                        >
                          ▲
                        </button>
                        <button
                          disabled={index === routeRestaurants.length - 1}
                          onClick={() => {
                            const newRoute = [...routeRestaurants];
                            const temp = newRoute[index];
                            newRoute[index] = newRoute[index + 1];
                            newRoute[index + 1] = temp;
                            setRouteRestaurants(newRoute);
                          }}
                          style={{
                            padding: '4px 6px',
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: index === routeRestaurants.length - 1 ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                            borderRadius: '4px',
                            cursor: index === routeRestaurants.length - 1 ? 'not-allowed' : 'pointer',
                            fontSize: '10px'
                          }}
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => {
                            setRouteRestaurants(routeRestaurants.filter(r => r.id !== rest.id));
                          }}
                          style={{
                            padding: '4px 6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: 'none',
                            color: '#ef4444',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 내비게이션 연동 내보내기 버튼 */}
              {routeRestaurants.length >= 2 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const first = routeRestaurants[0];
                      const last = routeRestaurants[routeRestaurants.length - 1];
                      const intermediates = routeRestaurants.slice(1, routeRestaurants.length - 1);
                      let webUrl = `https://map.kakao.com/?sY=${first.latitude}&sX=${first.longitude}&sName=${encodeURIComponent(first.name)}`;
                      intermediates.forEach((way, idx) => {
                        webUrl += `&wY${idx + 1}=${way.latitude}&wX${idx + 1}=${way.longitude}&wName${idx + 1}=${encodeURIComponent(way.name)}`;
                      });
                      webUrl += `&eY=${last.latitude}&eX=${last.longitude}&eName=${encodeURIComponent(last.name)}`;

                      if (isMobile) {
                        const appUrl = `kakaomap://route?sp=${first.latitude},${first.longitude}&ep=${last.latitude},${last.longitude}&by=car`;
                        const start = Date.now();
                        window.location.href = appUrl;
                        setTimeout(() => {
                          if (Date.now() - start < 2000) {
                            window.open(webUrl, '_blank');
                          }
                        }, 1500);
                      } else {
                        window.open(webUrl, '_blank');
                      }
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                      background: 'rgba(250, 204, 21, 0.15)',
                      border: '1.5px solid rgba(250, 204, 21, 0.4)',
                      borderRadius: '8px',
                      color: '#facc15',
                      fontSize: '12px',
                      fontWeight: '800',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    💛 카카오맵 길찾기 내보내기
                  </a>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const first = routeRestaurants[0];
                      const last = routeRestaurants[routeRestaurants.length - 1];
                      const intermediates = routeRestaurants.slice(1, routeRestaurants.length - 1);
                      const stops = routeRestaurants.map(r => `${r.latitude},${r.longitude},${encodeURIComponent(r.name)}`);
                      const webUrl = `https://map.naver.com/v5/directions/${stops.join('/')}/-/car`;

                      if (isMobile) {
                        let appUrl = `nmap://route/car?slat=${first.latitude}&slng=${first.longitude}&sname=${encodeURIComponent(first.name)}`;
                        intermediates.forEach((way, idx) => {
                          appUrl += `&v${idx + 1}lat=${way.latitude}&v${idx + 1}lng=${way.longitude}&v${idx + 1}name=${encodeURIComponent(way.name)}`;
                        });
                        appUrl += `&dlat=${last.latitude}&dlng=${last.longitude}&dname=${encodeURIComponent(last.name)}&appname=com.daedong.matjido`;

                        const mWebUrl = `https://m.map.naver.com/route.nhn?menu=route&sname=${encodeURIComponent(first.name)}&sx=${first.longitude}&sy=${first.latitude}&ename=${encodeURIComponent(last.name)}&ex=${last.longitude}&ey=${last.latitude}&pathType=0`;

                        const start = Date.now();
                        window.location.href = appUrl;
                        setTimeout(() => {
                          if (Date.now() - start < 2000) {
                            window.open(mWebUrl, '_blank');
                          }
                        }, 1500);
                      } else {
                        window.open(webUrl, '_blank');
                      }
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1.5px solid rgba(34, 197, 94, 0.4)',
                      borderRadius: '8px',
                      color: '#22c55e',
                      fontSize: '12px',
                      fontWeight: '800',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    💚 네이버지도 길찾기 내보내기
                  </a>
                </div>
              )}

              {/* 하단 공유 & 초기화 버튼 */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setRouteRestaurants([])}
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1.5px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  코스 초기화
                </button>
                <button
                  disabled={routeRestaurants.length < 2}
                  onClick={() => {
                    const ids = routeRestaurants.map(r => r.id).join(',');
                    const shareUrl = `${getShareOrigin()}${window.location.pathname}?route=${ids}`;
                    safeCopyToClipboard(shareUrl).then(() => {
                      setRouteCopied(true);
                      setTimeout(() => setRouteCopied(false), 2000);
                      
                      // Increment share count as a viral loop action
                      try {
                        const currentShares = parseInt(localStorage.getItem('daedong_share_count') || '0', 10);
                        localStorage.setItem('daedong_share_count', String(currentShares + 1));
                        window.dispatchEvent(new Event('daedong_unlock_progress'));
                      } catch {
                        // ignore
                      }
                    });
                  }}
                  style={{
                    padding: '12px 24px',
                    background: routeRestaurants.length < 2 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-cyan) 100%)',
                    border: 'none',
                    color: routeRestaurants.length < 2 ? 'rgba(255,255,255,0.2)' : '#ffffff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: routeRestaurants.length < 2 ? 'not-allowed' : 'pointer',
                    flex: 2,
                    boxShadow: routeRestaurants.length < 2 ? 'none' : '0 0 15px rgba(236, 72, 153, 0.3)'
                  }}
                >
                  {routeCopied ? '✓ 코스 링크 복사 완료!' : '🔗 코스 생성 및 단톡방 공유'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 7: 미식 퀴즈 대결 */}
          {activeTab === 'quiz' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '2px' }}>🧠 미식 인증 고사 대결 (Gourmet Quiz Duel)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  전국 노포에 대한 내공을 증명하고 퀴즈를 완료해 보세요! 완료 시 단톡방 공유 카운트가 +1회 누적됩니다.
                </p>
              </div>

              {!quizFinished ? (
                // 퀴즈 진행 중
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                    <span>문항 {quizIdx + 1} / {QUIZ_QUESTIONS.length}</span>
                    <span>점수 획득 대기 중</span>
                  </div>

                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.5', margin: '8px 0' }}>
                    {QUIZ_QUESTIONS[quizIdx].question}
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {QUIZ_QUESTIONS[quizIdx].options.map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        onClick={() => {
                          const newAnswers = [...quizAnswers, oIdx];
                          setQuizAnswers(newAnswers);
                          if (quizIdx < QUIZ_QUESTIONS.length - 1) {
                            setQuizIdx(quizIdx + 1);
                          } else {
                            setQuizFinished(true);
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1.5px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          color: '#cbd5e1',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = '#cbd5e1';
                        }}
                      >
                        {oIdx + 1}. {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                // 퀴즈 결과 화면
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '20px',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  <span style={{ fontSize: '32px' }}>🏅</span>
                  <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#f8fafc' }}>
                    미식 인증 고사 종료!
                  </h4>
                  
                  {/* 정답률 계산 */}
                  {(() => {
                    let correctCount = 0;
                    quizAnswers.forEach((ans, index) => {
                      if (ans === QUIZ_QUESTIONS[index].correct) {
                        correctCount++;
                      }
                    });

                    const gradeText = correctCount === 3 
                      ? '👑 진정한 노포 대종손! 미식의 신입니다.' 
                      : correctCount >= 1 
                        ? '🥢 미식 탐험가! 조금만 더 먹어보세요.' 
                        : '👶 초보 미식 베이비! 분발하세요.';

                    return (
                      <>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-yellow)', margin: '4px 0' }}>
                          {QUIZ_QUESTIONS.length}문항 중 {correctCount}개 정답!
                        </div>
                        <p style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: '700' }}>
                          {gradeText}
                        </p>

                        <div style={{
                          width: '100%',
                          textAlign: 'left',
                          fontSize: '11px',
                          color: '#94a3b8',
                          background: 'rgba(0,0,0,0.2)',
                          padding: '12px',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          marginTop: '8px',
                          maxHeight: '160px',
                          overflowY: 'auto'
                        }}>
                          <div style={{ fontWeight: '800', color: 'var(--accent-cyan)' }}>📖 오답 노트 및 해설</div>
                          {QUIZ_QUESTIONS.map((q, idx) => {
                            const isCorrect = quizAnswers[idx] === q.correct;
                            return (
                              <div key={idx} style={{ borderBottom: idx < 2 ? '1px dashed rgba(255,255,255,0.05)' : 'none', paddingBottom: '6px' }}>
                                <div style={{ color: isCorrect ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                                  문항 {idx + 1}: {isCorrect ? '정답' : '오답'} (내 선택: {q.options[quizAnswers[idx]]})
                                </div>
                                <div style={{ marginTop: '2px', color: '#cbd5e1' }}>{q.desc}</div>
                              </div>
                            );
                          })}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '12px' }}>
                          <button
                            onClick={() => {
                              setQuizIdx(0);
                              setQuizAnswers([]);
                              setQuizFinished(false);
                              setQuizSubmitted(false);
                            }}
                            style={{
                              flex: 1,
                              padding: '10px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1.5px solid rgba(255,255,255,0.1)',
                              color: '#cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '700',
                              fontSize: '12px'
                            }}
                          >
                            퀴즈 다시 풀기
                          </button>

                          <button
                            disabled={quizSubmitted}
                            onClick={() => {
                              try {
                                const currentShares = parseInt(localStorage.getItem('daedong_share_count') || '0', 10);
                                localStorage.setItem('daedong_share_count', String(currentShares + 1));
                                window.dispatchEvent(new Event('daedong_unlock_progress'));
                                setQuizSubmitted(true);
                                alert('공유 카운트가 1회 성공적으로 지급되었습니다!');
                              } catch {
                                // ignore
                              }
                            }}
                            style={{
                              flex: 2,
                              padding: '10px',
                              background: quizSubmitted ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--accent-pink) 0%, var(--accent-cyan) 100%)',
                              border: 'none',
                              color: quizSubmitted ? 'rgba(255,255,255,0.2)' : '#ffffff',
                              borderRadius: '6px',
                              cursor: quizSubmitted ? 'not-allowed' : 'pointer',
                              fontWeight: '800',
                              fontSize: '12px'
                            }}
                          >
                            {quizSubmitted ? '✓ 카운트 획득 완료' : '🎁 공유 카운트 1회 적립'}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {downloadModalImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 17, 0.95)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-glass)',
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            position: 'relative'
          }}>
            <button
              onClick={() => setDownloadModalImage(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex'
              }}
            >
              <X size={16} />
            </button>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc', marginBottom: '8px' }}>{downloadModalTitle}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>💡 이미지를 길게 누르면 기기에 저장할 수 있습니다.</p>
            </div>
            <img 
              src={downloadModalImage} 
              alt="인증서" 
              style={{ 
                width: '100%', 
                maxHeight: '400px', 
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
