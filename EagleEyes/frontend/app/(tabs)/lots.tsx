import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  ScrollView,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLots } from '../../context/LotsContext';
import { useUser } from '../../context/UserContext';
import { openDirections } from '../../utils/navigation';
import { GROUP_EMBLEMS, lotMatchesPermitType, getPremiumParkingLink, dedupePermitLabels, isPerLotPermitCode, normalizePermitPreservingCode, consolidatePermits } from '../../utils/permits';
import { getPermitCardStyle } from '../../utils/permitColors';
import { NAME_TO_CODE } from '../../utils/nightPermitRules';
import { Alert } from '../../utils/webCompat';
type AvailabilityStatus = 'Available' | 'Near Capacity' | 'Full';

// Mobile loads just enough lots to fill the viewport, then appends more as
// the user scrolls toward the bottom. Web instead pages through in fixed
// chunks with Prev/Next controls.
// Same amber as the "Near Capacity" occupancy color elsewhere in the app —
// reused here for "you're previewing, not looking at live data".
const PREVIEW_AMBER = '#F39C12';
const PREVIEW_AMBER_DARK = '#D68910';

const LOAD_MORE_BATCH = 10; // Lots appended per scroll-triggered load (mobile)
const PAGE_SIZE = 12; // Lots per page (web)
const ESTIMATED_HEADER_HEIGHT = 190; // live status bar + search/filter header
const ESTIMATED_CARD_ROW_HEIGHT = 86; // single-column card height + row gap
const ESTIMATED_GRID_CARD_HEIGHT = 118; // stacked grid tile height + row gap
const PINNED_SECTION_HEADER_HEIGHT = 40; // "Pinned" label + padding
const PINNED_GRID_CARD_WIDTH = 240; // fixed width for pinned tiles in grid mode

// A wide web viewport gets a multi-column card grid instead of one full-width
// row per lot, so a laptop screen isn't mostly empty space either side.
const GRID_BREAKPOINTS: { minWidth: number; columns: number }[] = [
  { minWidth: 1400, columns: 4 },
  { minWidth: 1000, columns: 3 },
  { minWidth: 700, columns: 2 },
];
function getNumColumns(width: number): number {
  if (Platform.OS !== 'web') return 1;
  const match = GRID_BREAKPOINTS.find((bp) => width >= bp.minWidth);
  return match ? match.columns : 1;
}

// Pin a lot on web with a tap on its pin icon; on native, long-press the
// card since there's no room for a persistent icon in the list row.
// Exported so logout can clear it — pins aren't tied to an account server-side,
// so without this a new login on the same device would inherit the old one's pins.
export const PINNED_LOTS_STORAGE_KEY = 'pinnedLotIds';
const PIN_HINT_SEEN_KEY = 'hasSeenPinHint';
// Kept distinct from STATUS_COLOR so a pinned+Full lot doesn't read as one signal.
const PIN_COLOR = '#2F6FED';


const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  'Available': '#00853E',
  'Near Capacity': '#F5A623',
  'Full': '#D0021B',
};

const PERMIT_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'A':    { bg: '#D4C8A8', text: '#5C4A1E' },
  'B':    { bg: '#B8CBE8', text: '#1E3A6A' },
  'C':    { bg: '#B8E0C8', text: '#1A5C30' },
  'E':    { bg: '#EEE0A0', text: '#7A6200' },
  'F/S':  { bg: '#B4C4DA', text: '#1E3A5F' },
  'FS':   { bg: '#B4C4DA', text: '#1E3A5F' },
  'G':    { bg: '#E0B8D0', text: '#5F1E4A' },
  'T':    { bg: '#E0D0B4', text: '#5F3A1E' },
  'PP':   { bg: '#F5E6C8', text: '#8B5E00' },
  'A37':  { bg: '#D4C8A8', text: '#5C4A1E' },
  'RR':   { bg: '#C8C0E8', text: '#2E1E6A' },
  'ST':   { bg: '#CFD8DC', text: '#263238' },
  'MC':   { bg: '#D8D8D8', text: '#444' },
  'SV':   { bg: '#C8D8C8', text: '#1A4A1A' },
  'VIS':  { bg: '#E8D0C8', text: '#6A2A1A' },
  'RM':   { bg: '#F5D0B8', text: '#8A4A1E' },
  'R':    { bg: '#F0C8D8', text: '#7A1E4A' },
  'HD':   { bg: '#C8E0F0', text: '#1E5A7A' },
  'EVN':  { bg: '#E0E0F0', text: '#3A3A5A' },
  'NHT':  { bg: '#C8C8E0', text: '#2A2A5A' },
  'BV':   { bg: '#D8C8E8', text: '#4A1E6A' },
  'UCG':  { bg: '#D4C8B0', text: '#5C4020' },
  'HSG':  { bg: '#C8D4C8', text: '#2A4A2A' },
};

