import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';

// Fallback values used when the server is unreachable
const FALLBACK = {
  contactEmail: 'pratik@example.com',
  whatsappNumber: '919999999999',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=com.pathsharer',
} as const;

async function openUrl(url: string) {
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  } else {
    Alert.alert('Oops', "Couldn't open this link on your device.");
  }
}

interface AppConfig {
  contactEmail: string;
  whatsappNumber: string;
  playStoreUrl: string;
}

export default function AboutScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<AppConfig>(FALLBACK);

  useEffect(() => {
    fetch(`${API_URL}/config`)
      .then((r) => r.json())
      .then((data: Partial<AppConfig>) => {
        setConfig({
          contactEmail: data.contactEmail ?? FALLBACK.contactEmail,
          whatsappNumber: data.whatsappNumber ?? FALLBACK.whatsappNumber,
          playStoreUrl: data.playStoreUrl ?? FALLBACK.playStoreUrl,
        });
      })
      .catch(() => { /* silently keep fallback */ });
  }, []);

  const bg = isDark ? '#000' : '#f2f2f7';
  const cardBg = isDark ? '#1c1c1e' : '#fff';
  const borderColor = isDark ? '#2c2c2e' : '#e0e0e0';
  const subText = isDark ? '#8e8e93' : '#6b6b6b';
  const divider = isDark ? '#2c2c2e' : '#ececec';

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>About</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>

        {/* Main message card */}
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <Text style={styles.waveEmoji}>👋</Text>
          <Text style={[styles.thankYouText, { color: colors.text }]}>
            Hope PathSharer saved you some money!
          </Text>
          <Text style={[styles.bodyText, { color: subText }]}>
            🚗  Every shared ride means less traffic and more savings.
          </Text>
          <Text style={[styles.bodyText, { color: subText }]}>
            🗣️  Chat with your co-passenger — great friendships start on the road.
          </Text>
          <Text style={[styles.bodyText, { color: subText }]}>
            🐞  Found a bug or have an idea? I&apos;d love to hear from you.
          </Text>

          <View style={[styles.divider, { backgroundColor: divider }]} />

          <Text style={[styles.createdText, { color: subText }]}>
            created with ❤️ in and for India
          </Text>
          <Text style={[styles.author, { color: subText }]}>— Pratik, author</Text>
        </View>

        {/* Contact buttons */}
        <Text style={[styles.sectionLabel, { color: subText }]}>GET IN TOUCH</Text>
        <View style={[styles.card, { backgroundColor: cardBg }]}>

          {/* Email */}
          <TouchableOpacity
            style={styles.contactRow}
            activeOpacity={0.7}
            onPress={() => openUrl(`mailto:${config.contactEmail}?subject=PathSharer%20Feedback`)}>
            <View style={[styles.contactIcon, { backgroundColor: '#007aff20' }]}>
              <Text style={styles.contactEmoji}>✉️</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: colors.text }]}>Email</Text>
              <Text style={[styles.contactSub, { color: subText }]}>Mail</Text>
            </View>
            <Text style={[styles.chevron, { color: subText }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: divider }]} />

          {/* WhatsApp */}
          <TouchableOpacity
            style={styles.contactRow}
            activeOpacity={0.7}
            onPress={() => openUrl(`https://wa.me/${config.whatsappNumber}?text=Hi%20Pratik!%20Feedback%20on%20PathSharer%3A`)}>
            <View style={[styles.contactIcon, { backgroundColor: '#25d36620' }]}>
              <Text style={styles.contactEmoji}>💬</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: colors.text }]}>WhatsApp</Text>
              <Text style={[styles.contactSub, { color: subText }]}>WhatsApp</Text>
            </View>
            <Text style={[styles.chevron, { color: subText }]}>›</Text>
          </TouchableOpacity>

          <View style={[styles.rowDivider, { backgroundColor: divider }]} />

          {/* Play Store */}
          <TouchableOpacity
            style={styles.contactRow}
            activeOpacity={0.7}
            onPress={() => openUrl(config.playStoreUrl)}>
            <View style={[styles.contactIcon, { backgroundColor: '#34c75920' }]}>
              <Text style={styles.contactEmoji}>⭐</Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactLabel, { color: colors.text }]}>Play Store</Text>
              <Text style={[styles.contactSub, { color: subText }]}>Rate this app</Text>
            </View>
            <Text style={[styles.chevron, { color: subText }]}>›</Text>
          </TouchableOpacity>

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

  body: { padding: 20, paddingBottom: 48 },

  card: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 8,
  },

  waveEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 10 },
  thankYouText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 12,
  },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  createdText: { fontSize: 14, textAlign: 'center', marginBottom: 4 },
  author: { fontSize: 14, fontStyle: 'italic', textAlign: 'center' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactEmoji: { fontSize: 22 },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 16, fontWeight: '600' },
  contactSub: { fontSize: 13, marginTop: 1 },
  chevron: { fontSize: 22, fontWeight: '300' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
});
