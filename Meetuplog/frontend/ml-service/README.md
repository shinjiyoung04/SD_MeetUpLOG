# MeetupLog 영화 추천 ML 서비스

팀원이 만든 자연어 채팅 분석·그룹 영화 추천 모델을 현재 MeetupLog 채팅 서버에 연결한 실행 폴더입니다.

## 실행

Windows PowerShell 기준:

```powershell
cd ml-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
Copy-Item .env.example .env
python -m uvicorn meetup_ml.api:app --host 127.0.0.1 --port 8000
```

ML 서버 확인:

```text
http://127.0.0.1:8000/health
```

Spring Boot는 기본적으로 `http://127.0.0.1:8000`을 호출합니다. 주소가 다르면 Spring 실행 환경에 `ML_SERVICE_BASE_URL`을 설정하세요.

## OTT 작품 링크

- TMDB의 한국 제공 정보를 기준으로 OTT 아이콘과 서비스명을 표시합니다.
- `.env`의 `WATCHMODE_API_KEY`를 설정하면 추천된 3편에 한해 작품별 직접 주소를 보강합니다.
- 직접 주소가 없을 때는 검증된 서비스 검색 화면으로 이동합니다. Disney+처럼 제목을 URL에 전달할 수 없는 서비스는 제목을 복사한 뒤 공식 검색 화면을 엽니다.

## 모델 실행 방식

- `POST /v1/chat/analyze`: 최대 200개의 채팅을 오탈자·표현 정규화 후 사용자별 취향으로 변환
- `POST /v1/recommendations/group`: 개인 선호, 직접 언급 영화, 배우·감독, OTT, 재정렬 정책을 반영해 정확히 3편 생성
- `POST /v1/recommendations/from-chat`: Spring 연동용 단일 호출 API. 채팅 분석과 그룹 추천을 같은 카탈로그 스냅샷으로 연속 실행
- 기본 설치는 외부 다운로드 없이 실행 가능한 word/character TF-IDF fallback을 사용합니다.
- Sentence Transformers를 사용하려면 `python -m pip install -e ".[embedding]"` 후 로컬 Hugging Face 모델 캐시를 준비하고 `.env`에서 `MEETUP_USE_EMBEDDING=true`로 변경합니다.
- 동봉된 `movies.json`, 임베딩 메타데이터와 행렬은 팀원 모델의 동결 카탈로그입니다.

영화 카탈로그는 파일 수정 시각이 바뀔 때만 다시 파싱하며, 동일 메시지 교정과 TMDB 제목 검색은 상한이 있는 메모리 캐시를 사용합니다. 따라서 반복 분석으로 메모리가 계속 증가하지 않습니다.

TMDB/KOBIS 키는 기존 카탈로그로 추천만 수행할 때는 필요하지 않습니다. 신규 영화 수집이나 실시간 TMDB 검색을 켤 때만 로컬 `.env`에 입력하세요.
