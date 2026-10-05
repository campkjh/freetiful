import { Module } from '@nestjs/common';
import { QuickMatchRosterService } from './quick-match-roster.service';

/** 퀵매칭 지정 사회자 명단 — MatchModule(후보·번호 공개)과 AdminModule(스위치)이 같은 인스턴스(같은 기억)를 쓰게 따로 뺐다 */
@Module({
  providers: [QuickMatchRosterService],
  exports: [QuickMatchRosterService],
})
export class QuickMatchRosterModule {}
