# 출시 로그 (09_RELEASE_LOG)

이 파일은 프로덕션 레벨 배포 및 APK 빌드 산출물의 릴리즈 이력을 기록하는 문서입니다.

---

## 🚀 릴리즈 히스토리

### [v1.0.0-RC2] (2026-06-23)
- **내용**: 
  - 딥링크 진입 시 전국 Top 10 노포 잠금 보안 가드 보강 (뷰포트 강제 이동 방지).
  - GourmetToolkit.tsx 내 커플 매치 결과 Fallback 시 baseRestaurants를 적용하여 락 우회 결함 차단.
  - Dashboard.tsx 복원 및 전체 정복률(방문한 맛집 / 전체 맛집 %) 통계 탑재.
  - Sidebar.tsx 내 탭 전환(list/stats) 도입 및 대시보드 내장 통합.
  - 3000번 포트 static server.js 백그라운드 상시 구동.
  - build_apk.js 텔레그램 업로드 SSL 인증 체인 신뢰 오류 우회 및 자동 발송 배포 성공.
- **산출물**: 
  - Web: `dist/index.html` 및 번들 리소스 빌드 성공.
  - Android APK: `caremo-release.apk` 컴파일 및 서명, Telegram 메신저 발송 완료 (`Successfully sent APK to Telegram!`).

### [v1.0.0-RC1] (2026-06-23)
- **내용**: AI 팩토리 엔진 1차 연동 완료 및 Mock 컴파일 정상 확인 완료.
- **산출물**: 
  - Web: 빌드 통과 완료 (`dist/` 번들 대기)
  - Android APK: 미생성 (빌드 파이프라인 구축 대기)
