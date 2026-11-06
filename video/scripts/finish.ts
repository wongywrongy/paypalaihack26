// After the render: the measured bitrate, frame rate and duration of out/rally-1080p.mp4. Fails below 10 Mbps.
import { execFileSync } from 'node:child_process';

const FILE = 'out/rally-1080p.mp4', MIN = 10e6;
const out = execFileSync('node_modules/.bin/remotion', ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,bit_rate:format=duration,bit_rate', '-of', 'json', FILE], { encoding: 'utf8' });
const data = JSON.parse(out.slice(out.indexOf('{'))), video = data.streams[0];
const [n, d] = video.r_frame_rate.split('/').map(Number), rate = Number(video.bit_rate ?? data.format.bit_rate);
console.log(`${FILE}: ${video.width}×${video.height}, ${(n / d).toFixed(2)} fps, ${Number(data.format.duration).toFixed(2)} s, video ${(rate / 1e6).toFixed(1)} Mbps, overall ${(Number(data.format.bit_rate) / 1e6).toFixed(1)} Mbps`);
if (rate < MIN) { console.error(`Below ${MIN / 1e6} Mbps.`); process.exit(1); }
