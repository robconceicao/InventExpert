import {
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WebLayout } from '@/src/components/WebLayout';
import RootNavigator, { type RootStackParamList } from '@/src/navigation/RootNavigator';
import { registerDefaultSyncHandlers } from '@/src/services/syncHandlers';
import { syncQueue } from '@/src/services/sync';

export default function App() {
  // Removed web linking since it aggressively rewrites history and duplicates basePath on Github Pages.
  const linking: LinkingOptions<RootStackParamList> | undefined = undefined;

  useEffect(() => {
    registerDefaultSyncHandlers();
    // Tenta flush da fila local ao abrir (online + sessão válida)
    void syncQueue().then((r) => {
      if (r.processed > 0) {
        console.log(`[SYNC] Boot flush: ${r.message}`);
      }
    });
  }, []);

  return (
    <WebLayout>
      <SafeAreaProvider style={{ flex: 1 }}>
        <NavigationContainer linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </WebLayout>
  );
}