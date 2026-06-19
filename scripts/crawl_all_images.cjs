const fs = require('fs');
const path = require('path');

const RESTAURANTS_FILE = path.join(__dirname, '../public/restaurants.json');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 OPR/107.0.0.0'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function crawlImageForRestaurant(r) {
  const query = r.portalSearchName || `${r.city || r.region || ''} ${r.name}`;
  const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
  
  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      if (res.status === 403) {
        console.warn(`[403 Forbidden] IP temporarily blocked or rate-limited for "${query}". Pausing worker for 15 seconds... (Retries left: ${retries - 1})`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        retries--;
        continue;
      }
      
      if (!res.ok) {
        console.log(`Failed for ${query}: HTTP ${res.status}`);
        return { success: false, status: res.status };
      }
      
      let html = await res.text();
      html = html
        .replace(/&amp;/g, '&')
        .replace(/\\u0026/g, '&')
        .replace(/\\u002f/g, '/')
        .replace(/\\u002F/g, '/')
        .replace(/\\u003d/g, '=')
        .replace(/\\u003D/g, '=')
        .replace(/&quot;/g, '"');
        
      const regex = /https:\/\/search\.pstatic\.net\/common\/[a-zA-Z0-9_\-\.\/\?=&%\+#:]+/g;
      const matches = html.match(regex) || [];
      
      const ratedImages = matches
        .filter(img => {
          const lower = img.toLowerCase();
          if (lower.includes('profileimage') || lower.includes('blogpfthumb') || lower.includes('type=f48_48')) {
            return false;
          }
          return lower.includes('jpeg') || lower.includes('jpg') || lower.includes('png') || lower.includes('type=');
        })
        .map(img => {
          let score = 0;
          const lower = img.toLowerCase();
          if (lower.includes('ldb-phinf')) {
            score = 10;
          } else if (lower.includes('blogfiles')) {
            score = 5;
          } else if (lower.includes('clip-service')) {
            score = 2;
          }
          return { img, score };
        });
        
      ratedImages.sort((a, b) => b.score - a.score);
      
      if (ratedImages.length > 0) {
        return { success: true, img: ratedImages[0].img };
      } else {
        return { success: true, img: 'no_image' };
      }
    } catch (err) {
      console.error(`Error fetching ${query}:`, err.message);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  return { success: false, error: 'Max retries reached or network error' };
}

async function run() {
  console.log('Loading restaurants.json...');
  const rawData = fs.readFileSync(RESTAURANTS_FILE, 'utf8');
  const restaurants = JSON.parse(rawData);
  console.log(`Total restaurants: ${restaurants.length}`);
  
  let successCount = 0;
  let noImageCount = 0;
  let failCount = 0;
  let activeIndex = 0;
  const CONCURRENCY = 2; // Keep it low to prevent rate limits
  
  const worker = async () => {
    while (true) {
      const i = activeIndex++;
      if (i >= restaurants.length) break;
      
      const r = restaurants[i];
      
      // Skip if it already has a valid image URL starting with http
      if (r.image && r.image.startsWith('http')) {
        continue;
      }
      
      const result = await crawlImageForRestaurant(r);
      if (result.success) {
        if (result.img && result.img.startsWith('http')) {
          r.image = result.img;
          successCount++;
          console.log(`[OK] ${i+1}/${restaurants.length} - ${r.name}: ${result.img}`);
        } else {
          r.image = 'no_image';
          noImageCount++;
          console.log(`[NO IMAGE] ${i+1}/${restaurants.length} - ${r.name}`);
        }
      } else {
        failCount++;
        console.log(`[SKIP] ${i+1}/${restaurants.length} - ${r.name} (failed, keeping undefined)`);
      }
      
      // Save progress incrementally every 10 updates
      if ((successCount + noImageCount + failCount) % 10 === 0) {
        fs.writeFileSync(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2), 'utf8');
      }
      
      // Sleep random time (500ms to 1500ms) to bypass bot protection
      const sleepTime = 500 + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, sleepTime));
    }
  };
  
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  
  fs.writeFileSync(RESTAURANTS_FILE, JSON.stringify(restaurants, null, 2), 'utf8');
  console.log(`Done! Success: ${successCount}, No Image: ${noImageCount}, Failed/Skipped: ${failCount}`);
}

run();
