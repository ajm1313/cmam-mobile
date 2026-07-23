import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../lib/config';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../lib/store';
import api, { storage } from '../lib/api';
import { sendOrReject } from '../lib/offlineQueue';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please grant camera roll access to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: name.trim(),
        phone: phone.trim(),
      };
      if (avatarUri) {
        const formData = new FormData();
        formData.append('name', name.trim());
        formData.append('phone', phone.trim());
        formData.append('avatar', {
          uri: avatarUri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        } as any);
        const res = await api.patch('/v1/profile/update/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data?.success) {
          const updated = res.data.data;
          await storage.setItem('auth_user', JSON.stringify(updated));
          setUser(updated);
          Alert.alert('Success', 'Profile updated successfully.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
        return;
      }
      const res = await sendOrReject('/v1/profile/update/', 'patch', payload, 'Profile Update');
      if (res && res.data.success) {
        const updated = res.data.data;
        await storage.setItem('auth_user', JSON.stringify(updated));
        setUser(updated);
        Alert.alert('Success', 'Profile updated successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      if (error.message?.includes('internet connection')) return;
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
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} style={styles.avatarContainer}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
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

        {/* Role & Location Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textPrimary }]}>Role & Assignment</Text>

          <View style={styles.infoRow}>
            <Ionicons name="shield-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Role</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.role?.display_name || user?.role?.name || '—'}</Text>
          </View>

          {user?.location?.facility_name && (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Facility</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user.location.facility_name}</Text>
            </View>
          )}

          {user?.location?.region_name && (
            <View style={styles.infoRow}>
              <Ionicons name="map-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Region</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user.location.region_name}</Text>
            </View>
          )}

          {user?.location?.district_name && (
            <View style={styles.infoRow}>
              <Ionicons name="navigate-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>District</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user.location.district_name}</Text>
            </View>
          )}
        </View>

        {/* Account Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textPrimary }]}>Account Information</Text>

          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color={user?.is_active ? '#16a34a' : '#dc2626'} />
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Status</Text>
            <Text style={[styles.infoValue, { color: user?.is_active ? '#16a34a' : '#dc2626', fontWeight: '700' }]}>
              {user?.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>

          {user?.is_superuser && (
            <View style={styles.infoRow}>
              <Ionicons name="star-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Superuser</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>Yes</Text>
            </View>
          )}

          {user?.is_staff && (
            <View style={styles.infoRow}>
              <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Staff</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>Yes</Text>
            </View>
          )}

          {user?.created_at && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Joined</Text>
              <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{new Date(user.created_at).toLocaleDateString()}</Text>
            </View>
          )}
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
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImage: {
    width: 80, height: 80, borderRadius: 40,
  },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
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
  infoCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  infoCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 13, fontWeight: '600', minWidth: 70 },
  infoValue: { fontSize: 14, fontWeight: '500', marginLeft: 'auto', textAlign: 'right' },
});
