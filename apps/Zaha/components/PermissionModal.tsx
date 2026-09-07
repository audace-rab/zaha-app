import { useState } from 'react';
import {
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import FontIcon from './FontIcon';

const FLAG_KEY = 'zaha_permissions_requested';

type Props = {
  visible: boolean;
  onClose: () => void;
};

async function persistRequested() {
  try {
    await AsyncStorage.setItem(FLAG_KEY, 'true');
  } catch {
    // Non bloquant : le flag ne sera pas mémorisé, le popup pourra réapparaître.
  }
}

export default function PermissionModal({ visible, onClose }: Props) {
  const [denied, setDenied] = useState(false);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
        await persistRequested();
        const values = Object.values(results);
        const permanentlyDenied = values.some(
          (r) => r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        );
        if (permanentlyDenied) {
          setDenied(true);
          return;
        }
      } else {
        // iOS : la géolocalisation passe par la demande native de la lib ;
        // la caméra ne nécessite pas de permission système via cette lib.
        try {
          Geolocation.requestAuthorization(() => {}, () => {});
        } catch {
          // Non bloquant.
        }
        await persistRequested();
      }
      onClose();
    } catch {
      await persistRequested();
      onClose();
    }
  };

  const remindLater = async () => {
    await persistRequested();
    setDenied(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={remindLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {denied ? (
            <>
              <FontIcon name="location-dot" width={40} height={40} fill="#ef4444" />
              <Text style={styles.title}>Autorisation refusée</Text>
              <Text style={styles.message}>
                Autorisation refusée. Ouvrez les réglages pour les activer.
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.8}
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les réglages"
              >
                <Text style={styles.primaryButtonText}>Ouvrir les réglages</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.8}
                onPress={remindLater}
                accessibilityRole="button"
                accessibilityLabel="Plus tard"
              >
                <Text style={styles.secondaryButtonText}>Plus tard</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Autorisations nécessaires</Text>
              <Text style={styles.message}>
                Pour améliorer votre expérience, Zaha souhaite accéder à votre appareil photo et à
                votre position.
              </Text>
              <View style={styles.permissionRow}>
                <FontIcon name="camera" width={20} height={20} fill="#2563eb" />
                <Text style={styles.permissionLabel}>Appareil photo</Text>
              </View>
              <View style={styles.permissionRow}>
                <FontIcon name="location-dot" width={20} height={20} fill="#2563eb" />
                <Text style={styles.permissionLabel}>Position</Text>
              </View>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.8}
                onPress={requestPermissions}
                accessibilityRole="button"
                accessibilityLabel="Autoriser"
              >
                <Text style={styles.primaryButtonText}>Autoriser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.8}
                onPress={remindLater}
                accessibilityRole="button"
                accessibilityLabel="Plus tard"
              >
                <Text style={styles.secondaryButtonText}>Plus tard</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  message: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' },
  permissionLabel: { fontSize: 15, color: '#374151', fontWeight: '600' },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: { color: '#374151', fontWeight: '600', fontSize: 14 },
});