import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * 채팅에 올라온 영상을 뒤에서 다시 인코딩해 용량을 줄인다.
 *
 * 왜 필요한가 — 사진은 webp 로 변환되는데 영상은 원본이 그대로 저장돼 왔다.
 * 실측(2026-08): uploaded_files 1.8GB 중 영상 51개가 1.4GB(mp4 867MB + quicktime 518MB).
 * 아이폰 원본은 4K·고비트레이트라 한 건이 수십 MB 다. 이게 그대로 Railway 아웃바운드가 된다.
 *
 * 왜 백그라운드인가 — 50MB 영상 인코딩은 수십 초가 걸려 업로드 응답에 넣을 수 없다.
 * 그래서 원본을 먼저 저장해 URL 을 즉시 돌려주고, 그 뒤에 같은 레코드의 바이트만 교체한다.
 * URL 이 그대로라 이미 전송된 메시지도 자동으로 가벼워진다.
 */
@Injectable()
export class VideoCompressService {
  private readonly logger = new Logger(VideoCompressService.name);

  /** 이 크기 아래는 건드리지 않는다 — 인코딩 비용이 이득보다 크다 */
  private static readonly MIN_BYTES = 6 * 1024 * 1024;
  /** 인코딩이 너무 오래 걸리면 포기 (컨테이너 CPU 보호) */
  private static readonly TIMEOUT_MS = 4 * 60 * 1000;
  /** 동시 인코딩 제한 — 한 번에 여러 개가 돌면 컨테이너가 죽는다 */
  private static readonly MAX_CONCURRENT = 1;

  private running = 0;
  private readonly queue: string[] = [];

  constructor(private prisma: PrismaService) {}

  /** ffmpeg 실행 파일 경로. 없으면 null → 압축을 조용히 건너뛴다. */
  private ffmpegPath(): string | null {
    try {
      // ffmpeg-static 은 플랫폼별 바이너리를 동봉한다(Docker 에 apt 설치 불필요)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const p = require('ffmpeg-static');
      return typeof p === 'string' && p ? p : null;
    } catch {
      return null;
    }
  }

  /** 업로드 직후 호출. 큐에 넣고 즉시 반환한다(응답을 붙잡지 않는다). */
  enqueue(uploadedFileId: string, mimeType: string, size: number) {
    if (!mimeType?.startsWith('video/')) return;
    if (size < VideoCompressService.MIN_BYTES) return;
    if (!this.ffmpegPath()) return;
    this.queue.push(uploadedFileId);
    setImmediate(() => this.drain());
  }

  private drain() {
    if (this.running >= VideoCompressService.MAX_CONCURRENT) return;
    const id = this.queue.shift();
    if (!id) return;
    this.running++;
    this.compress(id)
      .catch((e) => this.logger.warn(`[영상압축] 실패 id=${id} ${String(e?.message).slice(0, 160)}`))
      .finally(() => {
        this.running--;
        setImmediate(() => this.drain());
      });
  }

  private async compress(id: string) {
    const ff = this.ffmpegPath();
    if (!ff) return;

    const row = await this.prisma.uploadedFile.findUnique({
      where: { id },
      select: { data: true, mimeType: true, fileName: true },
    });
    if (!row?.data) return;

    const src = Buffer.from(row.data);
    const dir = await fs.mkdtemp(join(tmpdir(), 'vc-'));
    const inPath = join(dir, `in-${randomUUID()}.mp4`);
    const outPath = join(dir, `out-${randomUUID()}.mp4`);

    try {
      await fs.writeFile(inPath, src);
      await this.runFfmpeg(ff, [
        '-y', '-i', inPath,
        // 세로 영상도 있으니 가로/세로 중 긴 쪽을 720 으로 맞춘다(홀수 방지 -2)
        '-vf', "scale='if(gt(iw,ih),1280,-2)':'if(gt(iw,ih),-2,1280)'",
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28',
        '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart',
        outPath,
      ]);

      const out = await fs.readFile(outPath);
      // 되레 커졌으면 원본을 지킨다(이미 압축된 영상일 수 있다)
      if (out.length >= src.length) {
        this.logger.log(`[영상압축] 건너뜀(이득 없음) id=${id} ${(src.length / 1048576).toFixed(1)}MB`);
        return;
      }
      await this.prisma.uploadedFile.update({
        where: { id },
        data: { data: out, mimeType: 'video/mp4' },
      });
      const saved = ((1 - out.length / src.length) * 100).toFixed(0);
      this.logger.log(
        `[영상압축] id=${id} ${(src.length / 1048576).toFixed(1)}MB → ${(out.length / 1048576).toFixed(1)}MB (${saved}% 감소)`,
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private runFfmpeg(bin: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr?.on('data', (d) => { err = String(d).slice(-400); });
      const timer = setTimeout(() => {
        p.kill('SIGKILL');
        reject(new Error('timeout'));
      }, VideoCompressService.TIMEOUT_MS);
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code} ${err}`));
      });
    });
  }
}
