import {
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WebLayout } from '@/src/components/WebLayout';
import RootTabs, { type RootTabParamList } from '@/src/navigation/RootTabs';

export default function App() {
  // Removed web linking since it aggressively rewrites history and duplicates basePath on Github Pages.
  const linking: LinkingOptions<RootTabParamList> | undefined = undefined;

  return (
    <WebLayout>
      <SafeAreaProvider style={{ flex: 1 }}>
        <NavigationContainer linking={linking}>
          <RootTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </WebLayout>
  );
}