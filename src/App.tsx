import {
  NavigationContainer,
  getPathFromState,
  type LinkingOptions,
} from '@react-navigation/native';
import React from 'react';
import { Platform } from 'react-native';

import RootTabs, { type RootTabParamList } from '@/src/navigation/RootTabs';

export default function App() {
  const basePath = 'InventExpert';
  const linking: LinkingOptions<RootTabParamList> | undefined =
    Platform.OS === 'web'
      ? {
          prefixes: ['https://robconceicao.github.io', '/'],
          config: {
            screens: {
              ReportA: '',
              ReportB: 'ReportB',
              Attendance: 'Attendance',
              Scanner: 'Scanner',
            },
          },
          getPathFromState: (state, options) => {
            const path = getPathFromState(state, options);
            return path ? `${basePath}/${path}` : basePath;
          },
        }
      : undefined;

  return (
    <NavigationContainer linking={linking}>
      <RootTabs />
    </NavigationContainer>
  );
}