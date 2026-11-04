# 서버 리더보드 (Google Apps Script + Google Sheets)

게임 종료 시 입력한 이름과 점수를 Google 스프레드시트에 저장하는 서버리스 백엔드입니다.
GitHub Pages, 로컬 실행, 자체 서버 어디서 게임을 띄워도 같은 URL 하나로 동작합니다.
URL 을 설정하지 않으면 기록은 브라우저(`localStorage`)에만 저장됩니다.

## 배포 방법

1. [Google Sheets](https://sheets.google.com) 에서 새 스프레드시트를 만듭니다.
2. **확장 프로그램 > Apps Script** 를 열고 `Code.gs` 내용을 이 폴더의 `Code.gs` 로 교체합니다.
3. **배포 > 새 배포 > 유형: 웹 앱**
   - 실행 사용자: **나**
   - 액세스 권한: **모든 사용자**
4. 처음 한 번 권한 승인 후 발급되는 웹 앱 URL(`https://script.google.com/macros/s/.../exec`)을 복사합니다.
5. URL 을 게임에 설정합니다.
   - 로컬/자체 서버: 저장소의 `config.js` 의 `leaderboardApiUrl` 에 붙여넣기
   - GitHub Pages: 저장소 **Settings > Secrets and variables > Actions > Variables** 에 `LEADERBOARD_API_URL` 변수로 등록하면 배포 시 `config.js` 에 주입됩니다. (이미 설치된 PWA 가 이전 `config.js` 를 캐시하고 있을 수 있으니, URL 만 바꿨다면 `sw.js` 의 `CACHE` 버전을 올려 배포하세요.)

`Code.gs` 를 수정한 뒤에는 **배포 > 배포 관리 > 수정(새 버전)** 으로 같은 URL 에 다시 배포해야 반영됩니다.
기록은 스프레드시트의 `records` 시트에 자동으로 생성됩니다 (잘못된 기록은 행을 직접 지우면 됩니다).

## API

| 요청 | 설명 |
| --- | --- |
| `GET {URL}?action=list` | 상위 20개 기록 |
| `POST {URL}` (본문 JSON, `Content-Type: text/plain`) `{"action":"submit","name","score","moves","remaining","status"}` | 기록 추가 후 상위 20개 반환 |

응답: `{"ok": true, "entries": [{name, score, moves, remaining, status, date, timestamp}]}`, 실패 시 `{"ok": false, "error": "..."}`.
정렬: 점수 높은 순 -> 이동 적은 순 -> 최신 순.

## 검증과 한계

- 서버는 이름(최대 12자, 제어문자 제거), 점수·이동·남은 칸 범위, `status` 와 남은 칸의 일관성(클리어=0, 게임오버=81)만 확인합니다.
- 게임 로직이 클라이언트에 있으므로 점수를 위조한 요청까지 막지는 못합니다 (친구끼리 쓰는 수준). URL 을 아는 사람은 누구나 기록을 보내거나 읽을 수 있습니다.
- Apps Script 는 응답에 수 초가 걸릴 수 있어 게임은 10초 타임아웃 후 이 기기의 기록으로 대체합니다.
