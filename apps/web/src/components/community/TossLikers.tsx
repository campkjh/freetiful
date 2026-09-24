"use client";

// 좋아요 누른 사람 프로필을 겹쳐 보여준다(스타디 LikerStack 과 같은 문법, 토스 톤).
// 새로 들어온 프사는 톡 튀며 맨 앞에 붙는다(키=userId 라 기존 프사는 다시 튀지 않음).
export interface TossLiker {
  userId?: string;
  nickname: string;
  avatar: string | null;
}

export default function TossLikers({ likers, count }: { likers: TossLiker[]; count: number }) {
  const show = likers.slice(0, 4);
  if (count <= 0 || show.length === 0) return null;
  return (
    <div className="tlikers" aria-label={`${count}명이 좋아요를 눌렀어요`}>
      <span className="tlikers-stack" aria-hidden="true">
        {show.map((u, i) => (
          <span key={u.userId || `${u.nickname}-${i}`} className="tlikers-av" style={{ zIndex: show.length - i }}>
            {u.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatar} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span>{u.nickname.slice(0, 1)}</span>
            )}
          </span>
        ))}
      </span>
      <span className="tlikers-text">
        <b>{count.toLocaleString("ko-KR")}명</b>이 좋아요를 눌렀어요
      </span>
    </div>
  );
}
