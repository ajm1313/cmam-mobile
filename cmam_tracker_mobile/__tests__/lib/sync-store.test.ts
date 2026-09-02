import api from '../../lib/api';
import { useSyncStore } from '../../lib/sync-store';

jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

const mockedPost = api.post as jest.Mock;

describe('mobile synchronization outbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.setState({ queue: [], isSyncing: false, lastSyncAt: null });
  });

  function enqueue(ownerId = '7', label = 'Registration') {
    return useSyncStore.getState().enqueue({
      url: '/v1/cases/create/',
      method: 'POST',
      data: { child_name: label },
      label,
      ownerId,
    });
  }

  it('keeps rejected records visible with the server error', async () => {
    mockedPost.mockRejectedValue({ response: { status: 400, data: { message: 'Weight is required.' } } });
    enqueue();

    const result = await useSyncStore.getState().sync('7');

    expect(result).toEqual({ synced: 0, failed: 1 });
    expect(useSyncStore.getState().queue[0]).toMatchObject({
      state: 'failed',
      lastError: 'Weight is required.',
    });
  });

  it('does not overwrite a record enqueued while synchronization is running', async () => {
    let release!: (value: any) => void;
    mockedPost.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    enqueue('7', 'First');

    const synchronization = useSyncStore.getState().sync('7');
    await Promise.resolve();
    enqueue('7', 'Added during sync');
    release({ data: { success: true } });
    await synchronization;

    expect(useSyncStore.getState().queue).toHaveLength(1);
    expect(useSyncStore.getState().queue[0].label).toBe('Added during sync');
  });

  it('synchronizes only the active user queue', async () => {
    mockedPost.mockResolvedValue({ data: { success: true } });
    enqueue('7', 'Mine');
    enqueue('8', 'Another user');

    await useSyncStore.getState().sync('7');

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().queue).toHaveLength(1);
    expect(useSyncStore.getState().queue[0].ownerId).toBe('8');
  });
});
