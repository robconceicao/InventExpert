import {
  NavigationContainer,
  getPathFromState,
  type LinkingOptions,
} from '@react-navigation/native';
import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import RootTabs, { type RootTabParamList } from '@/src/navigation/RootTabs';
import AuthScreen from '@/src/screens/AuthScreen';
import { isSupabaseConfigured, supabase } from '@/src/services/supabase';
import { syncQueue } from '@/src/services/sync';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        void syncQueue();
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <Text className="text-sm text-slate-600">Carregando...</Text>
      </View>
    );
  }

  const shouldShowAuth = isSupabaseConfigured && !session;

  if (shouldShowAuth) {
    return <AuthScreen />;
  }

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
