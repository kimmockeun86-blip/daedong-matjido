# 리서치 로그 (13_RESEARCH_LOG)

이 파일은 외부 API 사용 및 라이브러리 도입 검토 시 진행된 연구 및 조사를 기록하는 문서입니다.

---

## 🔍 진행된 리서치 내역

### [RES-001] Geolocation API 및 Geocoding API 정책 검토 (2026. 6. 23)
- **목적**: 무자본 구동 제약에 맞는 주소 변환 API 탐색.
- **결과**: Nominatim(OpenStreetMap) Geocoding 서비스가 무료이며 API 키 없이 가용함. 단, 초당 1회 호출(1 request per second)의 Throttling 정책을 준수해야 차단되지 않음.
- **대응**: ExcelImporter 및 Geocoder 로직에 Nominatim API 사용 시 강제로 1초 sleep을 유도하여 정책 준수 완료.
