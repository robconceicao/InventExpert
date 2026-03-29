import {
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WebLayout } from '@/src/components/WebLayout';
import RootTabs, { type RootTabParamList } from '@/src/navigation/RootTabs';

export default function App() {
  const linking: LinkingOptions<RootTabParamList> | undefined =
    Platform.OS === 'web'
      ? {
          prefixes: ['https://robconceicao.github.io/InventExpert/', '/InventExpert/'],
          config: {
            screens: {
              ReportA: '',
              ReportB: 'ReportB',
              Attendance: 'Attendance',
              InventExp: 'InventExp',
              Scanner: 'Scanner',
            },
          },
        }
      : undefined;

  return (
    <SafeAreaProvider>
      <WebLayout>
        <NavigationContainer linking={linking}>
          <RootTabs />
        </NavigationContainer>
      </WebLayout>
    </SafeAreaProvider>
  );
}