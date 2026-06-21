export interface Coordinates {
  latitude: number;
  longitude: number;
}

// 로컬 캐시 키
const CACHE_KEY = 'daedong_geocoding_cache';

// 캐시 로드
function getCache(): Record<string, Coordinates> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

// 캐시 저장
function setCache(address: string, coords: Coordinates) {
  try {
    const cache = getCache();
    cache[address] = coords;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('지오코딩 캐시 저장 실패:', err);
  }
}

/**
 * 단일 주소를 위도/경도로 변환합니다 (캐시 적용).
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (!address || address.trim() === '') return null;

  const cleanAddress = address.trim();
  const cache = getCache();

  // 1. 캐시 히트 체크
  if (cache[cleanAddress]) {
    const cached = cache[cleanAddress];
    if (cached.latitude === 0 && cached.longitude === 0) {
      return null;
    }
    return cached;
  }

  // 2. OpenStreetMap Nominatim API 호출
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DaedongMatjidoApp/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const coords: Coordinates = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
      
      // 결과 캐시 저장
      setCache(cleanAddress, coords);
      return coords;
    } else {
      // 결과 없음 캐시 저장
      setCache(cleanAddress, { latitude: 0, longitude: 0 });
    }
  } catch (err) {
    console.error(`지오코딩 실패 (${cleanAddress}):`, err);
  }

  return null;
}

/**
 * 여러 개의 주소를 순차적으로 변환합니다 (Nominatim API의 1초당 1회 제한 준수).
 */
export async function geocodeAddressesSequentially(
  addresses: string[],
  onProgress?: (index: number, total: number) => void
): Promise<Record<string, Coordinates>> {
  const results: Record<string, Coordinates> = {};
  const cache = getCache();
  const total = addresses.length;

  for (let i = 0; i < total; i++) {
    const address = addresses[i];
    if (!address) continue;

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // 캐시 확인
    if (cache[address]) {
      results[address] = cache[address];
      continue;
    }

    // 캐시에 없으면 API 호출 + 1초 대기 (OSM API 가이드라인 준수)
    const coords = await geocodeAddress(address);
    if (coords) {
      results[address] = coords;
    }

    // 마지막 요소가 아니면 1초 대기
    if (i < total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * 좌표가 없을 시 사용할 서울 시청 기준 무작위 오프셋 좌표를 반환합니다.
 */
export function getDefaultFallbackCoordinates(): Coordinates {
  // 서울 시청 좌표: 37.5665, 126.9780
  const lat = 37.5665 + (Math.random() - 0.5) * 0.01;
  const lon = 126.9780 + (Math.random() - 0.5) * 0.01;
  return { latitude: lat, longitude: lon };
}
