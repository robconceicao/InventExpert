import { NavigationContainer } from '@react-navigation/native';
import React from 'react';

import RootTabs from '@/src/navigation/RootTabs';

export default function App() {
  return (
    <NavigationContainer>
      <RootTabs />
    </NavigationContainer>
  );
}
