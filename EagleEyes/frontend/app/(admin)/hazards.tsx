import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Image, Modal, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getAlerts, getPendingAlerts, getDeclinedAlerts, approveAlert, deleteAlert, setHazardActive, uploadAlertImage, BASE_URL } from '../../api/alerts';
import { useLots } from '../../context/LotsContext';
import LotMiniMap from '../../components/LotMiniMap';
import { Alert } from '../../utils/webCompat';
import { getHazardVisual } from '../../utils/alertVisuals';
import { isHazardActive } from '../../utils/lotStatus';
import { useFocusPolling } from '../../hooks/use-focus-polling';

const IS_WEB = Platform.OS === 'web';

// ─── Helpers ──────────────────────────────────────────────────────────────────

//backend stores timestamps in UTC but serializes them without a "Z" suffix;
//append it before parsing so JS converts to the device's local time correctly
const parseUTC = (isoString: string) =>
  new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : `${isoString}Z`);

const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getTodayDateString = () => toLocalDateString(new Date());

const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
};

const formatDateTime = (isoString: string) => {
  const local = parseUTC(isoString);
  const dateStr = toLocalDateString(local);
  const time = local
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    .replace(' ', '');
  if (dateStr === getTodayDateString()) return `TODAY ${time}`;
  if (dateStr === getYesterdayDateString()) return `YESTERDAY ${time}`;
  return `${dateStr} ${time}`;
};

// ─── HazardCard ───────────────────────────────────────────────────────────────

