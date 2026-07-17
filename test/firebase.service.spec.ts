import * as fs from 'fs';

// NOTE: jest.mock() factories are hoisted ABOVE all const/let declarations in
// this file. Referencing a plain outer variable from inside the factory would
// throw "Cannot access '...' before initialization". Jest special-cases
// identifiers prefixed with `mock` so they may be referenced from a hoisted
// factory — hence the naming below.
const mockInitializeApp = jest.fn<unknown, [unknown?]>();
const mockGetApps = jest.fn<unknown[], []>();
const mockGetApp = jest.fn<unknown, []>();
const mockDeleteApp = jest.fn<unknown, [unknown?]>();
const mockCert = jest.fn<unknown, [unknown?]>((x) => ({ __cert: x }));
const mockApplicationDefault = jest.fn<unknown, []>(() => ({ __adc: true }));
const mockGetMessaging = jest.fn<unknown, [unknown?]>(() => ({ __messaging: true }));

jest.mock('firebase-admin/app', () => ({
  initializeApp: (options?: unknown) => mockInitializeApp(options),
  getApps: () => mockGetApps(),
  getApp: () => mockGetApp(),
  deleteApp: (app?: unknown) => mockDeleteApp(app),
  cert: (serviceAccount?: unknown) => mockCert(serviceAccount),
  applicationDefault: () => mockApplicationDefault(),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: (app?: unknown) => mockGetMessaging(app),
}));

// Imported after the mocks so the module under test picks them up.
import { FirebaseService } from '../src/push/firebase.service';

const ENV_KEYS = [
  'FIREBASE_SERVICE_ACCOUNT_PATH',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FCM_PROJECT_ID',
  'FCM_CLIENT_EMAIL',
  'FCM_PRIVATE_KEY',
];
const saved: Record<string, string | undefined> = {};

describe('FirebaseService', () => {
  beforeAll(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
  });
  afterAll(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of ENV_KEYS) delete process.env[k];
    mockGetApps.mockReturnValue([]);
  });

  it('reports not_configured when no credential source is present', () => {
    const svc = new FirebaseService();
    svc.onModuleInit();
    expect(svc.initStatus).toBe('not_configured');
    expect(svc.isReady).toBe(false);
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('prefers FIREBASE_SERVICE_ACCOUNT_PATH and initializes via cert(json)', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/opt/guardtime/secrets/firebase-service-account.json';
    jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue(JSON.stringify({ project_id: 'p', client_email: 'e', private_key: 'k' }));
    mockInitializeApp.mockReturnValue({ name: '[DEFAULT]' });

    const svc = new FirebaseService();
    svc.onModuleInit();

    expect(mockCert).toHaveBeenCalledWith({ project_id: 'p', client_email: 'e', private_key: 'k' });
    expect(mockInitializeApp).toHaveBeenCalledWith({ credential: { __cert: expect.anything() } });
    expect(svc.initStatus).toBe('ready');
    expect(svc.isReady).toBe(true);
    expect(svc.initError).toBeNull();
  });

  it('reports error (not a crash) when the service-account file is missing/invalid', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/does/not/exist.json';
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const svc = new FirebaseService();
    expect(() => svc.onModuleInit()).not.toThrow();
    expect(svc.initStatus).toBe('error');
    expect(svc.isReady).toBe(false);
    expect(svc.initError).toMatch(/ENOENT/);
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('falls back to GOOGLE_APPLICATION_CREDENTIALS via applicationDefault()', () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/some/adc.json';
    mockInitializeApp.mockReturnValue({ name: '[DEFAULT]' });

    const svc = new FirebaseService();
    svc.onModuleInit();

    expect(mockApplicationDefault).toHaveBeenCalled();
    expect(svc.initStatus).toBe('ready');
  });

  it('falls back to discrete FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY (back-compat)', () => {
    process.env.FCM_PROJECT_ID = 'proj';
    process.env.FCM_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
    process.env.FCM_PRIVATE_KEY = '-----BEGIN KEY-----\\nabc\\n-----END KEY-----\\n';
    mockInitializeApp.mockReturnValue({ name: '[DEFAULT]' });

    const svc = new FirebaseService();
    svc.onModuleInit();

    expect(mockCert).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj', clientEmail: 'svc@proj.iam.gserviceaccount.com' }),
    );
    expect(svc.initStatus).toBe('ready');
  });

  it('does not re-initialize if a default app already exists (singleton)', () => {
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/opt/guardtime/secrets/firebase-service-account.json';

    const svc = new FirebaseService();
    svc.onModuleInit();

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(svc.initStatus).toBe('ready');
  });

  it('getMessaging() throws a clear error when not initialized', () => {
    const svc = new FirebaseService();
    svc.onModuleInit(); // not_configured, no env set
    expect(() => svc.getMessaging()).toThrow(/not initialized/i);
  });
});
