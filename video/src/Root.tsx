import { useEffect, useState } from 'react';
import { Composition, continueRender, delayRender, staticFile } from 'remotion';
import { Video } from './Video.tsx';
import { FPS, totalSeconds } from './timeline.ts';

export function Root() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    const fonts = [
      new FontFace('Schibsted Grotesk', `url(${staticFile('fonts/SchibstedGrotesk.ttf')})`, { weight: '400 900' }),
      new FontFace('IBM Plex Mono', `url(${staticFile('fonts/IBMPlexMono-Regular.ttf')})`),
    ];
    Promise.all(fonts.map(font => font.load())).then(loaded => {
      loaded.forEach(font => document.fonts.add(font));
      continueRender(handle);
    });
  }, [handle]);
  return <Composition id="Rally" component={Video} durationInFrames={totalSeconds() * FPS} fps={FPS} width={1920} height={1080} />;
}
