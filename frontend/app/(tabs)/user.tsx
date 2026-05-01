import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_URL } from '@/utils/api';
import { saveAuthToken } from '@/utils/storage';

export default function UserScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { pendingPhone, clearPendingPhone, setUserGender } = useAuth();

  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [email, setEmail] = useState('');

  const inputBg = colorScheme === 'dark' ? '#1e1e1e' : '#f5f5f5';
  const inputBorder = colorScheme === 'dark' ? '#333' : '#ddd';

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
        // New user - ensure phone is set from param
        setPhoneNumber(phoneNum);
      }
    } catch (err) {
      console.error('Error checking user:', err);
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

    const payload = {
      name: name.trim(),
      phone: phoneNumber,
      gender,
      email: email.trim() || undefined,
    };

    try {
      setLoading(true);
      let res;
      if (userId) {
        // Update existing user
        res = await fetch(`${API_URL}/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payload.name, gender: payload.gender, email: payload.email }),
        });
      } else {
        // Create new user
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

      if (json.token) {
        await saveAuthToken(json.token);
      }

      Alert.alert('Success', 'Profile saved successfully!', [
        { text: 'OK', onPress: () => { setUserGender(gender); router.replace('/(tabs)/sharer'); } },
      ]);
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !name) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled">

        <Text style={[styles.header, { color: colors.text }]}>
          {userId ? 'Update Profile' : 'Complete Your Profile'}
        </Text>

        {/* Name */}
        <Text style={[styles.label, { color: colors.text }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          placeholderTextColor={colors.icon}
          autoCapitalize="words"
        />

        {/* Phone (disabled) */}
        <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.icon }]}
          value={phoneNumber}
          editable={false}
        />

        {/* Gender Switch */}
        <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
        <View style={styles.genderRow}>
          <Text style={[styles.genderLabel, { color: gender === 'male' ? colors.tint : colors.icon }]}>
            Male
          </Text>
          <Switch
            value={gender === 'female'}
            onValueChange={(val) => setGender(val ? 'female' : 'male')}
            trackColor={{ false: colors.tint, true: '#ff69b4' }}
            thumbColor="#fff"
          />
          <Text style={[styles.genderLabel, { color: gender === 'female' ? '#ff69b4' : colors.icon }]}>
            Female
          </Text>
        </View>

        {/* Email */}
        <Text style={[styles.label, { color: colors.text }]}>Email (Optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: colors.text }]}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor={colors.icon}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{userId ? 'Update' : 'Save'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  saveButton: {
    marginTop: 32,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
