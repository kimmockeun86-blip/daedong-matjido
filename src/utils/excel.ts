import * as XLSX from 'xlsx';

export interface RestaurantRaw {
  id?: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  review: string;
  latitude?: number;
  longitude?: number;
  menu?: string;
  portalSearchName?: string;
  region?: string;
  city?: string;
  image?: string;
}

// 샘플 데이터 구조
const SAMPLE_DATA = [
  {
    '상호명': '토속촌 삼계탕',
    '카테고리': '한식',
    '주소': '서울특별시 종로구 자하문로5길 5',
    '평점': 4.5,
    '리뷰': '진하고 깊은 국물 맛이 일품이며, 인삼 향이 가득합니다.',
    '위도': 37.576579,
    '경도': 126.971752,
  },
  {
    '상호명': '명동교자 본점',
    '카테고리': '한식',
    '주소': '서울특별시 중구 명동10길 29',
    '평점': 4.7,
    '리뷰': '진한 닭육수의 칼국수와 마늘 향 가득한 겉절이 김치가 환상적입니다.',
    '위도': 37.562544,
    '경도': 126.985619,
  },
  {
    '상호명': '우래옥',
    '카테고리': '한식',
    '주소': '서울특별시 중구 창경궁로 62-29',
    '평점': 4.6,
    '리뷰': '서울에서 손꼽히는 평양냉면 명가. 육향이 매우 짙고 면발이 훌륭합니다.',
    '위도': '',
    '경도': '', // 주소로 자동 위경도 찾기(Geocoding) 테스트용 빈 값
  },
  {
    '상호명': '블루보틀 삼청 카페',
    '카테고리': '카페/디저트',
    '주소': '서울특별시 종로구 북촌로5길 76',
    '평점': 4.3,
    '리뷰': '한옥 뷰를 즐기며 맛있는 핸드드립 커피를 마실 수 있습니다.',
    '위도': 37.580004,
    '경도': 126.980643,
  }
];

/**
 * 대동여맛집지도 샘플 엑셀 파일을 생성하여 브라우저에서 즉시 다운로드합니다.
 */
export function downloadSampleExcel() {
  // 1. 워크북 및 워크시트 생성
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_DATA);

  // 2. 열 너비 지정 (보기 편하도록)
  ws['!cols'] = [
    { wch: 20 }, // 상호명
    { wch: 15 }, // 카테고리
    { wch: 35 }, // 주소
    { wch: 8 },  // 평점
    { wch: 50 }, // 리뷰
    { wch: 12 }, // 위도
    { wch: 12 }  // 경도
  ];

  // 3. 워크북에 시트 추가
  XLSX.utils.book_append_sheet(wb, ws, '맛집목록');

  const isCapacitor = (window as unknown as { Capacitor?: unknown }).Capacitor !== undefined;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isCapacitor || isMobile) {
    try {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], '대동여맛집지도_샘플.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: '대동여맛집지도 샘플 엑셀',
          text: '대동여맛집지도 업로드용 샘플 엑셀 파일입니다.'
        }).catch(err => {
          console.error('Share failed, fallback to download:', err);
          XLSX.writeFile(wb, '대동여맛집지도_샘플.xlsx');
        });
        return;
      }
    } catch (shareErr) {
      console.error('Failed to prepare share, fallback to download:', shareErr);
    }
  }

  // 4. 바이너리 스트링 작성 및 다운로드 트리거
  XLSX.writeFile(wb, '대동여맛집지도_샘플.xlsx');
}

interface ExcelRow {
  식당상호?: string;
  상호명?: string;
  name?: string;
  음식종류?: string;
  카테고리?: string;
  category?: string;
  주소?: string;
  address?: string;
  지역?: string;
  region?: string;
  도시명?: string;
  city?: string;
  평점?: string | number;
  rating?: string | number;
  추천사유?: string;
  리뷰?: string;
  review?: string;
  대표메뉴?: string;
  menu?: string;
  '포털 검색명'?: string;
  portalSearchName?: string;
  위도?: string | number;
  latitude?: string | number;
  경도?: string | number;
  longitude?: string | number;
  이미지?: string;
  image?: string;
  사진?: string;
}

/**
 * 업로드된 엑셀 파일을 읽어와 RestaurantRaw 배열 객체로 파싱합니다.
 */
export function parseExcelFile(file: File): Promise<RestaurantRaw[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error('파일 데이터를 읽을 수 없습니다.');
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // 엑셀 행을 JSON 객체 배열로 변환
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

        const restaurants: RestaurantRaw[] = jsonData.map((row, idx) => {
          // 컬럼 매핑 (일반 서식 및 전국 맛집 종합본 서식 상호 호환 지원)
          const name = row['식당상호'] || row['상호명'] || row['name'] || `맛집_${idx + 1}`;
          const category = row['음식종류'] || row['카테고리'] || row['category'] || '기타';
          
          let address = '';
          if (row['주소'] || row['address']) {
            address = String(row['주소'] || row['address']);
          } else if (row['지역'] && row['도시명']) {
            address = `${row['지역']} ${row['도시명']}`;
          }

          const addressStr = address.trim();
          const region = row['지역'] || row['region'] || (addressStr ? addressStr.split(' ')[0] : '');
          const city = row['도시명'] || row['city'] || (addressStr ? addressStr.split(' ')[1] : '');

          const rawRating = row['평점'] !== undefined && row['평점'] !== null ? row['평점'] : row['rating'];
          let rating = 4.5;
          if (rawRating !== undefined && rawRating !== null && String(rawRating).trim() !== '') {
            const parsed = parseFloat(String(rawRating));
            if (!isNaN(parsed)) {
              rating = parsed;
            }
          }

          const review = row['추천사유'] || row['리뷰'] || row['review'] || '';
          const menu = row['대표메뉴'] || row['menu'] || '';
          const portalSearchName = row['포털 검색명'] || row['portalSearchName'] || '';
          
          const rawLat = row['위도'] || row['latitude'];
          const rawLng = row['경도'] || row['longitude'];
          let latitude = rawLat ? parseFloat(String(rawLat)) : undefined;
          let longitude = rawLng ? parseFloat(String(rawLng)) : undefined;

          if (latitude !== undefined && isNaN(latitude)) latitude = undefined;
          if (longitude !== undefined && isNaN(longitude)) longitude = undefined;

          const nameTrimmed = String(name).trim();
          const id = `${nameTrimmed}_${addressStr || idx}`.replace(/\s+/g, '_');
          const imageVal = String(row['이미지'] || row['image'] || row['사진'] || '').trim();

          return {
            id,
            name: nameTrimmed,
            category: String(category).trim(),
            address: addressStr,
            rating,
            review: String(review).trim(),
            latitude,
            longitude,
            menu: String(menu).trim(),
            portalSearchName: String(portalSearchName).trim(),
            region: String(region).trim(),
            city: String(city).trim(),
            image: imageVal || undefined
          };
        });

        resolve(restaurants);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
