import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import React from 'react';
import { Platform } from 'react-native';

import RootTabs, { type RootTabParamList } from '@/src/navigation/RootTabs';

export default function App() {
  const linking: LinkingOptions<RootTabParamList> | undefined =
    Platform.OS === 'web'
      ? {
          prefixes: ['https://robconceicao.github.io/InventExpert', '/InventExpert'],
          config: {
            screens: {
              ReportA: '',
              ReportB: 'ReportB',
              Attendance: 'Attendance',
              Scanner: 'Scanner',
            },
          },
        }
      : undefined;

  return (
    <NavigationContainer linking={linking}>
      <RootTabs />
    </NavigationContainer>
  );
}
