import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Loaded from .env — EXPO_PUBLIC_GOOGLE_API_KEY
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY ?? 'GOOGLE_API_KEY';

export default function LoginScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');

  const bg = colors.background;
  const textColor = colors.text;
  const inputBg = colorScheme === 'dark' ? '#1e1e1e' : '#f5f5f5';
  const inputBorder = colorScheme === 'dark' ? '#333' : '#ddd';

  function handleGoogleSignIn() {
    // Fake sign-in — real implementation would use GOOGLE_API_KEY
    void GOOGLE_API_KEY; // prevent unused warning
    Alert.alert('Google Sign-In', 'Google Sign-In is not yet configured.');
  }

  function handleContinue() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }
    const fullPhone = `${countryCode}${phone}`;
    router.push({
      pathname: '/(auth)/otp',
      params: { phone: fullPhone },
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: bg }]}
        keyboardShouldPersistTaps="handled">

        {/* Logo / App name */}
        <View style={styles.hero}>
          <Text style={[styles.appName, { color: colors.tint }]}>PathSharer</Text>
          <Text style={[styles.tagline, { color: colors.icon }]}>
            Share your path with those you trust
          </Text>
        </View>

        {/* Google Sign In */}
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.85}>
          <View style={styles.googleIconBox}>
            <Text style={styles.googleG}>G</Text>
          </View>
          <Text style={styles.googleText}>Sign Up with Google</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
          <Text style={[styles.dividerText, { color: colors.icon }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
        </View>

        {/* Phone number */}
        <Text style={[styles.label, { color: textColor }]}>Phone Number</Text>
        <View style={styles.phoneRow}>
          <TextInput
            style={[
              styles.countryCodeInput,
              { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
            ]}
            value={countryCode}
            onChangeText={setCountryCode}
            keyboardType="phone-pad"
            maxLength={5}
          />
          <TextInput
            style={[
              styles.phoneInput,
              { backgroundColor: inputBg, borderColor: inputBorder, color: textColor },
            ]}
            placeholder="Phone number"
            placeholderTextColor={colors.icon}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>

        {/* Continue */}
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors.tint }]}
          onPress={handleContinue}
          activeOpacity={0.85}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 28,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    textAlign: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  googleG: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  googleText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  countryCodeInput: {
    width: 72,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 16,
    textAlign: 'center',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
