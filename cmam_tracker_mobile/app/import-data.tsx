import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';
import api from '../lib/api';

// Note: Install expo-document-picker and expo-sharing for full functionality
// npx expo install expo-document-picker expo-sharing
let DocumentPicker: any = null;
let FileSystem: any = null;
let Sharing: any = null;

try {
  DocumentPicker = require('expo-document-picker');
} catch {}
try {
  FileSystem = require('expo-file-system');
} catch {}
try {
  Sharing = require('expo-sharing');
} catch {}

const IMPORT_TYPES = [
  { key: 'cases', label: 'Cases', icon: 'people-outline', desc: 'Import patient registrations' },
  { key: 'inventory', label: 'Inventory', icon: 'cube-outline', desc: 'Import stock items' },
];

export default function ImportDataScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<{id: number; name: string}[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<{name: string; uri: string; mimeType?: string} | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadFacilities();
  }, []);

  const loadFacilities = async () => {
    try {
      const response = await api.get('/v1/facilities/');
      const list = response.data.data || [];
      setFacilities(list.map((f: any) => ({ id: f.id, name: f.name })));
    } catch (e) {
      console.error('Failed to load facilities', e);
    }
  };

  const downloadTemplate = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select an import type first');
      return;
    }

    try {
      const url = `/v1/import/template/${selectedType}/`;
      const response = await api.get(url, { responseType: 'arraybuffer' });

      if (Platform.OS === 'web') {
        // Web download
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${selectedType}_import_template.xlsx`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        Alert.alert('Success', 'Template downloaded');
      } else {
        // Native - requires FileSystem and Sharing
        if (!FileSystem || !Sharing) {
          Alert.alert('Setup Required', 'Please install expo-file-system and expo-sharing: npx expo install expo-file-system expo-sharing');
          return;
        }

        const filename = `${selectedType}_import_template.xlsx`;
        const fileUri = FileSystem.cacheDirectory + filename;

        // Convert arraybuffer to base64
        const base64 = btoa(
          new Uint8Array(response.data).reduce((data: string, byte: number) => data + String.fromCharCode(byte), '')
        );
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Import Template',
          });
        } else {
          Alert.alert('Success', `Template saved: ${filename}`);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to download template');
    }
  };

  const pickFile = async () => {
    if (!DocumentPicker) {
      Alert.alert('Setup Required', 'Please install expo-document-picker: npx expo install expo-document-picker');
      return;
    }
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled === false && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
        });
        setPreviewData(null);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const previewImport = async () => {
    if (!selectedType || !selectedFile) {
      Alert.alert('Error', 'Please select import type and file');
      return;
    }

    if (selectedType === 'inventory' && !selectedFacility) {
      Alert.alert('Error', 'Please select a facility for inventory import');
      return;
    }

    setPreviewing(true);
    try {
      const formData = new FormData();
      
      // Append file
      if (Platform.OS === 'web') {
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();
        formData.append('file', blob, selectedFile.name);
      } else {
        const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
        if (fileInfo.exists) {
          formData.append('file', {
            uri: selectedFile.uri,
            name: selectedFile.name,
            type: selectedFile.mimeType || 'application/octet-stream',
          } as any);
        }
      }

      if (selectedType === 'inventory' && selectedFacility) {
        formData.append('facility_id', selectedFacility.toString());
      }

      const endpoint = selectedType === 'cases' 
        ? '/v1/import/cases/preview/'
        : '/v1/import/inventory/preview/';

      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        setPreviewData(response.data.data);
      } else {
        Alert.alert('Preview Failed', response.data.error || 'Unknown error');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to preview import');
    } finally {
      setPreviewing(false);
    }
  };

  const executeImport = async () => {
    if (!previewData || (previewData.valid === 0 && previewData.valid_rows === 0)) {
      Alert.alert('Error', 'No valid rows to import');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const response = await fetch(selectedFile!.uri);
        const blob = await response.blob();
        formData.append('file', blob, selectedFile!.name);
      } else {
        formData.append('file', {
          uri: selectedFile!.uri,
          name: selectedFile!.name,
          type: selectedFile!.mimeType || 'application/octet-stream',
        } as any);
      }

      if (selectedType === 'inventory' && selectedFacility) {
        formData.append('facility_id', selectedFacility.toString());
      }

      const endpoint = selectedType === 'cases'
        ? '/v1/import/cases/execute/'
        : '/v1/import/inventory/execute/';

      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        const data = response.data.data;
        const msg = selectedType === 'cases'
          ? `Created: ${data.created}\nFailed: ${data.failed}`
          : `Created: ${data.created}\nUpdated: ${data.updated}\nFailed: ${data.failed}`;
        
        Alert.alert('Import Complete', msg, [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Import Failed', response.data.error || 'Unknown error');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to execute import');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Data</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Import Type Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Select Import Type</Text>
        <View style={styles.typeGrid}>
          {IMPORT_TYPES.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[
                styles.typeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedType === type.key && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
              ]}
              onPress={() => {
                setSelectedType(type.key);
                setPreviewData(null);
              }}
            >
              <Ionicons name={type.icon as any} size={28} color={selectedType === type.key ? colors.primary : colors.textSecondary} />
              <Text style={[styles.typeLabel, { color: colors.textPrimary }]}>{type.label}</Text>
              <Text style={[styles.typeDesc, { color: colors.textMuted }]}>{type.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Template Download */}
      {selectedType && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Step 1: Download Template</Text>
          <TouchableOpacity
            style={[styles.templateBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={downloadTemplate}
          >
            <Ionicons name="download-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.templateTitle, { color: colors.textPrimary }]}>
                Download {selectedType === 'cases' ? 'Cases' : 'Inventory'} Template
              </Text>
              <Text style={[styles.templateDesc, { color: colors.textMuted }]}>
                Get the Excel template with correct columns
              </Text>
            </View>
            <Ionicons name="document-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Facility Selection (for inventory) */}
      {selectedType === 'inventory' && facilities.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Select Destination Facility</Text>
          <View style={[styles.facilitySelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {facilities.map((facility) => (
              <TouchableOpacity
                key={facility.id}
                style={[
                  styles.facilityOption,
                  { borderBottomColor: colors.border },
                  selectedFacility === facility.id && { backgroundColor: colors.primary + '10' },
                ]}
                onPress={() => setSelectedFacility(facility.id)}
              >
                <Ionicons
                  name={selectedFacility === facility.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedFacility === facility.id ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.facilityName, { color: colors.textPrimary }]}>{facility.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* File Selection */}
      {selectedType && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Step 2: Select Your File</Text>
          <TouchableOpacity
            style={[styles.fileBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={pickFile}
          >
            <Ionicons name="document-attach-outline" size={24} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.fileTitle, { color: colors.textPrimary }]}>
                {selectedFile ? selectedFile.name : 'Choose CSV or Excel File'}
              </Text>
              <Text style={[styles.fileDesc, { color: colors.textMuted }]}>
                {selectedFile ? 'File selected' : 'Tap to browse files'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Preview Button */}
      {selectedType && selectedFile && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.previewBtn, { backgroundColor: colors.secondary }, previewing && { opacity: 0.6 }]}
            onPress={previewImport}
            disabled={previewing}
          >
            {previewing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="eye-outline" size={18} color="#fff" />
                <Text style={styles.previewBtnText}>Preview Import</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Preview Results */}
      {previewData && (
        <View style={[styles.section, styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Preview Results</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.info + '10' }]}>
              <Text style={[styles.statValue, { color: colors.info }]}>{previewData.total || previewData.total_rows || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.success + '10' }]}>
              <Text style={[styles.statValue, { color: colors.success }]}>{previewData.valid || previewData.valid_rows || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Valid</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.danger + '10' }]}>
              <Text style={[styles.statValue, { color: colors.danger }]}>{previewData.invalid || previewData.invalid_rows || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Invalid</Text>
            </View>
          </View>
        </View>
      )}

      {/* Execute Button */}
      {previewData && (previewData.valid > 0 || previewData.valid_rows > 0) && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.importBtn, { backgroundColor: colors.primary }, importing && { opacity: 0.6 }]}
            onPress={executeImport}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.importBtnText}>Execute Import</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  typeGrid: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1, alignItems: 'center', padding: 16,
    borderRadius: 16, borderWidth: 1.5,
  },
  typeLabel: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  typeDesc: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  templateBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 12, borderWidth: 1.5,
  },
  templateTitle: { fontSize: 14, fontWeight: '600' },
  templateDesc: { fontSize: 12, marginTop: 2 },
  facilitySelector: {
    borderRadius: 12, borderWidth: 1.5, overflow: 'hidden',
  },
  facilityOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1,
  },
  facilityName: { fontSize: 14, fontWeight: '600' },
  fileBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  fileTitle: { fontSize: 14, fontWeight: '600' },
  fileDesc: { fontSize: 12, marginTop: 2 },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12,
  },
  previewBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  previewCard: {
    padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statBox: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 12,
  },
  importBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
