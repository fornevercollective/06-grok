import { hostBlocksIframeEmbedding, urlBlocksIframeEmbedding } from './notebookIframePolicy';

describe('notebookIframePolicy', () => {
  it('blocks grokipedia hosts', () => {
    expect(hostBlocksIframeEmbedding('grokipedia.com')).toBe(true);
    expect(hostBlocksIframeEmbedding('www.grokipedia.com')).toBe(true);
    expect(urlBlocksIframeEmbedding('https://grokipedia.com/search?q=test')).toBe(true);
  });

  it('allows typical embeddable docs', () => {
    expect(urlBlocksIframeEmbedding('https://example.com/')).toBe(false);
  });
});
