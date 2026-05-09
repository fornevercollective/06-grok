import {
  liveVideoDedupeKey,
  parseGrokipediaVideoLine,
  splitGrokipediaVideoPaste,
  tweetEmbedSrc,
  xTweetIdFromEmbedSrc,
  youtubeVideoIdFromEmbedSrc,
} from './grokipediaVideoEmbed';

describe('grokipediaVideoEmbed', () => {
  it('parses YouTube watch URLs to embed', () => {
    const r = parseGrokipediaVideoLine('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(r?.kind).toBe('iframe');
    expect(r?.src).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('extracts video id from embed src', () => {
    expect(youtubeVideoIdFromEmbedSrc('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoIdFromEmbedSrc('https://player.vimeo.com/video/123')).toBeNull();
  });

  it('splits brace-wrapped multi-URL pastes', () => {
    const raw =
      '{https://www.youtube.com/watch?v=aa https://www.youtube.com/watch?v=bb https://www.youtube.com/watch?v=aa}';
    expect(splitGrokipediaVideoPaste(raw)).toEqual([
      'https://www.youtube.com/watch?v=aa',
      'https://www.youtube.com/watch?v=bb',
      'https://www.youtube.com/watch?v=aa',
    ]);
  });

  it('splits double-brace wrapped pastes {{ … }}', () => {
    const raw =
      '{{https://www.youtube.com/watch?v=aa https://www.youtube.com/watch?v=bb https://www.youtube.com/watch?v=aa}}';
    expect(splitGrokipediaVideoPaste(raw)).toEqual([
      'https://www.youtube.com/watch?v=aa',
      'https://www.youtube.com/watch?v=bb',
      'https://www.youtube.com/watch?v=aa',
    ]);
  });

  it('splits a long double-brace YouTube list (duplicates preserved for caller dedupe)', () => {
    const raw =
      '{{https://www.youtube.com/watch?v=q6JCfp1Nve4 https://www.youtube.com/watch?v=78ncTmvcM74 https://www.youtube.com/watch?v=h4qG50NhzIM https://www.youtube.com/watch?v=FYj2AKYdwz8 https://www.youtube.com/watch?v=rnXIjl_Rzy4 https://www.youtube.com/watch?v=03pYP2Nmreo https://www.youtube.com/watch?v=Cm1v4bteXbI https://www.youtube.com/watch?v=Cm1v4bteXbI https://www.youtube.com/watch?v=77akujLn4k8 https://www.youtube.com/watch?v=77akujLn4k8 https://www.youtube.com/watch?v=Fu8vYoIkaeM https://www.youtube.com/watch?v=v9JBMnxuPX8 https://www.youtube.com/watch?v=iEpJwprxDdk}}';
    const parts = splitGrokipediaVideoPaste(raw);
    expect(parts).toHaveLength(13);
    expect(parts[0]).toContain('q6JCfp1Nve4');
    expect(parts[parts.length - 1]).toContain('iEpJwprxDdk');
  });

  it('dedupes YouTube by video id', () => {
    expect(
      liveVideoDedupeKey('https://www.youtube.com/embed/Cm1v4bteXbI?rel=0')
    ).toBe('yt:Cm1v4bteXbI');
    expect(liveVideoDedupeKey('https://player.vimeo.com/video/1')).toBe('https://player.vimeo.com/video/1');
  });

  it('parses X/Twitter status URLs to Tweet embed iframe', () => {
    const r = parseGrokipediaVideoLine(
      'https://x.com/elonmusk/status/2044977273905021370?s=12&t=Vo9hmV2d0jhaDXa1HKUo1w'
    );
    expect(r?.kind).toBe('iframe');
    expect(r?.src).toContain('platform.twitter.com/embed/Tweet.html');
    expect(r?.src).toContain('id=2044977273905021370');
  });

  it('extracts status id from Tweet embed src and dedupes X posts', () => {
    const src =
      'https://platform.twitter.com/embed/Tweet.html?id=2044977273905021370&theme=light';
    expect(xTweetIdFromEmbedSrc(src)).toBe('2044977273905021370');
    expect(liveVideoDedupeKey(src)).toBe('x:2044977273905021370');
  });

  it('tweetEmbedSrc supports dark theme', () => {
    expect(tweetEmbedSrc('123', 'dark')).toContain('theme=dark');
    expect(tweetEmbedSrc('123', 'light')).toContain('theme=light');
  });
});
