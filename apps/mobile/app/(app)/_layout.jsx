import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4caf50',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: Platform.select({
          web: {
            height: 56,
            paddingBottom: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: '#e8e8e8',
            backgroundColor: '#fff',
          },
          default: {
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: '#e8e8e8',
            backgroundColor: '#fff',
          },
        }),
      }}
    >
      <Tabs.Screen
        name="memo"
        options={{
          title: '记录',
          tabBarIcon: ({ color }) => null,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '搜索',
          tabBarIcon: ({ color }) => null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color }) => null,
        }}
      />
    </Tabs>
  );
}
