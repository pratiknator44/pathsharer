import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';
import { getAuthToken } from '@/utils/storage';

const APP_VERSION = '1.0.0';
const LAST_UPDATED = '13 May 2026';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const bg = isDark ? '#000' : '#f2f2f7';
  const cardBg = isDark ? '#1c1c1e' : '#fff';
  const borderColor = isDark ? '#2c2c2e' : '#e0e0e0';
  const subText = isDark ? '#8e8e93' : '#6b6b6b';
  const divider = isDark ? '#2c2c2e' : '#e5e5ea';
  const rowBg = isDark ? '#1c1c1e' : '#fff';

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  function handleDeleteData() {
    Alert.alert(
      'Delete All My Data',
      'This will permanently delete your account, messages, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const res = await fetch(`${API_URL}/users/me`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) throw new Error(`Server error ${res.status}`);
              signOut();
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not delete data. Please try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: cardBg, borderBottomColor: borderColor },
        ]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.backText, { color: colors.tint }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Account section */}
        <Text style={[styles.sectionLabel, { color: subText }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: rowBg, borderColor: divider }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={[styles.rowText, { color: colors.tint }]}>Sign Out</Text>
          </TouchableOpacity>
          <View style={[styles.rowDivider, { backgroundColor: divider }]} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteData} activeOpacity={0.7}>
            <Text style={[styles.rowText, { color: '#ff3b30' }]}>Delete All My Data</Text>
          </TouchableOpacity>
        </View>

        {/* App info section */}
        <Text style={[styles.sectionLabel, { color: subText }]}>APP INFO</Text>
        <View style={[styles.card, { backgroundColor: rowBg, borderColor: divider }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subText }]}>Version</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{APP_VERSION}</Text>
          </View>
          <View style={[styles.rowDivider, { backgroundColor: divider }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: subText }]}>Last updated</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{LAST_UPDATED}</Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, paddingBottom: 2, alignItems: 'center' },
  backText: { fontSize: 32, fontWeight: '300', lineHeight: 36 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', textAlign: 'center' },

  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 16, paddingVertical: 16 },
  rowText: { fontSize: 16, fontWeight: '500' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: { fontSize: 15 },
  infoValue: { fontSize: 15, fontWeight: '500' },
});
