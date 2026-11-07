// After the render: the measured bitrate, frame rate and duration of each file. Fails below its floor.
// Usage: node scripts/finish.ts out/rally-1080p.mp4:10 out/rally-4k.mp4:25 (floors in Mbps).
import { execFileSync } from 'node:child_process';

let failed = false;
for (const arg of process.argv.slice(2)) {
  const [file, floor] = arg.split(':'), min = Number(floor) * 1e6;
  const out = execFileSync('node_modules/.bin/remotion', ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,bit_rate:format=duration,bit_rate', '-of', 'json', file], { encoding: 'utf8' });
  const data = JSON.parse(out.slice(out.indexOf('{'))), video = data.streams[0];
  const [n, d] = video.r_frame_rate.split('/').map(Number), rate = Number(video.bit_rate ?? data.format.bit_rate);
  console.log(`${file}: ${video.width}×${video.height}, ${(n / d).toFixed(2)} fps, ${Number(data.format.duration).toFixed(2)} s, video ${(rate / 1e6).toFixed(1)} Mbps, overall ${(Number(data.format.bit_rate) / 1e6).toFixed(1)} Mbps`);
  if (rate < min) { console.error(`${file} is below ${floor} Mbps.`); failed = true; }
}
if (failed) process.exit(1);
