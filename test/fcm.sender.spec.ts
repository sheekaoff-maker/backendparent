import { FcmSender } from '../src/push/fcm.sender';

function fakeFirebase(messaging: { send?: jest.Mock; sendEachForMulticast?: jest.Mock }, ready = true) {
  return {
    isReady: ready,
    getMessaging: () => messaging,
  } as any;
}

function fcmError(code: string) {
  const e: any = new Error(code);
  e.code = code;
  return e;
}

describe('FcmSender.send (single token)', () => {
  it('reports skipped when Firebase is not configured', async () => {
    const sender = new FcmSender(fakeFirebase({}, false));
    const result = await sender.send('tok', { title: 't', body: 'b' });
    expect(result).toBe('skipped');
  });

  it('reports sent on success', async () => {
    const send = jest.fn().mockResolvedValue('projects/p/messages/1');
    const sender = new FcmSender(fakeFirebase({ send }));
    const result = await sender.send('tok', { title: 't', body: 'b' });
    expect(result).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports invalid (no retry) for a dead token', async () => {
    const send = jest.fn().mockRejectedValue(fcmError('messaging/registration-token-not-registered'));
    const sender = new FcmSender(fakeFirebase({ send }));
    const result = await sender.send('tok', { title: 't', body: 'b' });
    expect(result).toBe('invalid');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries a transient error and succeeds on the second attempt', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(fcmError('messaging/internal-error'))
      .mockResolvedValueOnce('projects/p/messages/2');
    const sender = new FcmSender(fakeFirebase({ send }));
    const result = await sender.send('tok', { title: 't', body: 'b' });
    expect(result).toBe('sent');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('gives up after exhausting retries on a persistent transient error', async () => {
    const send = jest.fn().mockRejectedValue(fcmError('messaging/server-unavailable'));
    const sender = new FcmSender(fakeFirebase({ send }));
    const result = await sender.send('tok', { title: 't', body: 'b' });
    expect(result).toBe('error');
    expect(send).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('reports error (no retry) for a non-transient, non-invalid failure', async () => {
    const send = jest.fn().mockRejectedValue(fcmError('messaging/third-party-auth-error'));
    const sender = new FcmSender(fakeFirebase({ send }));
    const result = await sender.send('tok', { title: 't', body: 'b' });
    expect(result).toBe('error');
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('FcmSender.sendMulticast', () => {
  it('returns empty + skipped=false immediately for an empty token list', async () => {
    const sender = new FcmSender(fakeFirebase({}));
    const result = await sender.sendMulticast([], { title: 't', body: 'b' });
    expect(result).toEqual({ sent: [], invalid: [], errored: [], skipped: false });
  });

  it('reports skipped=true for all tokens when Firebase is not configured (offline device path)', async () => {
    const sender = new FcmSender(fakeFirebase({}, false));
    const result = await sender.sendMulticast(['a', 'b'], { title: 't', body: 'b' });
    expect(result.skipped).toBe(true);
    expect(result.sent).toEqual([]);
  });

  it('classifies a mix of sent, invalid, and errored tokens in one batch', async () => {
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      responses: [
        { success: true },
        { success: false, error: fcmError('messaging/registration-token-not-registered') },
        { success: false, error: fcmError('messaging/third-party-auth-error') },
      ],
      successCount: 1,
      failureCount: 2,
    });
    const sender = new FcmSender(fakeFirebase({ sendEachForMulticast }));
    const result = await sender.sendMulticast(['good', 'dead', 'broken'], { title: 't', body: 'b' });
    expect(result.sent).toEqual(['good']);
    expect(result.invalid).toEqual(['dead']);
    expect(result.errored).toEqual(['broken']);
  });

  it('retries only the transiently-failed tokens, not the whole batch', async () => {
    const sendEachForMulticast = jest
      .fn()
      .mockResolvedValueOnce({
        responses: [
          { success: true },
          { success: false, error: fcmError('messaging/internal-error') },
        ],
        successCount: 1,
        failureCount: 1,
      })
      .mockResolvedValueOnce({
        responses: [{ success: true }],
        successCount: 1,
        failureCount: 0,
      });
    const sender = new FcmSender(fakeFirebase({ sendEachForMulticast }));
    const result = await sender.sendMulticast(['good', 'flaky'], { title: 't', body: 'b' });

    expect(result.sent.sort()).toEqual(['flaky', 'good']);
    expect(result.invalid).toEqual([]);
    expect(result.errored).toEqual([]);
    // Second call only retried the flaky token, not the whole original batch.
    expect(sendEachForMulticast.mock.calls[1][0].tokens).toEqual(['flaky']);
  });

  it('recovers from a whole-batch exception on retry', async () => {
    const sendEachForMulticast = jest
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ responses: [{ success: true }], successCount: 1, failureCount: 0 });
    const sender = new FcmSender(fakeFirebase({ sendEachForMulticast }));
    const result = await sender.sendMulticast(['tok'], { title: 't', body: 'b' });
    expect(result.sent).toEqual(['tok']);
  });

  it('marks every token errored exactly once if the batch keeps failing (no double-count)', async () => {
    const sendEachForMulticast = jest.fn().mockRejectedValue(new Error('down'));
    const sender = new FcmSender(fakeFirebase({ sendEachForMulticast }));
    const result = await sender.sendMulticast(['a', 'b'], { title: 't', body: 'b' });
    expect(result.errored.sort()).toEqual(['a', 'b']);
    expect(result.sent).toEqual([]);
    expect(result.invalid).toEqual([]);
  });
});
