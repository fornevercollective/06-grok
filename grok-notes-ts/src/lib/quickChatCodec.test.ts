import {
  hexToTextUtf8,
  morseToText,
  rot13,
  textToHexUtf8,
  textToMorse,
  utf8ToBase64,
} from './quickChatCodec';

describe('quickChatCodec', () => {
  it('hex round-trips utf-8', () => {
    const s = 'hi · 你好';
    expect(hexToTextUtf8(textToHexUtf8(s))).toBe(s);
  });

  it('morse encode/decode ascii', () => {
    const m = textToMorse('SOS');
    expect(m).toContain('...');
    expect(morseToText(m)).toBe('SOS');
  });

  it('rot13', () => {
    expect(rot13('abc')).toBe('nop');
  });

  it('base64 utf8', () => {
    expect(utf8ToBase64('π')).toMatch(/=/);
  });
});
