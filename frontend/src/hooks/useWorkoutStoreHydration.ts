import { useEffect, useState } from 'react';
import { useWorkoutStore } from '../store/workout';

const canUseLocalStorage = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storage = window.localStorage;
    const testKey = '__workout_store_hydration__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

export function useWorkoutStoreHydration() {
  const [supportsPersistence] = useState(canUseLocalStorage);
  const [isHydrated, setIsHydrated] = useState(() => {
    if (!supportsPersistence) {
      return true;
    }

    return useWorkoutStore.persist.hasHydrated();
  });

  useEffect(() => {
    if (!supportsPersistence) {
      return;
    }

    const persist = useWorkoutStore.persist;
    const syncHydrationState = () => {
      setIsHydrated(persist.hasHydrated());
    };

    const unsubscribeHydrate = persist.onHydrate(() => {
      setIsHydrated(false);
    });
    const unsubscribeFinishHydration = persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    window.setTimeout(syncHydrationState, 0);

    if (!persist.hasHydrated()) {
      Promise.resolve(persist.rehydrate()).catch(() => {
        setIsHydrated(true);
      });
    }

    return () => {
      unsubscribeHydrate();
      unsubscribeFinishHydration();
    };
  }, [supportsPersistence]);

  return {
    isHydrated,
    supportsPersistence,
  };
}