function HazardCard({
  hazard,
  isNew,
  onPress,
}: {
  hazard: any;
  isNew: boolean;
  onPress: () => void;
}) {
  const { icon, bg, iconColor, iconFamily } = getHazardVisual(hazard.category);
  return (
    <TouchableOpacity
      style={[styles.card, !isNew && styles.cardOlder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {isNew && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{hazard.upvotes}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={[styles.iconBox, { backgroundColor: bg }]}>
          {iconFamily === 'materialCommunity' ? (
            <MaterialCommunityIcons name={icon as any} size={22} color={iconColor} />
          ) : (
            <Ionicons name={icon as any} size={22} color={iconColor} />
          )}
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, !isNew && styles.olderText]} numberOfLines={1}>
            {hazard.title}
          </Text>
          <Text style={[styles.cardTime, !isNew && styles.olderText]}>
            {formatDateTime(hazard.created_at)}
          </Text>
          {hazard.status === 'published' && (
            <Text style={[styles.activeTag, !isHazardActive(hazard) && styles.inactiveTag]}>
              {isHazardActive(hazard) ? '● ACTIVE ON MAP' : '○ INACTIVE'}
            </Text>
          )}
          {!!hazard.lot_name && (
            <Text style={[styles.cardLot, !isNew && styles.olderText]} numberOfLines={1}>
              📍 {hazard.lot_name}
            </Text>
          )}
          <Text style={styles.clickDetails}>CLICK FOR DETAILS</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── HazardColumn (web three-column layout) ────────────────────────────────────

//a bounded box that fits within the screen, scrolling internally for overflow
//instead of growing the whole page - used for the web Pending/Declined/Published split
function HazardColumn({
  title,
  accentColor,
  hazards,
  isNew,
  onPress,
  emptyText,
}: {
  title: string;
  accentColor: string;
  hazards: any[];
  isNew: boolean;
  onPress: (h: any) => void;
  emptyText: string;
}) {
  return (
    <View style={[styles.webColumn, { borderLeftColor: accentColor }]}>
      <Text style={[styles.webColumnTitle, { color: accentColor }]}>
        {title} ({hazards.length})
      </Text>
      <ScrollView style={styles.webColumnScroll} contentContainerStyle={styles.webColumnScrollContent}>
        {hazards.length === 0 ? (
          <Text style={styles.emptyText}>{emptyText}</Text>
        ) : (
          hazards.map(h => (
            <HazardCard key={h.id} hazard={h} isNew={isNew} onPress={() => onPress(h)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── HazardDetail ─────────────────────────────────────────────────────────────

function HazardDetail({
  hazard,
  isPending,
  onBack,
  onDecline,
  onApprove,
  onSetActive,
}: {
  hazard: any;
  isPending: boolean;
  onBack: () => void;
  onDecline: (h: any) => void;
  onApprove: (h: any, edits: { title: string; description: string; image_urls: string[] }) => void;
  onSetActive: (h: any, active: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const isPublished = hazard.status === 'published';
  const isActive = isPublished && isHazardActive(hazard);
  //admins can edit a pending report before publishing it
  const [editTitle, setEditTitle] = useState(hazard.title ?? '');
  const [editDescription, setEditDescription] = useState(hazard.description ?? '');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const photoUrls: string[] = Array.isArray(hazard.image_urls) ? hazard.image_urls : [];
  //the admin can drop unclear student photos or attach better ones before publishing
  const [editPhotos, setEditPhotos] = useState<string[]>(photoUrls);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleAddPhoto = async () => {
    if (editPhotos.length >= 3) {
      Alert.alert('Limit Reached', 'An alert can have up to 3 photos.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo Access Needed', 'Please allow photo library access in Settings.');
      return;
    }
    //same multi-select config as the commuter report form (known-good on device)
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: 3 - editPhotos.length,
    });
    if (result.canceled || !result.assets?.length) return;
    setIsUploadingPhoto(true);
    try {
      for (const asset of result.assets.slice(0, 3 - editPhotos.length)) {
        const { image_url } = await uploadAlertImage(asset);
        setEditPhotos(prev => [...prev, image_url]);
      }
    } catch {
      Alert.alert('Error', 'Could not upload the photo. Check your connection.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  //find the reported lot's polygon so the detail can show it on a real map
  const { lots } = useLots();
  const reportedLot = hazard.lot_name
    ? lots.find((l: any) => l.name === hazard.lot_name && Array.isArray(l.coordinates) && l.coordinates.length >= 3)
    : null;
  const lotRegion = reportedLot
    ? {
        latitude: reportedLot.coordinates.reduce((s: number, c: any) => s + c.latitude, 0) / reportedLot.coordinates.length,
        longitude: reportedLot.coordinates.reduce((s: number, c: any) => s + c.longitude, 0) / reportedLot.coordinates.length,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    : null;

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          {!IS_WEB && <Ionicons name="chevron-back" size={20} color="#00853E" />}
          <Text style={styles.backText}>{IS_WEB ? 'Back to list' : 'Back'}</Text>
        </TouchableOpacity>

        {isPending ? (
          <TextInput
            style={[styles.detailTitle, styles.editableField]}
            value={editTitle}
            onChangeText={setEditTitle}
            autoCapitalize="characters"
          />
        ) : (
          <Text style={styles.detailTitle}>{hazard.title}</Text>
        )}
        <Text style={styles.detailTime}>{formatDateTime(hazard.created_at)}</Text>
        {isPublished && (
          <Text style={[styles.activeStatus, !isActive && styles.inactiveTag]}>
            {isActive
              ? '● ACTIVE ON MAP AND LOTS UNTIL DEACTIVATED'
              : `○ DEACTIVATED ${formatDateTime(hazard.deactivated_at)} · HIDDEN FROM MAP AND LOTS`}
          </Text>
        )}

        <View style={styles.detailCard}>
          <Text style={styles.locationLabel}>
            LOT: <Text style={styles.locationValue}>{hazard.lot_name ?? 'Not specified'}</Text>
          </Text>
          <Text style={styles.locationLabel}>LOCATION / DESCRIPTION:</Text>
          {isPending ? (
            <TextInput
              style={[styles.locationValue, styles.editableField]}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              placeholder="No location provided"
            />
          ) : (
            <Text style={styles.locationValue}>
              {hazard.description ?? 'No location provided'}
            </Text>
          )}

          {reportedLot && lotRegion ? (
            <LotMiniMap
              style={styles.lotMap}
              coordinates={reportedLot.coordinates}
              region={lotRegion}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map-outline" size={38} color="#bbb" />
              <Text style={styles.mapPlaceholderText}>Map unavailable</Text>
              <Text style={styles.mapPlaceholderSub}>No lot selected in this report</Text>
            </View>
          )}
        </View>

        <Text style={styles.studentCount}>
          STUDENT REPORT(S): {hazard.upvotes}
        </Text>
        {Array.isArray(hazard.reporter_emails) && hazard.reporter_emails.length > 0 && (
          <Text style={styles.reporterEmails} numberOfLines={2}>
            REPORTED BY: {hazard.reporter_emails.join(', ')}
          </Text>
        )}

        <Text style={styles.locationLabel}>
          {isPending ? 'PHOTOS (TAP \u2715 TO REMOVE, WILL PUBLISH AS SHOWN):' : 'PHOTOS POSTED BY STUDENT:'}
        </Text>
        {isPending ? (
          <View style={styles.pictureRow}>
            {editPhotos.map(url => (
              <View key={url} style={styles.photoEditWrap}>
                <TouchableOpacity onPress={() => setPreviewUri(`${BASE_URL}${url}`)} activeOpacity={0.85}>
                  <Image source={{ uri: `${BASE_URL}${url}` }} style={styles.pictureThumb} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoRemoveBadge}
                  onPress={() => setEditPhotos(prev => prev.filter(u => u !== url))}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {Array.from({ length: 3 - editPhotos.length }).map((_, i) => (
              <TouchableOpacity key={`add-slot-${i}`} style={styles.addPhotoTile} onPress={handleAddPhoto} disabled={isUploadingPhoto}>
                {isUploadingPhoto && i === 0 ? (
                  <ActivityIndicator color="#00853E" />
                ) : (
                  <>
                    <Ionicons name="add" size={26} color="#00853E" />
                    <Text style={styles.addPhotoText}>ADD</Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : photoUrls.length > 0 ? (
          <View style={styles.pictureRow}>
            {photoUrls.map(url => (
              <TouchableOpacity key={url} onPress={() => setPreviewUri(`${BASE_URL}${url}`)} activeOpacity={0.85}>
                <Image source={{ uri: `${BASE_URL}${url}` }} style={styles.pictureThumb} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.picturePlaceholder}>
            <Ionicons name="image-outline" size={30} color="#bbb" />
            <Text style={styles.pictureLabel}>NO PHOTOS SUBMITTED</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.actionRow, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.declineButton} onPress={() => onDecline(hazard)}>
          <Text style={styles.actionButtonText}>
            {hazard.status === 'pending' ? 'DECLINE' : hazard.status === 'declined' ? 'DELETE' : 'REMOVE'}
          </Text>
        </TouchableOpacity>
        {isPublished && (
          <TouchableOpacity
            style={isActive ? styles.deactivateButton : styles.approveButton}
            onPress={() => onSetActive(hazard, !isActive)}
          >
            <Text style={styles.actionButtonText}>{isActive ? 'DEACTIVATE' : 'REACTIVATE'}</Text>
          </TouchableOpacity>
        )}
        {isPending && (
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => onApprove(hazard, { title: editTitle, description: editDescription, image_urls: editPhotos })}
          >
            <Text style={styles.actionButtonText}>APPROVE</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={!!previewUri} transparent animationType="fade">
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewUri(null)}
        >
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HazardsScreen() {
  const { viewId } = useLocalSearchParams<{ viewId?: string }>();
  const [pendingHazards, setPendingHazards] = useState<any[]>([]);
  const [declinedHazards, setDeclinedHazards] = useState<any[]>([]);
  const [publishedHazards, setPublishedHazards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<any | null>(null);

  const fetchHazards = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      //pending = awaiting review; declined = admin turned down; published = live on the feed.
      //declined is always fetched (even on mobile, where it's not shown inline) so the
      //"VIEW DECLINED" button and the history page's deep-link-back can find a report by id
      const [pending, declined, published] = await Promise.all([
        getPendingAlerts('hazard').catch(() => []),
        getDeclinedAlerts('hazard').catch(() => []),
        getAlerts('hazard'),
      ]);
      setPendingHazards(pending);
      setDeclinedHazards(declined);
      setPublishedHazards(published);
    } catch {
      Alert.alert('Error', 'Could not load hazard reports.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchHazards(false); //quiet fetch: keep the list visible while refreshing
    setIsRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => { fetchHazards(); }, [])
  );
  //keep the queue fresh while the admin is looking at it, so a new commuter
  //report shows up without them having to pull-to-refresh or leave the tab
  useFocusPolling(() => fetchHazards(false));

  //the Published/Declined history pages deep-link back here with ?viewId=<id>
  //to reuse this screen's own detail view (edit/approve/remove) instead of
  //duplicating it; wait for the matching report to show up, then open it once
  const viewHandledRef = useRef(false);
  useEffect(() => {
    if (!viewId || viewHandledRef.current) return;
    const found = [...pendingHazards, ...declinedHazards, ...publishedHazards]
      .find(h => String(h.id) === String(viewId));
    if (found) {
      viewHandledRef.current = true;
      setSelectedHazard(found);
    }
  }, [viewId, pendingHazards, declinedHazards, publishedHazards]);

  const handleDecline = (hazard: any) => {
    const isDeclined = hazard.status === 'declined';
    const isPublished = hazard.status === 'published';
    const title = isDeclined ? 'Delete Permanently' : isPublished ? 'Remove Hazard' : 'Decline Report';
    const message = isDeclined
      ? `Permanently delete "${hazard.title}" from the declined list? This cannot be undone.`
      : isPublished
      ? `Remove "${hazard.title}" from the feed? This cannot be undone.`
      : `Decline "${hazard.title}"? It will be kept in the Declined list, not deleted.`;
    const confirmLabel = isDeclined ? 'Delete' : isPublished ? 'Remove' : 'Decline';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlert(hazard.id);
            setSelectedHazard(null);
            fetchHazards();
          } catch {
            Alert.alert('Error', 'Could not update this report. Check your connection.');
          }
        },
      },
    ]);
  };

  //deactivate = the hazard is over: hide it from the map/lots but keep it in
  //the published history; reactivate = it's back, show it again
  const handleSetActive = (hazard: any, active: boolean) => {
    const title = active ? 'Reactivate Hazard' : 'Deactivate Hazard';
    const message = active
      ? `Show "${hazard.title}" on the map and lots again until it's deactivated?`
      : `Mark "${hazard.title}" as over? It will disappear from the map and lots but stay in the published history.`;
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: active ? 'Reactivate' : 'Deactivate',
        onPress: async () => {
          try {
            const updated = await setHazardActive(hazard.id, active);
            setSelectedHazard(updated);
            fetchHazards(false);
          } catch {
            Alert.alert('Error', 'Could not update this hazard. Check your connection.');
          }
        },
      },
    ]);
  };

  const handleApprove = async (hazard: any, edits: { title: string; description: string }) => {
    try {
      await approveAlert(hazard.id, edits);
      setSelectedHazard(null);
      fetchHazards();
      Alert.alert('Published', 'The report is now live for commuters.');
    } catch {
      Alert.alert('Error', 'Could not publish this report. Check your connection.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <Tabs.Screen
        options={{ tabBarBadge: pendingHazards.length > 0 ? pendingHazards.length : undefined }}
      />

      {selectedHazard ? (
        <HazardDetail
          hazard={selectedHazard}
          isPending={selectedHazard.status === 'pending'}
          onBack={() => setSelectedHazard(null)}
          onDecline={handleDecline}
          onApprove={handleApprove}
          onSetActive={handleSetActive}
        />
      ) : (
        <>
          {IS_WEB ? (
            <View style={styles.webScreen}>
              <Text style={styles.screenTitle}>Hazard Reports</Text>
              <Text style={styles.screenSubtitle}>Review commuter-submitted hazard alerts</Text>

              {isLoading ? (
                <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
              ) : (
                <View style={styles.webColumnsRow}>
                  <HazardColumn
                    title="PENDING REVIEW"
                    accentColor="#E74C3C"
                    hazards={pendingHazards}
                    isNew
                    onPress={setSelectedHazard}
                    emptyText="No pending reports."
                  />
                  <HazardColumn
                    title="DECLINED"
                    accentColor="#999"
                    hazards={declinedHazards}
                    isNew={false}
                    onPress={setSelectedHazard}
                    emptyText="No declined reports."
                  />
                  <HazardColumn
                    title="PUBLISHED"
                    accentColor="#00853E"
                    hazards={publishedHazards}
                    isNew={false}
                    onPress={setSelectedHazard}
                    emptyText="No published hazards."
                  />
                </View>
              )}
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listScroll}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00853E" />}
            >
              <Text style={styles.screenTitle}>Hazard Reports</Text>
              <Text style={styles.screenSubtitle}>Review commuter-submitted hazard alerts</Text>

              {isLoading ? (
                <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
              ) : (
                <>
                  {pendingHazards.length > 0 ? (
                    <>
                      <Text style={styles.sectionLabel}>PENDING REVIEW</Text>
                      {pendingHazards.map(h => (
                        <HazardCard
                          key={h.id}
                          hazard={h}
                          isNew
                          onPress={() => setSelectedHazard(h)}
                        />
                      ))}
                    </>
                  ) : (
                    <Text style={styles.emptyText}>No pending reports right now.</Text>
                  )}

                  {publishedHazards.length > 0 && (
                    <TouchableOpacity
                      style={styles.historyLinkButton}
                      onPress={() => router.push({ pathname: '/(admin)/hazard-history', params: { status: 'published' } })}
                    >
                      <Ionicons name="checkmark-circle-outline" size={20} color="#00853E" />
                      <Text style={styles.historyLinkText}>VIEW PUBLISHED HAZARDS</Text>
                      <Ionicons name="chevron-forward" size={18} color="#999" />
                    </TouchableOpacity>
                  )}

                  {declinedHazards.length > 0 && (
                    <TouchableOpacity
                      style={styles.historyLinkButton}
                      onPress={() => router.push({ pathname: '/(admin)/hazard-history', params: { status: 'declined' } })}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#999" />
                      <Text style={styles.historyLinkText}>VIEW DECLINED HAZARDS</Text>
                      <Ionicons name="chevron-forward" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.fab}
            onPress={() => router.push('/(admin)/post-alert')}
            accessibilityLabel="Post Alert"
          >
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.fabText}>Add Alert</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  lotMap: { height: 190, borderRadius: 10, marginTop: 10, overflow: 'hidden' },
  cardLot: { fontSize: 12, color: '#00853E', fontWeight: '600', marginTop: 2 },
  editableField: {
    borderWidth: 1,
    borderColor: '#00853E',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // List
  listScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  screenTitle: { fontSize: 26, fontWeight: 'bold', color: '#00853E', marginBottom: 4 },
  screenSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  historyLinkButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyLinkText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#333', letterSpacing: 0.5 },

  // Web: three-column Pending/Declined/Published layout, each box bounded to
  // the screen with its own internal scroll instead of growing the whole page
  webScreen: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  webColumnsRow: { flex: 1, flexDirection: 'row', gap: 20 },
  webColumn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  webColumnTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  webColumnScroll: { flex: 1 },
  webColumnScrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#E74C3C',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  olderLabel: { color: '#999' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  cardOlder: { opacity: 0.65 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#E74C3C',
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#f5f5f5',
  },
  badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a1a', marginBottom: 2 },
  cardTime: { fontSize: 12, color: '#555', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  clickDetails: { fontSize: 10, color: '#999', fontStyle: 'italic', fontWeight: 'bold' },
  olderText: { color: '#999' },
  emptyText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#00853E',
    minWidth: 140,
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Detail
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#00853E', fontSize: 16, fontWeight: '600' },
  detailTitle: { fontSize: 28, fontWeight: '900', color: '#1a1a1a', marginBottom: 4 },
  detailTime: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  locationLabel: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginBottom: 14 },
  locationValue: { fontWeight: '400', textTransform: 'none', color: '#333' },
  mapPlaceholder: {
    height: 160,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: { fontSize: 13, color: '#aaa', fontWeight: '600', marginTop: 8 },
  mapPlaceholderSub: { fontSize: 11, color: '#bbb', marginTop: 4 },
  studentCount: { fontSize: 14, fontWeight: '700', color: '#333', textTransform: 'uppercase', marginBottom: 4 },
  reporterEmails: { fontSize: 12, color: '#777', marginBottom: 16 },
  pictureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoEditWrap: { position: 'relative' },
  photoRemoveBadge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#C0392B', borderRadius: 11, width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  addPhotoTile: {
    width: 110, height: 110, borderRadius: 8,
    borderWidth: 2, borderColor: '#00853E', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EE',
  },
  addPhotoText: { fontSize: 11, fontWeight: '800', color: '#00853E', letterSpacing: 1 },
  pictureThumb: { width: 110, height: 110, borderRadius: 8, backgroundColor: '#e8e8e8' },
  picturePlaceholder: {
    height: 100,
    backgroundColor: '#e8e8e8',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pictureLabel: { fontSize: 11, color: '#999', fontWeight: '700', textAlign: 'center', marginTop: 8 },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: { width: '100%', height: '80%' },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#00853E',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  deactivateButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  activeTag: { fontSize: 11, color: '#00853E', fontWeight: '800', marginBottom: 4 },
  activeStatus: { fontSize: 13, color: '#00853E', fontWeight: '800', marginTop: -12, marginBottom: 20 },
  inactiveTag: { color: '#999' },
});
