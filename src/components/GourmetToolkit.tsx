import { useState, useRef } from 'react';
import { X, Gift, Share2, HelpCircle, RotateCcw, Camera, Heart, Trophy } from 'lucide-react';
import type { RestaurantRaw } from '../utils/excel';

interface GourmetToolkitProps {
  isOpen: boolean;
  onClose: () => void;
  restaurants: RestaurantRaw[];
  onSelectRestaurant: (restaurant: RestaurantRaw) => void;
  visitedRestaurants: string[]; // 방문한 식당 상호명 배열
  isMobile?: boolean;
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

export default function GourmetToolkit({
  isOpen,
  onClose,
  restaurants,
  onSelectRestaurant,
  visitedRestaurants = [],
  isMobile = false
}: GourmetToolkitProps) {
  const [activeTab, setActiveTab] = useState<'roulette' | 'mbti' | 'couple' | 'worldcup' | 'share' | 'instagram' | 'shop'>('roulette');

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

  const canvasRef = useRef<HTMLCanvasElement>(null);

  if (!isOpen) return null;

  // 1.1 룰렛 후보 식당 5곳 셔플
  const prepareRoulette = () => {
    if (restaurants.length === 0) return;
    const shuffled = [...restaurants].sort(() => 0.5 - Math.random());
    setRouletteList(shuffled.slice(0, 5));
    setRouletteWinner(null);
  };

  // 1.2 룰렛 회전 애니메이션
  const startSpin = () => {
    if (rouletteList.length === 0) {
      prepareRoulette();
    }
    setIsSpinning(true);
    setRouletteWinner(null);

    // 2.5초 동안 네온 회전 모사 후 당첨자 선택
    setTimeout(() => {
      const currentList = rouletteList.length > 0 ? rouletteList : restaurants.sort(() => 0.5 - Math.random()).slice(0, 5);
      if (rouletteList.length === 0) setRouletteList(currentList);
      
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
      let title = '';
      let desc = '';
      let tag = '';

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

    let pool = restaurants.filter(r => r.category === partner1Pref || r.category === partner2Pref);
    if (pool.length === 0) pool = restaurants;

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
    if (restaurants.length < 8) {
      alert('등록된 맛집 데이터가 부족합니다!');
      return;
    }
    const shuffled = [...restaurants].sort(() => 0.5 - Math.random());
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

    navigator.clipboard.writeText(text).then(() => {
      setShareTextCopied(true);
      setTimeout(() => setShareTextCopied(false), 2000);
    });
  };

  // 4.1 가상 샵 구매 처리
  const buyItem = (name: string, price: number) => {
    setReceiptItem({ name, price });
    setShowReceipt(true);
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

    ctx.font = 'black 42px "Noto Sans KR", sans-serif';
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

    ctx.font = 'black 34px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#eab308'; // Yellow
    ctx.fillText(`정복도: ${percentage}%`, 250, 410);

    // 7. 유저 등급 계산 및 네온 아웃라인
    let userGrade = '일반 맛집 탐색기';
    if (visitedCount >= 50) userGrade = '🔥 신의 혀 (노포 마스터)';
    else if (visitedCount >= 20) userGrade = '⭐ 로컬 맛집 학사';
    else if (visitedCount >= 5) userGrade = '🏃 새내기 숟가락';

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

    // 9. 파일 다운로드 트리거
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `대동맛지도_정복인증_${userGrade.split(' ')[0]}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(2, 6, 17, 0.8)',
      backdropFilter: 'blur(12px)',
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
        {/* 닫기 버튼 */}
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

        {/* 좌측 탭 네비게이션 */}
        <div style={{
          width: isMobile ? '100%' : '200px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRight: isMobile ? 'none' : '1px solid var(--border-glass)',
          borderBottom: isMobile ? '1px solid var(--border-glass)' : 'none',
          padding: '20px 16px',
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

          {[
            { id: 'roulette', label: '🎯 맛집 룰렛', icon: RotateCcw },
            { id: 'mbti', label: '🧠 미식 MBTI', icon: HelpCircle },
            { id: 'couple', label: '👩‍❤️‍👨 커플 궁합', icon: Heart },
            { id: 'worldcup', label: '🏆 맛집 월드컵', icon: Trophy },
            { id: 'share', label: '💬 단톡방 공유', icon: Share2 },
            { id: 'instagram', label: '📸 인증서 발급', icon: Camera },
            { id: 'shop', label: '🎁 기프트 샵', icon: Gift }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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

          {/* TAB 2: 미식 MBTI 테스트 */}
          {activeTab === 'mbti' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>🧠 나의 미식 성향 테스트 (MBTI)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>나도 모르던 내 진짜 입맛 취향을 명확히 알아봅니다.</p>
              </div>

              {!mbtiResult ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '24px',
                  borderRadius: '12px',
                  minHeight: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: '20px'
                }}>
                  {/* 진행도 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--accent-orange)', fontWeight: '700' }}>
                    <span>미식 성향 진단 진행율</span>
                    <span>{currentQuestionIndex + 1} / {MBTI_QUESTIONS.length}</span>
                  </div>

                  {/* 문항 질문 */}
                  <h4 style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', lineHeight: '1.4' }}>
                    {MBTI_QUESTIONS[currentQuestionIndex].question}
                  </h4>

                  {/* 옵션 버튼 리스트 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {MBTI_QUESTIONS[currentQuestionIndex].options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleMbtiAnswer(opt.score)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '14px 16px',
                          borderRadius: '8px',
                          border: '1.5px solid rgba(255,255,255,0.05)',
                          background: 'rgba(30, 41, 59, 0.4)',
                          color: '#cbd5e1',
                          fontSize: '13px',
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
                // 결과 카드 화면
                <div style={{
                  background: 'rgba(249, 115, 22, 0.03)',
                  border: '1.5px solid rgba(249, 115, 22, 0.25)',
                  padding: '24px',
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
                  <h4 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--accent-orange)' }}>
                    {mbtiResult.title}
                  </h4>
                  <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>
                    {mbtiResult.tag}
                  </span>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#e2e8f0', margin: '8px 0', wordBreak: 'keep-all' }}>
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

          {/* TAB 4: 인스타그램 정복도 카드 다운로드 */}
          {activeTab === 'instagram' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>📸 인스타그램 정복 카드 발급</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>나의 맛집 정복 등급을 고화질 네온 카드로 렌더링해 인스타 스토리에 공유하세요!</p>
              </div>

              {/* 캔버스 프리뷰 모사 */}
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
                  등급: {visitedRestaurants.length >= 20 ? '🏆 맛집 학사' : '🏃 새내기'}
                </div>
              </div>

              {/* 숨겨진 캔버스 */}
              <canvas 
                ref={canvasRef} 
                width={500} 
                height={800} 
                style={{ display: 'none' }} 
              />

              <button
                onClick={downloadInstagramCard}
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

        </div>
      </div>
    </div>
  );
}
