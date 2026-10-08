import GazeGame from '../wedding-mc/GazeGame';

// 로컬 플레이 전용 페이지 (게임 단독 실행). 배포 대상 아님.
export default function PlayPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #EEF2FF 0%, #FFF 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 16,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#FF5D8F', letterSpacing: '-0.02em' }}>PRETTYFUL MINI GAME</p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#191F28', marginTop: 4, letterSpacing: '-0.03em' }}>큐피드 눈빛 💘</h1>
      </div>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <GazeGame />
      </div>
      <p style={{ fontSize: 12, color: '#8B95A1', textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
        커서/터치로 눈빛을 조준하고 <b>꾹 눌러</b> 발사! 하객을 매혹해 점수를 올리고, 회색 심술 하객은 피하세요.
      </p>
    </div>
  );
}
