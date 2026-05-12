import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';
import { saveAuthToken } from '@/utils/storage';

// ── Context menu popover ─────────────────────────────────────────────────────

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onAbout: () => void;
  isDark: boolean;
  colors: typeof Colors['light'];
  anchorTop: number;
}

function ContextMenu({ visible, onClose, onSettings, onAbout, isDark, colors, anchorTop }: ContextMenuProps) {
  const menuBg = isDark ? '#2c2c2e' : '#fff';
  const divider = isDark ? '#3a3a3c' : '#e5e5ea';
  const shadow = isDark
    ? { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 12 }
    : { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8 };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.contextMenu, shadow, { backgroundColor: menuBg, top: anchorTop, right: 14 }]}>
        <TouchableOpacity
          style={styles.ctxRow}
          onPress={() => { onClose(); onSettings(); }}
          activeOpacity={0.7}>
          <Text style={[styles.ctxText, { color: colors.text }]}>⚙️  Settings</Text>
        </TouchableOpacity>
        <View style={[styles.ctxDivider, { backgroundColor: divider }]} />
        <TouchableOpacity
          style={styles.ctxRow}
          onPress={() => { onClose(); onAbout(); }}
          activeOpacity={0.7}>
          <Text style={[styles.ctxText, { color: colors.text }]}>ℹ️  About</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function UserScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingPhone, clearPendingPhone, setUserGender } = useAuth();

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [email, setEmail] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  const bg = isDark ? '#000' : '#f2f2f7';
  const cardBg = isDark ? '#1c1c1e' : '#fff';
  const inputBorder = isDark ? '#3a3a3c' : '#e0e0e0';
  const subText = isDark ? '#8e8e93' : '#6b6b6b';
  const borderColor = isDark ? '#2c2c2e' : '#e0e0e0';

  // Top anchor for context menu = below the header burger button
  const menuAnchorTop = insets.top + 54;

  useEffect(() => {
    if (pendingPhone) {
      setPhoneNumber(pendingPhone);
      checkExistingUser(pendingPhone);
      clearPendingPhone();
    }
  }, [pendingPhone]);

  async function checkExistingUser(phoneNum: string) {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/users/by-phone?phone=${encodeURIComponent(phoneNum)}`);
      const json = await res.json();
      if (json.data) {
        setUserId(json.data._id);
        setName(json.data.name ?? '');
        setPhoneNumber(json.data.phone ?? phoneNum);
        const g: 'male' | 'female' = json.data.gender ?? 'male';
        setGender(g);
        setUserGender(g);
        setEmail(json.data.email ?? '');
      } else {
        setPhoneNumber(phoneNum);
      }
    } catch {
      setPhoneNumber(phoneNum);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    const payload = { name: name.trim(), phone: phoneNumber, gender, email: email.trim() || undefined };

    try {
      setLoading(true);
      let res;
      if (userId) {
        res = await fetch(`${API_URL}/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payload.name, gender: payload.gender, email: payload.email }),
        });
      } else {
        res = await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        Alert.alert('Error', json.error ?? 'Failed to save user profile');
        return;
      }
      if (json.token) await saveAuthToken(json.token);

      Alert.alert('Success', 'Profile saved successfully!', [
        { text: 'OK', onPress: () => { setUserGender(gender); router.replace('/(tabs)/sharer'); } },
      ]);
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !name && !phoneNumber) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: cardBg, borderBottomColor: borderColor },
        ]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {userId ? 'Profile' : 'Complete Profile'}
        </Text>
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.burgerBtn}>
          <Text style={[styles.burgerIcon, { color: colors.icon }]}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* ── Form ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled">

          <Text style={[styles.fieldLabel, { color: subText }]}>NAME</Text>
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={subText}
              autoCapitalize="words"
            />
          </View>

          <Text style={[styles.fieldLabel, { color: subText }]}>PHONE NUMBER</Text>
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <TextInput
              style={[styles.fieldInput, { color: subText }]}
              value={phoneNumber}
              editable={false}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: subText }]}>GENDER</Text>
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <View style={styles.genderRow}>
              <Text style={[styles.genderLabel, { color: gender === 'male' ? colors.tint : subText }]}>Male</Text>
              <Switch
                value={gender === 'female'}
                onValueChange={(val) => setGender(val ? 'female' : 'male')}
                trackColor={{ false: colors.tint, true: '#ff69b4' }}
                thumbColor="#fff"
              />
              <Text style={[styles.genderLabel, { color: gender === 'female' ? '#ff69b4' : subText }]}>Female</Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: subText }]}>EMAIL (OPTIONAL)</Text>
          <View style={[styles.fieldCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={subText}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.tint, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveButtonText}>{userId ? 'Update Profile' : 'Save Profile'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Context menu ── */}
      <ContextMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSettings={() => router.push('/settings')}
        onAbout={() => router.push('/about')}
        isDark={isDark}
        colors={colors}
        anchorTop={menuAnchorTop}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', flex: 1 },
  burgerBtn: { paddingBottom: 2 },
  burgerIcon: { fontSize: 24 },

  formContent: { padding: 20, paddingBottom: 48 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 6,
    marginLeft: 4,
  },
  fieldCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fieldInput: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  genderLabel: { fontSize: 15, fontWeight: '600', marginHorizontal: 14 },
  saveButton: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Context menu
  contextMenu: {
    position: 'absolute',
    borderRadius: 12,
    minWidth: 180,
    overflow: 'hidden',
  },
  ctxRow: { paddingHorizontal: 16, paddingVertical: 14 },
  ctxText: { fontSize: 15, fontWeight: '500' },
  ctxDivider: { height: StyleSheet.hairlineWidth },
});
