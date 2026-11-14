# week-06 · 바깥 정보를 받아 오는 내 앱

## 주제
- 바깥 정보를 받아 오는 내 앱

## 이번 주 목표
- API 로 오늘 정보를 받아 와 보여 주고, 폰에 설치되는 앱으로 만들기

## 만들 것
- 내 앱: week-06/index.html (오늘 급식 앱. 나이스 API 를 키 없이 씀. 함수는 week-06/meal.js 에 모음)
- 폰에 설치 (PWA): manifest.webmanifest, sw.js (서비스 워커), icons/ (Python 으로 그린 밥그릇 아이콘 3개)
- 확인 도구: week-06/check/index.html (meal.js 불러오기, 메뉴 나누기, 나이스 API, 못 받아 올 때 까닭, 끊겼을 때 마지막 정보, 아이콘·manifest·서비스 워커를 확인)
- GitHub Pages: https://younkijung.github.io/QUEST-TRACK-2/week-06/

## 알아 둘 것
- 서비스 워커와 설치는 https 주소(GitHub Pages)에서만 된다. index.html 을 두 번 눌러 열면 앱은 돌아가지만 설치는 안 된다.
- sw.js 의 앱 파일 목록을 바꾸면 VERSION 숫자도 올린다.

## 이번 주에 정한 것
- 학교 이름과 학교 코드는 파일에 적지 않는다. 앱을 처음 열 때 학교를 찾아 고르고, 그 브라우저에만 저장한다 (공개 저장소라서).

## 이번 주 규칙
- API 키나 비밀번호는 파일에 적지 않는다.
- 정보를 못 받아 오면 빈 화면 대신 까닭을 보여 준다.
- 답은 한국어로 한다.
