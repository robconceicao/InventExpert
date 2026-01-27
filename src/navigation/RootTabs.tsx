import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Image, Platform, Text, View } from 'react-native';

import AttendanceScreen from '@/src/screens/AttendanceScreen';
import ReportAScreen from '@/src/screens/ReportAScreen';
import ReportBScreen from '@/src/screens/ReportBScreen';
import ScannerScreen from '@/src/screens/ScannerScreen';

export type RootTabParamList = {
  ReportA: undefined;
  ReportB: undefined;
  Attendance: undefined;
  Scanner: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootTabs() {
  const showScanner = Platform.OS !== 'web';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#2563EB' },
        headerTintColor: '#fff',
        headerTitle: (props) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={require('../../assets/images/icon.png')} style={{ width: 24, height: 24 }} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{props.children}</Text>
          </View>
        ),
        tabBarActiveTintColor: '#2563EB',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
            ReportA: 'clipboard',
            ReportB: 'document-text',
            Attendance: 'people',
            Scanner: 'scan',
          };
          const iconName = iconMap[route.name as keyof RootTabParamList] ?? 'clipboard';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}>
      <Tab.Screen
        name="ReportA"
        component={ReportAScreen}
        options={{ title: 'Andamento de Inventário' }}
      />
      <Tab.Screen
        name="ReportB"
        component={ReportBScreen}
        options={{ title: 'Resumo de Inventário' }}
      />
      <Tab.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Escala' }} />
      {showScanner ? (
        <Tab.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scanner' }} />
      ) : null}
    </Tab.Navigator>
  );
}
