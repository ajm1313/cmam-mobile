import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../lib/config';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/store';
import api, { storage } from '../lib/api';
import { sendOrQueue } from '../lib/offlineQueue';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOrQueue('/v1/profile/update/', 'patch', {
        name: name.trim(),
        phone: phone.trim(),
      }, 'Profile Update');
      if (res && res.data.success) {
        const updated = res.data.data;
        await storage.setItem('auth_user', JSON.stringify(updated));
        setUser(updated);
        Alert.alert('Success', 'Profile updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (!res) {
        Alert.alert('Saved Offline', 'Profile update saved and will sync when online.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update profile.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: Math.max(insets.top, 16), paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Avatar Preview */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <Text style={[styles.avatarName, { color: colors.textPrimary }]}>{name || 'Your Name'}</Text>
          <Text style={[styles.avatarEmail, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>

        {/* Form */}
        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Phone Number</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +233 24 123 4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Email (read-only)</Text>
          <View style={[styles.inputWrapper, { borderColor: colors.border + '60', backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.textMuted }]}
              value={user?.email ?? ''}
              editable={false}
              selectTextOnFocus={false}
            />
            <Ionicons name="lock-closed" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }, loading && styles.btnDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  avatarName: { fontSize: 18, fontWeight: '700' },
  avatarEmail: { fontSize: 13, marginTop: 4 },
  formCard: {
    marginHorizontal: 16, borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15 },
  saveBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 16, marginTop: 24, paddingVertical: 15,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
