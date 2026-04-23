import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 프론트엔드 정적 데이터에서 이관 (apps/web/src/app/(main)/my/announcements/page.tsx)
const ANNOUNCEMENTS = [
  {
    title: '프리티풀 서비스 오픈 안내',
    content:
      '안녕하세요, 프리티풀입니다.\n\n웨딩 전문가 매칭 플랫폼 프리티풀이 정식 오픈했습니다!\n\n오픈 기념 이벤트로 첫 결제 시 10% 할인 쿠폰을 드립니다.\n마이페이지 > 쿠폰에서 확인해주세요.\n\n감사합니다.',
    tag: '필독',
    isPinned: true,
    isPublished: true,
    createdAt: new Date('2026-03-01T00:00:00Z'),
  },
  {
    title: 'v1.2.0 업데이트 안내',
    content:
      '다음과 같은 기능이 추가/개선되었습니다:\n\n1. 채팅 기능 개선 (예약 메시지, 이모지 리액션)\n2. 사진첩 기능 추가 (20일 자동 삭제)\n3. 전문가 프로필 UI 개선\n4. 버그 수정 및 성능 최적화',
    tag: '업데이트',
    isPinned: true,
    isPublished: true,
    createdAt: new Date('2026-03-15T00:00:00Z'),
  },
  {
    title: '에스크로 결제 시스템 도입',
    content:
      '고객님의 안전한 결제를 위해 에스크로 결제 시스템이 도입되었습니다.\n\n결제 금액은 행사 완료 확인 후 전문가에게 정산됩니다.\n자세한 내용은 FAQ를 참고해주세요.',
    tag: '안내',
    isPinned: false,
    isPublished: true,
    createdAt: new Date('2026-03-10T00:00:00Z'),
  },
  {
    title: '친구 초대 이벤트',
    content:
      '친구를 초대하면 초대한 분과 초대받은 분 모두 500P를 드립니다!\n\n마이페이지 > 친구 초대에서 내 추천 코드를 확인하세요.',
    tag: '이벤트',
    isPinned: false,
    isPublished: true,
    createdAt: new Date('2026-03-05T00:00:00Z'),
  },
  {
    title: '3월 25일 서버 점검 안내',
    content:
      '서비스 안정화를 위해 아래 시간에 서버 점검이 진행됩니다.\n\n일시: 2026년 3월 25일(수) 03:00 ~ 05:00\n영향: 전 서비스 이용 불가\n\n이용에 불편을 드려 죄송합니다.',
    tag: '점검',
    isPinned: false,
    isPublished: true,
    createdAt: new Date('2026-03-22T00:00:00Z'),
  },
];

// apps/web/src/app/(main)/my/faq/page.tsx 의 FAQ_DATA
const FAQS = [
  {
    category: '서비스 이용',
    items: [
      {
        q: '프리티풀은 어떤 서비스인가요?',
        a: '프리티풀은 웨딩 MC, 가수, 쇼호스트 등 결혼식 전문가를 쉽고 빠르게 매칭해주는 플랫폼입니다. AI 기반 매칭 시스템으로 고객님의 취향에 맞는 전문가를 추천해드립니다.',
      },
      {
        q: '전문가에게 어떻게 문의하나요?',
        a: '전문가 프로필 페이지에서 "문의하기" 버튼을 누르면 채팅방이 생성됩니다. 채팅을 통해 견적을 받고 상세 상담을 진행할 수 있습니다.',
      },
      {
        q: '매칭 요청은 어떻게 하나요?',
        a: '홈 화면 또는 하단 "견적요청" 탭에서 원하는 카테고리와 조건을 선택하면 AI가 적합한 전문가를 매칭해드립니다.',
      },
    ],
  },
  {
    category: '결제/환불',
    items: [
      {
        q: '결제는 어떻게 진행되나요?',
        a: '전문가가 보낸 견적서에서 "결제하기" 버튼을 누르면 결제 페이지로 이동합니다. 카카오페이, 신용카드, 계좌이체 등 다양한 결제 수단을 지원합니다.',
      },
      {
        q: '에스크로 결제란 무엇인가요?',
        a: '결제 금액을 프리티풀이 안전하게 보관한 뒤, 행사 완료 확인 후 전문가에게 정산하는 방식입니다. 고객님의 결제를 안전하게 보호합니다.',
      },
      {
        q: '환불은 어떻게 하나요?',
        a: '행사일 7일 전까지 전액 환불 가능합니다. 7일~3일 전까지는 50% 환불, 3일 이내 및 당일은 환불이 불가합니다. 마이페이지 > 결제내역에서 환불 신청이 가능합니다.',
      },
    ],
  },
  {
    category: '계정',
    items: [
      { q: '소셜 로그인은 어떤 것을 지원하나요?', a: '카카오, 구글, 네이버, 애플 로그인을 지원합니다.' },
      {
        q: '회원 탈퇴는 어떻게 하나요?',
        a: '마이페이지 > 설정 > 회원탈퇴에서 탈퇴할 수 있습니다. 탈퇴 후 30일간 데이터가 보관되며, 이후 영구 삭제됩니다.',
      },
    ],
  },
];

async function main() {
  // 공지 시드 — 기존에 동일 title 있으면 skip
  for (const a of ANNOUNCEMENTS) {
    const existing = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (existing) {
      console.log(`[skip] 공지 이미 존재: ${a.title}`);
      continue;
    }
    await prisma.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        tag: a.tag,
        isPinned: a.isPinned,
        isPublished: a.isPublished,
        publishedAt: a.createdAt,
        createdAt: a.createdAt,
      },
    });
    console.log(`[add] 공지 생성: ${a.title}`);
  }

  // FAQ 시드
  let faqIndex = 0;
  for (const section of FAQS) {
    let order = 0;
    for (const item of section.items) {
      const existing = await prisma.faq.findFirst({
        where: { category: section.category, question: item.q },
      });
      if (existing) {
        console.log(`[skip] FAQ 이미 존재: ${item.q}`);
        continue;
      }
      await prisma.faq.create({
        data: {
          category: section.category,
          question: item.q,
          answer: item.a,
          displayOrder: order,
          isPublished: true,
          isActive: true,
        },
      });
      console.log(`[add] FAQ 생성: ${item.q}`);
      order++;
      faqIndex++;
    }
  }

  console.log('\n시드 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