const PERMIT_ABBREVIATIONS: Record<string, string> = {
  'Premium Parking': 'PP',
  'Motorcycle':      'MC',
  'Faculty/Staff':   'F/S',
  'Visitor':         'VIS',
  'General':         'GEN',
  'Economy':         'E',
  'Student':         'STU',
  'Service Vehicle': 'SV',
};

function abbreviatePermit(permit: string): string {
  // Emblems for the lots listed in "Lots to be changed" (A-Reserved -> A, Resident Reserved -> RR, Street Parking -> ST)
  if (GROUP_EMBLEMS[permit]) return GROUP_EMBLEMS[permit];
  // UNT's own permit chart codes (E, FS, RM, ...) — preferred over abbreviating
  // the name ourselves, so badges read the way the official chart does.
  if (NAME_TO_CODE[permit]) return NAME_TO_CODE[permit];
  if (PERMIT_ABBREVIATIONS[permit]) return PERMIT_ABBREVIATIONS[permit];
  // Strip parenthetical suffix: "PP(Visitor)" → "PP", "Premium Parking (V)" → "Premium Parking"
  const stripped = permit.replace(/\s*\(.*$/, '').trim();
  if (stripped && PERMIT_ABBREVIATIONS[stripped]) return PERMIT_ABBREVIATIONS[stripped];
  const base = stripped || permit;
  if (base.length <= 4) return base;
  const words = base.split(/[\s/]+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  return base.slice(0, 3).toUpperCase();
}

function getPermitBadgeInfo(permitList: string[], lotName?: string) {
  if (!permitList || permitList.length === 0) {
    // Try to extract a hint from the lot name (e.g. "Lot 13 - SV" → "SV")
    const namePart = lotName?.match(/[-–]\s*([A-Z0-9/]{1,6})\s*$/i)?.[1]?.toUpperCase();
    if (namePart) {
      const colors = PERMIT_BADGE_COLORS[namePart] || { bg: '#D8D8D8', text: '#555' };
      return { label: namePart, ...colors };
    }
    // ParkZen hasn't assigned this lot a permit type at all (e.g. Lot 97) —
    // fall back to the lot number itself ("Lot 97" -> "L97") instead of a
    // bare "?", so the badge still identifies the lot.
    const lotNumber = lotName?.match(/lot\s*#?\s*(\d+)/i)?.[1];
    if (lotNumber) {
      return { label: `L${lotNumber}`, bg: '#E0E0E0', text: '#666' };
    }
    return { label: '?', bg: '#E0E0E0', text: '#666' };
  }
  const raw = permitList[0].trim();
  // A numbered A-Reserved/Resident-Reserved lot's own permitList now leads
  // with its raw specific code (e.g. "Lot 16 Resident Reserve") instead of
  // the generic bucket name — shorten it the same way the detail view does
  // ("RR16") instead of falling through to abbreviatePermit's generic
  // initials logic, which would otherwise mangle it.
  const label = isPerLotPermitCode(raw) ? normalizePermitPreservingCode(raw) : abbreviatePermit(raw);
  // Same color source as the Profile permit card and lot details sheet, so a
  // given permit reads as the same color everywhere in the app. "border"
  // only comes through for near-white fills (e.g. Evening) so the badge
  // doesn't disappear against this card's own white background.
  const { bg, text, border } = getPermitCardStyle(raw);
  return { label, bg, text, border };
}

function LotCard({
  lot,
  isPinned,
  layout = 'row',
  onPress,
  onTogglePin,
}: {
  lot: any;
  isPinned: boolean;
  layout?: 'row' | 'grid';
  onPress: (lot: any) => void;
  onTogglePin: (lot: any) => void;
}) {
  const dotColor = STATUS_COLOR[lot.status as AvailabilityStatus] || STATUS_COLOR['Available'];
  const badge = getPermitBadgeInfo(lot.permitList || [], lot.name);
  const displayPercent = typeof lot.percentEmpty === 'number' ? `${lot.percentEmpty}% Empty` : 'Live';
  const isGrid = layout === 'grid';

  const handleLongPress = () => {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTogglePin(lot);
  };

  const handlePinPress = (event: any) => {
    event?.stopPropagation?.();
    onTogglePin(lot);
  };

  const cardAccessibilityLabel = `${lot.name}, ${lot.status}${isPinned ? ', pinned' : ''}`;
  const cardAccessibilityHint =
    Platform.OS === 'web'
      ? 'Opens lot details'
      : 'Double tap to view details. Long-press to pin or unpin this lot.';

  const pinButton =
    Platform.OS === 'web' ? (
      <TouchableOpacity
        onPress={handlePinPress}
        style={[styles.pinIcon, isPinned && styles.pinIconStuck]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={isPinned ? 'Unpin this lot' : 'Pin this lot'}
        accessibilityHint="Pinned lots stay at the top of the list"
      >
        <Ionicons
          name={isPinned ? 'pin' : 'pin-outline'}
          size={20}
          color={isPinned ? PIN_COLOR : '#c2c2c2'}
        />
      </TouchableOpacity>
    ) : null;

  return (
    <View style={[styles.cardWrapper, isGrid && styles.cardWrapperGrid]}>
      <TouchableOpacity
        style={[styles.card, isGrid && styles.cardGrid]}
        onPress={() => onPress(lot)}
        onLongPress={Platform.OS === 'web' ? undefined : handleLongPress}
        delayLongPress={500}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={cardAccessibilityLabel}
        accessibilityHint={cardAccessibilityHint}
      >
      {isGrid ? (
        <>
          <View style={[styles.permitBadge, { backgroundColor: badge.bg }, badge.border && { borderWidth: 1, borderColor: badge.border }]}>
            <Text
              style={[styles.permitBadgeText, { color: badge.text }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {badge.label}
            </Text>
          </View>
          <View style={styles.gridNameRow}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            {lot.name === 'Highland Street Garage' ? (
              <View style={styles.lotNameTag}>
                <Ionicons name="location-outline" size={14} color="#006b32" />
                <Text style={styles.lotNameTagText} numberOfLines={1}>{lot.name}</Text>
              </View>
            ) : (
              <Text style={styles.lotNameGrid} numberOfLines={2}>
                {lot.name}
              </Text>
            )}
          </View>
          <View style={styles.gridBottomRow}>
            <Text style={[styles.statusText, { color: dotColor }]} numberOfLines={1}>
              {lot.status}
            </Text>
            <Text style={[styles.percentText, { color: dotColor }]}>{displayPercent}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.permitBadge, { backgroundColor: badge.bg }, badge.border && { borderWidth: 1, borderColor: badge.border }]}>
            <Text
              style={[styles.permitBadgeText, { color: badge.text }]}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {badge.label}
            </Text>
          </View>
          <View style={styles.cardMiddle}>
            {lot.name === 'Highland Street Garage' ? (
              <View style={styles.lotNameTag}>
                <Ionicons name="location-outline" size={14} color="#006b32" />
                <Text style={styles.lotNameTagText} numberOfLines={1}>{lot.name}</Text>
              </View>
            ) : (
              <Text style={styles.lotName}>{lot.name}</Text>
            )}
            <Text style={[styles.percentText, { color: dotColor }]}>{displayPercent}</Text>
          </View>
          <View style={styles.cardRight}>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              <Text style={[styles.statusText, { color: dotColor }]} numberOfLines={1}>
                {lot.status}
              </Text>
            </View>
          </View>
        </>
      )}
      </TouchableOpacity>
      {pinButton}
    </View>
  );
}

function FilterHeader({
  query,
  onChangeQuery,
  permitFilter,
  availabilityFilter,
  onAllPermits,
  onPermitPress,
  onAvailabilityPress,
  previewingNight,
  isLivePreview,
  onToggleDayNight,
}: {
  query: string;
  onChangeQuery: (text: string) => void;
  permitFilter: string;
  availabilityFilter: string;
  onAllPermits: () => void;
  onPermitPress: () => void;
  onAvailabilityPress: () => void;
  previewingNight: boolean;
  isLivePreview: boolean;
  onToggleDayNight: () => void;
}) {
  const allActive = permitFilter === 'all' && availabilityFilter === 'all';
  const permitActive = permitFilter !== 'all';
  const availabilityActive = availabilityFilter !== 'all';

  return (
    <View style={styles.filterHeader}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={27} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Lot Search"
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={onChangeQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onChangeQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={27} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, allActive && styles.filterBtnActive]}
          onPress={onAllPermits}
        >
          <Text style={[styles.filterBtnText, allActive && styles.filterBtnTextActive]}>
            ALL PERMITS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, permitActive && styles.filterBtnActive]}
          onPress={onPermitPress}
        >
          <Text style={[styles.filterBtnText, permitActive && styles.filterBtnTextActive]}>
            {permitFilter !== 'all' ? permitFilter : 'PERMIT'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={permitActive ? '#fff' : '#555'}
            style={{ marginLeft: 3 }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, availabilityActive && styles.filterBtnActive]}
          onPress={onAvailabilityPress}
        >
          <Text style={[styles.filterBtnText, availabilityActive && styles.filterBtnTextActive]}>
            {availabilityFilter !== 'all' ? availabilityFilter.toUpperCase() : 'AVAILABILITY'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={availabilityActive ? '#fff' : '#555'}
            style={{ marginLeft: 3 }}
          />
        </TouchableOpacity>

        {/* Previews the other time-of-day's permit rules */}
        <TouchableOpacity
          style={[styles.filterBtn, !isLivePreview && styles.filterBtnPreview]}
          onPress={onToggleDayNight}
        >
          <Ionicons
            name={previewingNight ? 'moon' : 'sunny'}
            size={12}
            color={isLivePreview ? '#555' : PREVIEW_AMBER_DARK}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.filterBtnText, !isLivePreview && styles.filterBtnTextPreview]}>
            {previewingNight ? 'NIGHT' : 'DAY'}{isLivePreview ? '' : ' (PREVIEW)'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LotsScreen() {
  const [query, setQuery] = useState('');
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [moreInfoVisible, setMoreInfoVisible] = useState(false);
  const [permitFilter, setPermitFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  // Once the user explicitly touches the permit filter (even choosing "All
  // Permits" again), that choice wins over the "only show my permit type"
  // preference below, instead of silently re-narrowing back to it.
  const [permitManuallySelected, setPermitManuallySelected] = useState(false);
  const [permitPickerVisible, setPermitPickerVisible] = useState(false);
  const [availabilityPickerVisible, setAvailabilityPickerVisible] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [showPinHint, setShowPinHint] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const listRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { lots, isLoading, lastRefreshAt, filterByPermit, previewMode, setPreviewMode, actuallyNight } = useLots();
  // null previewMode = follow the real clock.
  const previewingNight = previewMode === null ? actuallyNight : previewMode === 'night';
  const isLivePreview = previewingNight === actuallyNight;
  const { user } = useUser();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const numColumns = getNumColumns(windowWidth);
  const cardLayout = numColumns > 1 ? 'grid' : 'row';

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PINNED_LOTS_STORAGE_KEY);
        if (stored) setPinnedIds(new Set(JSON.parse(stored)));
      } catch (error) {
        console.error('Error loading pinned lots:', error);
      }
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(PIN_HINT_SEEN_KEY);
        if (!seen) {
          setShowPinHint(true);
          await AsyncStorage.setItem(PIN_HINT_SEEN_KEY, 'true');
        }
      } catch (error) {
        console.error('Error checking pin hint state:', error);
      }
    })();
  }, []);

  const togglePin = (lot: any) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lot.id)) {
        next.delete(lot.id);
      } else {
        next.add(lot.id);
      }
      AsyncStorage.setItem(PINNED_LOTS_STORAGE_KEY, JSON.stringify(Array.from(next))).catch(
        (error) => console.error('Error saving pinned lots:', error)
      );
      return next;
    });
  };

  const cardRowHeight = cardLayout === 'grid' ? ESTIMATED_GRID_CARD_HEIGHT : ESTIMATED_CARD_ROW_HEIGHT;

  // The pinned section sits above the scrollable list and eats into the
  // viewport, so account for its height when estimating a first screenful.
  const pinnedPerRow =
    cardLayout === 'grid' ? Math.max(1, Math.floor(windowWidth / (PINNED_GRID_CARD_WIDTH + 12))) : 1;
  const pinnedRows = pinnedIds.size > 0 ? Math.ceil(pinnedIds.size / pinnedPerRow) : 0;
  const pinnedSectionHeight = pinnedRows > 0 ? PINNED_SECTION_HEADER_HEIGHT + pinnedRows * cardRowHeight : 0;

  // Enough rows (x columns) to fill the viewport, plus a couple extra so the
  // user hits the scroll-triggered load before running out of content.
  const rowsVisible =
    Math.ceil((windowHeight - ESTIMATED_HEADER_HEIGHT - pinnedSectionHeight) / cardRowHeight) + 2;
  const initialVisibleCount = Math.max(LOAD_MORE_BATCH, rowsVisible * numColumns);
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  const refreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Waiting for sync';

  // "Only show my permit type" preference from Profile Setting, applied ahead
  // of the on-screen search/permit/availability filters below — but only until
  // the user explicitly picks a permit themselves, since they should always be
  // able to opt back into seeing every permit.
  const permitTypeLots = useMemo(() => {
    if (!filterByPermit || !user.parkingProfile.permitType || permitManuallySelected) return lots;
    return lots.filter((lot) => lotMatchesPermitType(lot.permitList, user.parkingProfile.permitType, lot.rawPermitList));
  }, [lots, filterByPermit, user.parkingProfile.permitType, permitManuallySelected]);

  // Built from the full, unnarrowed lot list so every permit is always
  // selectable in the picker, even while the default view is narrowed to the
  // user's own permit type. ParkZen lists individual reserved spaces (A01, A02
  // ... A95, "Lot 19 Resident Reserve", ...) as separate permits, so group them
  // so the dropdown shows each permit type once.
  const uniquePermits = useMemo(() => {
    const set = new Set<string>();
    lots.forEach((lot) => {
      consolidatePermits(lot.permitList).forEach((p) => set.add(p.trim()));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [lots]);

  const filtered = useMemo(() => {
    // Split into words so "resident 16" or "16 resident" both find "Lot 16
    // Resident Reserve" — every word has to appear somewhere across name,
    // tag, address and permits, in any order, instead of needing the exact
    // phrase typed out.
    const queryTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    return permitTypeLots.filter((lot) => {
      if (queryTokens.length > 0) {
        const haystack = [
          lot.name,
          lot.tag,
          lot.address,
          lot.permits,
          Array.isArray(lot.permitList) ? lot.permitList.join(' ') : '',
        ].filter(Boolean).join(' ').toLowerCase();

        if (!queryTokens.every((token) => haystack.includes(token))) return false;
      }
      if (permitFilter !== 'all') {
        const hasPermit = consolidatePermits(lot.permitList).some(
          (p) => p.trim() === permitFilter
        );
        if (!hasPermit) return false;
      }
      if (availabilityFilter !== 'all' && lot.status !== availabilityFilter) return false;
      return true;
    });
  }, [permitTypeLots, query, permitFilter, availabilityFilter]);

  // Pinned lots render in their own fixed section above the scrollable list,
  // so they're always visible regardless of scroll position.
  const { pinnedLots, unpinnedLots } = useMemo(() => {
    if (pinnedIds.size === 0) return { pinnedLots: [] as typeof filtered, unpinnedLots: filtered };
    const pinned: typeof filtered = [];
    const rest: typeof filtered = [];
    filtered.forEach((lot) => (pinnedIds.has(lot.id) ? pinned : rest).push(lot));
    return { pinnedLots: pinned, unpinnedLots: rest };
  }, [filtered, pinnedIds]);

  // Mobile: dynamically-growing slice loaded via scroll. Web: fixed-size page.
  const visibleLots = unpinnedLots.slice(0, visibleCount);
  const hasMoreToLoad = visibleCount < unpinnedLots.length;

  const totalPages = Math.max(1, Math.ceil(unpinnedLots.length / PAGE_SIZE));
  const paginatedLots = unpinnedLots.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePageNumbers = useMemo(() => {
    const maxButtons = 5;
    const count = Math.min(totalPages, maxButtons);
    let start = Math.max(1, currentPage - Math.floor(count / 2));
    if (start + count - 1 > totalPages) {
      start = Math.max(1, totalPages - count + 1);
    }
    return Array.from({ length: count }, (_, index) => start + index);
  }, [totalPages, currentPage]);

  const listData = isWeb ? paginatedLots : visibleLots;

  useEffect(() => {
    if (isWeb) {
      setCurrentPage(1);
    } else {
      setVisibleCount(initialVisibleCount);
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, permitFilter, availabilityFilter]);

  useEffect(() => {
    if (isWeb && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, currentPage]);

  const handleLoadMore = () => {
    if (!hasMoreToLoad) return;
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_BATCH, unpinnedLots.length));
  };

  const handlePageChange = (page: number) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(nextPage);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleLotPress = (lot: any) => {
    try {
      setSelectedLot(lot);
      setModalVisible(true);
    } catch (error) {
      console.error('Error opening lot details:', error);
      Alert.alert('Error', 'Failed to open lot details. Please try again.');
    }
  };

  const closeModal = () => {
    setMoreInfoVisible(false);
    setModalVisible(false);
    setSelectedLot(null);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00853E" />
        <Text style={{ marginTop: 12, color: '#666', fontSize: 16 }}>Loading Parking Data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <View style={[styles.liveStatusBar, !isLivePreview && styles.liveStatusBarPreview]}>
        <Ionicons
          name={isLivePreview ? 'time-outline' : (previewingNight ? 'moon' : 'sunny')}
          size={14}
          color={isLivePreview ? '#5d6d7e' : PREVIEW_AMBER_DARK}
        />
        <Text style={[styles.liveStatusText, !isLivePreview && styles.liveStatusTextPreview]}>
          {isLivePreview ? `Last synced: ${refreshLabel}` : `Previewing ${previewingNight ? 'Night' : 'Day'} rules`}
        </Text>
      </View>
      <FilterHeader
        query={query}
        onChangeQuery={setQuery}
        permitFilter={permitFilter}
        availabilityFilter={availabilityFilter}
        onAllPermits={() => { setPermitFilter('all'); setAvailabilityFilter('all'); setPermitManuallySelected(true); }}
        onPermitPress={() => setPermitPickerVisible(true)}
        onAvailabilityPress={() => setAvailabilityPickerVisible(true)}
        previewingNight={previewingNight}
        isLivePreview={isLivePreview}
        onToggleDayNight={() => setPreviewMode(previewingNight ? 'day' : 'night')}
      />
      {showPinHint ? (
        <View style={styles.pinHintBanner}>
          <Ionicons name="pin" size={16} color={PIN_COLOR} />
          <Text style={styles.pinHintText}>Long-press a lot to pin it to the top</Text>
          <TouchableOpacity
            onPress={() => setShowPinHint(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss pin hint"
          >
            <Ionicons name="close" size={16} color="#999" />
          </TouchableOpacity>
        </View>
      ) : null}
      {pinnedLots.length > 0 ? (
        <View style={styles.pinnedSection}>
          <Text style={styles.pinnedSectionTitle}>Pinned</Text>
          <View style={cardLayout === 'grid' ? styles.pinnedGridWrap : undefined}>
            {pinnedLots.map((lot) => (
              <View key={lot.id} style={cardLayout === 'grid' ? styles.pinnedGridCard : undefined}>
                <LotCard
                  lot={lot}
                  isPinned
                  layout={cardLayout}
                  onPress={handleLotPress}
                  onTogglePin={togglePin}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <FlatList
        key={`cols-${numColumns}`}
        ref={listRef}
        data={listData}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LotCard
            lot={item}
            isPinned={false}
            layout={cardLayout}
            onPress={handleLotPress}
            onTogglePin={togglePin}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {filtered.length === 0 ? 'No lots match your search.' : 'All matching lots are pinned above.'}
          </Text>
        }
        ListFooterComponent={
          filtered.length === 0 ? null : isWeb ? (
            unpinnedLots.length > 0 ? (
              <View style={styles.paginationContainer}>
                <Text style={styles.paginationSummary}>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                  {Math.min(currentPage * PAGE_SIZE, unpinnedLots.length)} of {unpinnedLots.length} lots
                </Text>

                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                    onPress={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={currentPage === 1 ? '#aaa' : '#00853E'}
                    />
                    <Text
                      style={[styles.pageButtonText, currentPage === 1 && styles.pageButtonTextDisabled]}
                    >
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.pageNumbers}>
                    {visiblePageNumbers.map((page) => (
                      <TouchableOpacity
                        key={page}
                        style={[
                          styles.pageNumberButton,
                          page === currentPage && styles.pageNumberButtonActive,
                        ]}
                        onPress={() => handlePageChange(page)}
                      >
                        <Text
                          style={[
                            styles.pageNumberText,
                            page === currentPage && styles.pageNumberTextActive,
                          ]}
                        >
                          {page}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.pageButton,
                      currentPage === totalPages && styles.pageButtonDisabled,
                    ]}
                    onPress={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <Text
                      style={[
                        styles.pageButtonText,
                        currentPage === totalPages && styles.pageButtonTextDisabled,
                      ]}
                    >
                      Next
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={currentPage === totalPages ? '#aaa' : '#00853E'}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.pageIndicator}>
                  Page {currentPage} of {totalPages}
                </Text>
              </View>
            ) : null
          ) : (
            <View style={styles.paginationContainer}>
              {hasMoreToLoad ? (
                <>
                  <ActivityIndicator size="small" color="#00853E" />
                  <Text style={styles.paginationSummary}>
                    Showing {pinnedLots.length + visibleLots.length} of {filtered.length} lots
                  </Text>
                </>
              ) : (
                <Text style={styles.paginationEndText}>
                  You&apos;ve reached the end — {filtered.length} lot{filtered.length === 1 ? '' : 's'} total
                </Text>
              )}
            </View>
          )
        }
        onEndReached={isWeb ? undefined : handleLoadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
      />

      {/* Permit Picker Modal */}
      <Modal transparent animationType="fade" visible={permitPickerVisible} onRequestClose={() => setPermitPickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPermitPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Filter by Permit</Text>
            <TouchableOpacity style={styles.pickerOption} onPress={() => { setPermitFilter('all'); setPermitManuallySelected(true); setPermitPickerVisible(false); }}>
              <Text style={[styles.pickerOptionText, permitFilter === 'all' && styles.pickerOptionActive]}>All Permits</Text>
              {permitFilter === 'all' && <Ionicons name="checkmark" size={27} color="#00853E" />}
            </TouchableOpacity>
            <ScrollView style={{ maxHeight: windowHeight * 0.6 }}>
              {uniquePermits.map((p) => (
                <TouchableOpacity key={p} style={styles.pickerOption} onPress={() => { setPermitFilter(p); setPermitManuallySelected(true); setPermitPickerVisible(false); }}>
                  <Text style={[styles.pickerOptionText, permitFilter === p && styles.pickerOptionActive]}>{p}</Text>
                  {permitFilter === p && <Ionicons name="checkmark" size={27} color="#00853E" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Availability Picker Modal */}
      <Modal transparent animationType="fade" visible={availabilityPickerVisible} onRequestClose={() => setAvailabilityPickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setAvailabilityPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Filter by Availability</Text>
            {(['all', 'Available', 'Near Capacity', 'Full'] as const).map((opt) => (
              <TouchableOpacity key={opt} style={styles.pickerOption} onPress={() => { setAvailabilityFilter(opt); setAvailabilityPickerVisible(false); }}>
                <Text style={[styles.pickerOptionText, availabilityFilter === opt && styles.pickerOptionActive]}>
                  {opt === 'all' ? 'All' : opt}
                </Text>
                {availabilityFilter === opt && <Ionicons name="checkmark" size={27} color="#00853E" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lot Details Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <TouchableOpacity onPress={closeModal} style={{ padding: 10 }}>
              <Ionicons name="chevron-back" size={27} color="#00853E" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Lot Details</Text>
            <View style={{ width: 48 }} />
          </View>

          {selectedLot ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLotName}>{selectedLot.name}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[
                    styles.statusBadgeDetail,
                    { backgroundColor: (STATUS_COLOR[selectedLot.status as AvailabilityStatus] || STATUS_COLOR['Available']) + '1A' }
                  ]}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLOR[selectedLot.status as AvailabilityStatus] || STATUS_COLOR['Available'] }
                    ]} />
                    <Text style={[
                      styles.statusText,
                      { color: STATUS_COLOR[selectedLot.status as AvailabilityStatus] || STATUS_COLOR['Available'] }
                    ]}>
                      {selectedLot.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Available Occupancy:</Text>
                  <Text style={styles.detailValue}>
                    {typeof selectedLot.percentEmpty === 'number' ? `${selectedLot.percentEmpty}%` : 'Unknown'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ParkZen capture time:</Text>
                  <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
                    {selectedLot.sourceTimestampProvidedByParkzen === true && selectedLot.lastUpdatedAt
                      ? new Date(selectedLot.lastUpdatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                      : 'No time available'}
                  </Text>
                </View>
              </View>

              {getPremiumParkingLink(selectedLot.name, selectedLot.permitList, selectedLot.coordinates) && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#D6332A', marginBottom: 12 }]}
                  onPress={() => Linking.openURL(getPremiumParkingLink(selectedLot.name, selectedLot.permitList, selectedLot.coordinates)!)}
                >
                  <Text style={styles.actionButtonText}>Premium Parking</Text>
                  <Ionicons name="open-outline" size={27} color="#fff" />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.actionButton} onPress={() => openDirections(selectedLot)}>
                <Ionicons name="navigate" size={27} color="#fff" />
                <Text style={styles.actionButtonText}>Get Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#f0f0f0', marginTop: 12 }]}
                onPress={() => setMoreInfoVisible(!moreInfoVisible)}
              >
                <Ionicons name={moreInfoVisible ? "chevron-up-circle-outline" : "information-circle-outline"} size={27} color="#00853E" />
                <Text style={[styles.actionButtonText, { color: '#00853E' }]}>More Info</Text>
              </TouchableOpacity>

              {moreInfoVisible && (
                <View style={[styles.detailCard, { marginTop: 12 }]}>
                  {selectedLot.address ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Address:</Text>
                      <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{selectedLot.address}</Text>
                    </View>
                  ) : null}
                  {selectedLot.capacity ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Capacity:</Text>
                      <Text style={styles.detailValue}>{selectedLot.capacity} spaces</Text>
                    </View>
                  ) : null}
                  {(selectedLot.permitList || []).length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.detailLabel}>Permits:</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {dedupePermitLabels(selectedLot.permitList).map((label, i) => {
                          const permitStyle = getPermitCardStyle(label);
                          return (
                            <View
                              key={i}
                              style={{
                                backgroundColor: permitStyle.bg,
                                borderRadius: 12,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                overflow: 'hidden',
                                ...(permitStyle.border ? { borderWidth: 1, borderColor: permitStyle.border } : null),
                              }}
                            >
                              <Text style={{ fontSize: 12, color: permitStyle.text, fontWeight: '500' }}>{label}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9f9f9', // Matches the app's overall background so white cards stand out
  },

  // Fixed above the scrollable list so pinned lots stay visible while
  // scrolling through the rest.
  pinnedSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pinnedSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Web grid mode: pinned tiles wrap left-to-right instead of stacking.
  pinnedGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pinnedGridCard: {
    width: PINNED_GRID_CARD_WIDTH,
  },
  columnWrapper: {
    gap: 12,
  },

  liveStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  // Previewing a time-of-day other than right now — the sync timestamp
  // doesn't apply, so swap it for a note instead of implying stale data.
  liveStatusBarPreview: {
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderBottomColor: PREVIEW_AMBER,
  },
  liveStatusText: {
    fontSize: 12,
    color: '#5d6d7e',
    fontWeight: '500',
  },
  liveStatusTextPreview: {
    color: PREVIEW_AMBER_DARK,
  },

  // --- FILTER HEADER ---
  filterHeader: {
    backgroundColor: '#fff',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', 
    marginBottom: 8,
    // Added elevation to match the Map Screen's floating effect
    zIndex: 10,
    elevation: 4, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: '#f2f4f3',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },
  clearButton: {
    padding: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e0e0e0', // Slightly lighter border for inactive pills
    backgroundColor: '#fff',
  },
  filterBtnActive: {
    backgroundColor: '#00853E',
    borderColor: '#00853E',
  },
  // Previewing a time-of-day other than right now.
  filterBtnPreview: {
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderColor: PREVIEW_AMBER,
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555',
    letterSpacing: 0.3,
  },
  filterBtnTextPreview: {
    color: PREVIEW_AMBER_DARK,
  },
  filterBtnTextActive: {
    color: '#fff',
  },

  // --- PIN HINT BANNER ---
  pinHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EAF1FF',
  },
  pinHintText: {
    flex: 1,
    fontSize: 12,
    color: '#2F4F7A',
    fontWeight: '500',
  },

  // --- LIST CONTENT ---
  listContent: {
    paddingHorizontal: 16, // Matched Map Screen horizontal padding
    paddingTop: 14, // Room for the pin icon poking above the first row's cards
    paddingBottom: 24,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 15,
  },
  // --- PAGINATION (web: numbered pages, mobile: infinite scroll footer) ---
paginationContainer: {
  alignItems: 'center',
  paddingTop: 10,
  paddingBottom: 20,
  gap: 6,
},

paginationSummary: {
  fontSize: 12,
  color: '#777',
  fontWeight: '500',
},

paginationEndText: {
  fontSize: 12,
  color: '#999',
  fontWeight: '600',
  letterSpacing: 0.2,
},

paginationRow: {
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
},

pageButton: {
  minHeight: 36,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#d8e8df',
  backgroundColor: '#fff',
},

pageButtonText: {
  fontSize: 14,
  color: '#00853E',
  fontWeight: '600',
},

pageButtonDisabled: {
  borderColor: '#e0e0e0',
  backgroundColor: '#f8f8f8',
},

pageButtonTextDisabled: {
  color: '#aaa',
},

pageNumbers: {
  flex: 1,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 6,
},

pageNumberButton: {
  minWidth: 32,
  height: 32,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#d8e8df',
  backgroundColor: '#fff',
},

pageNumberButtonActive: {
  backgroundColor: '#00853E',
  borderColor: '#00853E',
},

pageNumberText: {
  fontSize: 14,
  color: '#00853E',
  fontWeight: '600',
},

pageNumberTextActive: {
  color: '#fff',
},

pageIndicator: {
  fontSize: 12,
  color: '#777',
  marginTop: 4,
},

  // --- LOT CARD ---
  // Wraps the card's TouchableOpacity so the pin button (also a button on
  // web) is a sibling rather than a DOM descendant — nested <button> tags
  // are invalid HTML and break hydration on web.
  cardWrapper: {
    position: 'relative',
  },
  cardWrapperGrid: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, // Slightly more pronounced shadow
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  // Web grid mode: a stacked tile instead of a full-width row, so multiple
  // cards fit side by side on a wide screen.
  cardGrid: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  gridNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // marginTop: 'auto' pins this to the card's bottom edge even when other
  // cards in the same row have a taller (2-line) name above it.
  gridBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  lotNameGrid: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  // Pokes above the card's top edge, like a pin stuck through a paper on a board.
  pinIcon: {
    position: 'absolute',
    top: -10,
    left: 16,
    zIndex: 3,
  },
  pinIconStuck: {
    transform: [{ rotate: '-18deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  permitBadge: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  permitBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardMiddle: {
    flex: 1,
    paddingRight: 10,
    gap: 3,
  },
  lotName: {
    fontSize: 16,
    fontWeight: '700', // Made slightly bolder
    color: '#1a1a1a',
  },
  lotNameTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    backgroundColor: '#E6F4EC',
    borderColor: '#A8D5B8',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    gap: 4,
  },
  lotNameTagText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#006b32',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardRight: {
    // No fixed width: "Near Capacity" needs to render on one line, so this
    // shrink-wraps to whatever the status text needs instead of clipping it.
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 2,
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'left',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // --- PICKER MODAL ---
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, // Slightly rounder top edges
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40, // Extra bottom padding for newer iPhones
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  pickerOptionActive: {
    color: '#00853E',
    fontWeight: '700',
  },

  // --- LOT DETAILS MODAL ---
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9', // Matched to overall app background
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Matched borders
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  detailLotName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#00853E',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statusBadgeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  actionButton: {
    backgroundColor: '#00853E',
    borderRadius: 12, // Slightly rounder buttons
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});