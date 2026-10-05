import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';

//web-only replacement for the bottom tab bar - the primary admin
//destinations, as a collapsible left rail under the logo (set by TopBar above
//it). Profile now lives in the TopBar's account menu instead of here.
const NAV_ITEMS = [
  { route: '/(admin)/hazards', label: 'Hazards', icon: 'warning-outline' },
  { route: '/(admin)/events', label: 'Events', icon: 'list-outline' },
  { route: '/(admin)/commuter-notes', label: 'Notes to Admin', icon: 'document-text-outline' },
] as const;

export default function AdminSidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();

  return (
    <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
      <View style={[styles.header, collapsed && styles.headerCollapsed]}>
        {!collapsed && <Text style={styles.headerLabel}>MENU</Text>}
        <TouchableOpacity style={styles.collapseButton} onPress={onToggleCollapsed} hitSlop={8}>
          <Ionicons name={collapsed ? 'chevron-forward' : 'chevron-back'} size={18} color="#00853E" />
        </TouchableOpacity>
      </View>

      {NAV_ITEMS.map(item => {
        //expo-router strips "(group)" segments from the real URL, so the
        //live pathname is "/hazards", never "/(admin)/hazards" - match on
        //that stripped form. Secondary pages (hazard-history, post-alert, ...)
        //are nested under one of these three; keep that parent item
        //highlighted while on them too.
        const matchPath = item.route.replace('/(admin)', '');
        const isActive = pathname === matchPath || pathname.startsWith(`${matchPath}/`);
        return (
          <TouchableOpacity
            key={item.route}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => router.push(item.route as any)}
          >
            <Ionicons name={item.icon as any} size={22} color={isActive ? '#00853E' : '#666'} />
            {!collapsed && (
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 200,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    paddingTop: 8,
  },
  sidebarCollapsed: {
    width: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 10,
    marginBottom: 12,
  },
  headerCollapsed: {
    justifyContent: 'center',
    paddingLeft: 0,
    paddingRight: 0,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1.5,
  },
  collapseButton: {
    padding: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  navItemActive: {
    backgroundColor: '#E8F5EE',
    borderRightWidth: 3,
    borderRightColor: '#00853E',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  navLabelActive: {
    color: '#00853E',
  },
});
