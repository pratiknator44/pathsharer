import React, { useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { useRouter } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const AVATAR_PLACEHOLDER = 'https://ui-avatars.com/api/?name=User&background=0a7ea4&color=fff&size=128';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const { signOut } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [defaultMessage, setDefaultMessage] = useState('');

  function handleLogout() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  }

  function handleSave() {
    if (name.trim().length === 0) {
      Alert.alert('Validation', 'Please enter your name.');
      return;
    }
    Alert.alert('Saved', 'Your settings have been saved.');
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colorScheme === 'dark' ? '#1e1e1e' : '#f5f5f5',
      borderColor: colorScheme === 'dark' ? '#333' : '#ddd',
      color: colors.text },
  ];

  const labelStyle = [styles.label, { color: colors.text }];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled">

        {/* Header */}
        <Text style={[styles.header, { color: colors.text }]}>Settings</Text>

        {/* Avatar with edit icon */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => Alert.alert('Edit Photo', 'Photo picker coming soon.')}>
            <Image
              source={{ uri: AVATAR_PLACEHOLDER }}
              style={styles.avatar}
            />
            <View style={[styles.editBadge, { backgroundColor: colors.tint }]}>
              <IconSymbol name="pencil" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={labelStyle}>Name</Text>
          <TextInput
            style={inputStyle}
            placeholder="Enter your name"
            placeholderTextColor={colors.icon}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Default Message */}
        <View style={styles.fieldGroup}>
          <Text style={labelStyle}>Default Message</Text>
          <TextInput
            style={[inputStyle, styles.textArea]}
            placeholder="Enter the message sent with your location…"
            placeholderTextColor={colors.icon}
            value={defaultMessage}
            onChangeText={setDefaultMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="done"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint }]}
          onPress={handleSave}
          activeOpacity={0.8}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 28,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  saveButton: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 12,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e53935',
  },
  logoutText: {
    color: '#e53935',
    fontSize: 16,
    fontWeight: '700',
  },
});
