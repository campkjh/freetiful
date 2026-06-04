'use client';

/**
 * 웨딩MC 설문/리드 — 구글 시트
 * 비공개(restricted) 시트는 외부 사이트 임베드 시 로그인/권한 화면이 보일 수 있습니다.
 * 표로 임베드해서 보려면 시트를 "링크가 있는 모든 사용자 → 뷰어" 또는 "웹에 게시"로 설정.
 */
const SHEET_ID = '1bolGX_Eo0GvaWL-LkOTFoYv9ALjr-8xS4zgrFnLD13o';
const SHEET_OPEN_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const SHEET_EMBED_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/preview`;

export default function WeddingMcLeadsPage() {
  return (
    <div className="flex min-h-[calc(100vh-180px)] flex-col">
      <div className="flex items-start justify-between gap-3 px-1 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">웨딩MC 설문/리드</h1>
          <p className="mt-1 text-sm text-gray-500">
            wedding-mc 랜딩 폼 + 설문(혜택 선택) 제출 데이터 — 구글 시트
          </p>
        </div>
        <a
          href={SHEET_OPEN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-[#1A73E8] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#1765cc]"
        >
          구글 시트 열기 ↗
        </a>
      </div>

      <iframe
        src={SHEET_EMBED_URL}
        title="웨딩MC 설문/리드 시트"
        className="w-full flex-1 rounded-xl border border-gray-200 bg-white"
        style={{ minHeight: '72vh' }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-gray-400">
        ※ 아래 표에 <b>로그인/권한 화면</b>이 보이면 시트가 <b>비공개</b>라 그렇습니다. 본인 구글 계정으로 바로 보려면
        위 <b>구글 시트 열기</b> 버튼을 쓰세요. 어드민에 <b>표로 임베드</b>해서 보려면 시트 공유를{' '}
        <b>“링크가 있는 모든 사용자 → 뷰어”</b>로 바꾸면 됩니다. (이름·연락처가 링크로 열람 가능해지니 주의)
      </p>
    </div>
  );
}
