// c:\code\daedong-matjido\api\crawl-image.js
export default async function handler(req, res) {
  // CORS 설정 (로컬 개발 환경에서도 호출 가능하도록 처리)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 예비 요청(Preflight) 처리
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { query } = req.query;
  if (!query) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;

  try {
    const fetchResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!fetchResponse.ok) {
      res.status(500).json({ error: 'Failed to fetch Naver search results' });
      return;
    }

    let html = await fetchResponse.text();
    // HTML 및 JSON 이스케이프 문자 디코딩하여 깨끗한 URL 획득
    html = html
      .replace(/&amp;/g, '&')
      .replace(/\\u0026/g, '&')
      .replace(/\\u002f/g, '/')
      .replace(/\\u002F/g, '/')
      .replace(/\\u003d/g, '=')
      .replace(/\\u003D/g, '=')
      .replace(/&quot;/g, '"');

    // 쉼표, 따옴표, 중괄호 등으로 흘러넘치지 않도록 제한된 URL 정규식 사용
    const regex = /https:\/\/search\.pstatic\.net\/common\/[a-zA-Z0-9_\-\.\/\?=&%\+#:]+/g;
    const matches = html.match(regex) || [];

    // 제외할 이미지 패턴 필터링 및 점수 매칭 (크롤러 스크립트와 동일한 정밀 로직 적용)
    const ratedImages = matches
      .filter(img => {
        const lower = img.toLowerCase();
        // 프로필 및 소형 아이콘 제외
        if (lower.includes('profileimage') || lower.includes('blogpfthumb') || lower.includes('type=f48_48')) {
          return false;
        }
        return lower.includes('jpeg') || lower.includes('jpg') || lower.includes('png') || lower.includes('type=');
      })
      .map(img => {
        let score = 0;
        const lower = img.toLowerCase();
        if (lower.includes('ldb-phinf')) {
          score = 10; // 플레이스 공식 등록 이미지
        } else if (lower.includes('blogfiles')) {
          score = 5;  // 블로그 후기 리뷰 이미지
        } else if (lower.includes('clip-service')) {
          score = 2;  // 동영상 클립 프리뷰
        }
        return { img, score };
      });

    // 점수가 높은 순으로 정렬
    ratedImages.sort((a, b) => b.score - a.score);

    if (ratedImages.length > 0) {
      res.status(200).json({ image: ratedImages[0].img });
    } else {
      res.status(200).json({ image: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
