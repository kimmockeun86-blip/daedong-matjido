# 시스템 설계도 (Architecture)

이 파일은 시스템의 전반적인 구조와 아키텍처 발전을 기록하는 문서입니다.
`Agent 3 (Architect)`에 의해 지속적으로 버전업 및 관리됩니다.

---
## 1. 아키텍처 버전: v1.0.0
- **최종 업데이트**: 2026-06-23
- **설명**: 초기 백지 상태에서의 아키텍처 세팅. 대동맛지도 앱은 Vite + React + TypeScript + Leaflet으로 동작하며, 모바일 패키징을 위해 Capacitor를 장착함.
- **주요 모듈**:
  - `src/App.tsx`: 메인 어플리케이션 엔트리 및 상태 관리.
  - `src/components/GourmetMap.tsx`: Leaflet 기반 지도 렌더링.
  - `src/components/Sidebar.tsx`: 맛집 목록 및 세부 정보, 탐색 도구.
  - `src/components/DetailPanel.tsx`: 맛집 정보 및 미식 일기장 패널.
  - `src/components/GourmetToolkit.tsx`: 코스 플래너, 월드컵, 네온 사인 룰렛 등 유틸리티.
  - `src/components/ExcelImporter.tsx`: 맛집 엑셀 데이터 파일 파서 및 Nominatim API 지오코더 연동.
