import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * 채팅 음성 메시지 — 녹음 파일 판정 · m4a(AAC) 통일 (261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)').
 *
 * 왜 바꾸나 — 기기마다 녹음 형식이 다르다.
 *   · 갤럭시(Chromium WebView) = audio/webm;codecs=opus (길이·Cues 없는 파일)
 *   · 아이폰(WKWebView)        = audio/mp4 (AAC)
 *   갤럭시가 보낸 webm/opus 는 iOS 버전에 따라 아이폰에서 재생이 안 될 수 있다.
 *   서버에서 한 번 AAC m4a(+faststart)로 바꿔 두면 아이폰·갤럭시·PC 어디서나 재생되고 길이도 제대로 잡힌다.
 *
 * 실패해도 전송은 막지 않는다 — ffmpeg 가 없거나(배포 이미지에 ffmpeg-static 바이너리 없음) 변환이 실패하면
 * null 을 돌려주고, 호출부가 원본을 그대로 저장한다(예전처럼 기기에 따라 재생만 안 될 수 있음).
 * 1분 녹음 변환은 1초 안쪽 — 업로드 응답 안에서 동기로 돌리되 시간 제한·동시 개수 제한을 건다.
 */

/** 음성 한 건 상한 — 5분 녹음(웹 자동 정지)이 넉넉히 들어가는 크기. 이보다 크면 녹음이 아니라 파일로 본다 */
export const VOICE_MAX_BYTES = 20 * 1024 * 1024;

/** 변환 시간 제한 — 넘기면 원본 저장으로 넘어간다(컨테이너 CPU 보호) */
const TRANSCODE_TIMEOUT_MS = 30 * 1000;
/** 동시 변환 개수 — 영상 압축 큐(1개)와 별개. 넘치면 차례를 기다린다 */
const MAX_CONCURRENT = 2;

const VOICE_NAME_RE = /^voice\.(webm|m4a|mp4|ogg|oga|aac|wav)$/i;

/** 멀티파트 파일이 채팅 녹음인지 — audio/* 이거나, 브라우저가 video/webm·octet-stream 으로 붙인 voice.* 파일 */
export function looksLikeVoiceUpload(file: { mimetype?: string; originalname?: string } | null | undefined): boolean {
  if (!file) return false;
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  const name = String(file.originalname || '');
  return (mime === '' || mime === 'video/webm' || mime === 'video/mp4' || mime === 'application/octet-stream') && VOICE_NAME_RE.test(name);
}

/** 원본을 그대로 저장할 때 붙일 mime — <audio> 가 알아듣게 audio/* 로 맞춘다 */
export function normalizeVoiceMime(mime: string | undefined, name?: string): string {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (m.startsWith('audio/')) return m;
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  if (m === 'video/webm' || ext === 'webm') return 'audio/webm';
  if (m === 'video/mp4' || ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
  if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'wav') return 'audio/wav';
  return 'audio/webm';
}

/** mime/파일명 → ffmpeg 입력 확장자(형식 추정 힌트) */
function inputExt(mime: string | undefined, name?: string): string {
  const m = normalizeVoiceMime(mime, name);
  if (m === 'audio/mp4' || m === 'audio/x-m4a') return 'm4a';
  if (m === 'audio/ogg') return 'ogg';
  if (m === 'audio/aac') return 'aac';
  if (m === 'audio/wav' || m === 'audio/x-wav') return 'wav';
  return 'webm';
}

function ffmpegPath(): string | null {
  try {
    // 영상 압축(VideoCompressService)과 같은 ffmpeg-static 바이너리
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const p = require('ffmpeg-static');
    return typeof p === 'string' && p ? p : null;
  } catch {
    return null;
  }
}

let running = 0;
const waiters: Array<() => void> = [];
async function acquire() {
  if (running < MAX_CONCURRENT) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  running++;
}
function release() {
  running--;
  const next = waiters.shift();
  if (next) next();
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr?.on('data', (d) => { err = String(d).slice(-300); });
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error('timeout'));
    }, TRANSCODE_TIMEOUT_MS);
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code} ${err}`));
    });
  });
}

/**
 * 녹음 바이트 → AAC m4a(모노 64k, faststart). 실패·ffmpeg 없음이면 null(호출부가 원본 저장).
 */
export async function transcodeVoiceToM4a(src: Buffer, mime?: string, name?: string): Promise<Buffer | null> {
  const ff = ffmpegPath();
  if (!ff || !src?.length) return null;
  await acquire();
  let dir = '';
  try {
    dir = await fs.mkdtemp(join(tmpdir(), 'voice-'));
    const inPath = join(dir, `in-${randomUUID()}.${inputExt(mime, name)}`);
    const outPath = join(dir, `out-${randomUUID()}.m4a`);
    await fs.writeFile(inPath, src);
    await runFfmpeg(ff, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', inPath,
      '-vn', '-map_metadata', '-1',
      '-ac', '1', '-c:a', 'aac', '-b:a', '64k',
      '-movflags', '+faststart',
      '-f', 'mp4', outPath,
    ]);
    const out = await fs.readFile(outPath);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  } finally {
    release();
    if (dir) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
