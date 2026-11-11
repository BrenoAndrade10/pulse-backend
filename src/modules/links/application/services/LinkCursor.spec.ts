import { decodeLinkCursor, encodeLinkCursor } from './LinkCursor';

const value = {
  createdAt: new Date('2026-11-10T12:00:00.000Z'),
  id: '018f0f9f-6d25-7d9d-8cb8-3f2b1e9c4a6d',
};

describe('LinkCursor', () => {
  it('encodes and decodes a cursor', () => {
    expect(decodeLinkCursor(encodeLinkCursor(value))).toEqual(value);
  });

  it.each(['not-base64', Buffer.from('{"c":"bad"}').toString('base64url')])(
    'rejects malformed cursor %s',
    (cursor) => {
      expect(() => decodeLinkCursor(cursor)).toThrow('VALIDATION_FAILED');
    },
  );

  it('rejects an altered cursor', () => {
    const cursor = encodeLinkCursor(value);
    expect(() => decodeLinkCursor(`${cursor.slice(0, -1)}x`)).toThrow(
      'VALIDATION_FAILED',
    );
  });
});
