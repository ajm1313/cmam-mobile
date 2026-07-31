import { useAuthStore } from './store';

export function useIsSuperAdmin(): boolean {
  const { user } = useAuthStore();
  return user?.is_superuser === true;
}
