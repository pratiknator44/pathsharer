import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const FAKE_OTP = '000000';
const OTP_LENGTH = 6;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { signIn } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  const inputBg = colorScheme === 'dark' ? '#1e1e1e' : '#f5f5f5';
  const inputBorder = colorScheme === 'dark' ? '#444' : '#ddd';

  function handleChange(text: string, index: number) {
    const val = text.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = val;
    setOtp(next);
    if (val && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(e: { nativeEvent: { key: string } }, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handleVerify() {
    const entered = otp.join('');
    if (entered.length < OTP_LENGTH) {
      Alert.alert('Enter OTP', 'Please enter all 6 digits.');
      return;
    }
    if (entered !== FAKE_OTP) {
      Alert.alert('Incorrect OTP', 'The code you entered is wrong. Try 000000.');
      return;
    }
    signIn(phone ?? '');
  }

  function handleResend() {
    Alert.alert('OTP Resent', 'A new OTP has been sent (hint: use 000000).');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>

        {/* Back */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.tint }]}>← Back</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>Verify your number</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={{ fontWeight: '700', color: colors.text }}>{phone}</Text>
        </Text>

        {/* OTP Boxes */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              style={[
                styles.otpBox,
                {
                  backgroundColor: inputBg,
                  borderColor: digit ? colors.tint : inputBorder,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify */}
        <TouchableOpacity
          style={[styles.verifyButton, { backgroundColor: colors.tint }]}
          onPress={handleVerify}
          activeOpacity={0.85}>
          <Text style={styles.verifyText}>Verify</Text>
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity style={styles.resendButton} onPress={handleResend}>
          <Text style={[styles.resendText, { color: colors.icon }]}>
            Didn't receive a code?{' '}
            <Text style={{ color: colors.tint, fontWeight: '600' }}>Resend</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 28,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 32,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 36,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 36,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
  },
  verifyButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendButton: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
  },
});
