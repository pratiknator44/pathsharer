import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSocket } from '@/context/socket-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { hasUnreadMessages } = useSocket();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="user"
        options={{
          title: 'User',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sharer"
        options={{
          title: 'Sharer',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="location.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color }) => (
            <View>
              <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />
              {hasUnreadMessages && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: '#ff3b30',
                  borderWidth: 1.5,
                  borderColor: '#fff',
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
