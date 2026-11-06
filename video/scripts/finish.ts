// After the 4K render: the 1080p version, downscaled from the master with lanczos, then the measured bitrate, frame
// rate and duration of both. Fails below 25 Mbps at 4K or 10 Mbps at 1080p.
import { execFileSync } from 'node:child_process';

const REMOTION = 'node_modules/.bin/remotion';
const MIN = { 'out/rally-4k.mp4': 25e6, 'out/rally-1080p.mp4': 10e6 } as const;

execFileSync(REMOTION, ['ffmpeg', '-y', '-v', 'error', '-i', 'out/rally-4k.mp4', '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', 'out/rally-1080p.mp4'], { stdio: 'inherit' });

let failed = false;
for (const [file, floor] of Object.entries(MIN)) {
  const out = execFileSync(REMOTION, ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,bit_rate:format=duration,bit_rate', '-of', 'json', file], { encoding: 'utf8' });
  const data = JSON.parse(out.slice(out.indexOf('{'))), video = data.streams[0];
  const [n, d] = video.r_frame_rate.split('/').map(Number), rate = Number(video.bit_rate ?? data.format.bit_rate);
  console.log(`${file}: ${video.width}×${video.height}, ${(n / d).toFixed(2)} fps, ${Number(data.format.duration).toFixed(2)} s, video ${(rate / 1e6).toFixed(1)} Mbps, overall ${(Number(data.format.bit_rate) / 1e6).toFixed(1)} Mbps`);
  if (rate < floor) { console.error(`  below ${floor / 1e6} Mbps`); failed = true; }
}
if (failed) process.exit(1);
