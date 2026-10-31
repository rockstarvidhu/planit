import { Tabs } from 'expo-router';
import { tokens } from '../../design/tokens';

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: tokens.colors.forest,
        tabBarInactiveTintColor: tokens.colors.mutedText,
        tabBarLabelStyle: { fontFamily: tokens.typography.bodyFamily, fontSize: 12, fontWeight: '600' },
        tabBarItemStyle: { minHeight: tokens.layout.touchTarget },
        tabBarStyle: {
          backgroundColor: tokens.colors.paper,
          borderTopColor: tokens.colors.line,
          borderTopWidth: tokens.borders.hairline,
          minHeight: tokens.layout.tabBarMinHeight,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover', tabBarAccessibilityLabel: 'Discover tab' }} />
      <Tabs.Screen name="plans" options={{ title: 'Plans', tabBarAccessibilityLabel: 'Plans tab' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarAccessibilityLabel: 'Saved tab' }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarAccessibilityLabel: 'You tab' }} />
    </Tabs>
  );
}
