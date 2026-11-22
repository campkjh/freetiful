import { redirect } from 'next/navigation';

/* 송년회 입장 현황 — 261122 사장 '입장 현황 부분은 필요없는 것 같아'로 탭을 뺐다.
 * 누가 왔는지(응모권 = 도착) · 응모권 발급 모드 · 응모권 지우기 · 지운 이름 풀기는 참여자 판(/admin/reception)이 한다.
 * 태블릿 즐겨찾기 · 예전 주소로 들어와도 참여자 판으로 보낸다. (서버 GET :eventKey/live 는 럭키드로우 화면이 아직 쓴다) */
export default function ReceptionLiveRedirect() {
  redirect('/admin/reception');
}
