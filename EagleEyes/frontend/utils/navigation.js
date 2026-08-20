import { Alert, Linking, Platform } from 'react-native';

//a lot has no street address, only its polygon vertices -> navigate to the polygon's center
const getLotCenter = (lot) => {
    //backend already provides the exact center for most lots
    const c = lot?.center;
    if (c && typeof c.latitude === 'number' && typeof c.longitude === 'number') {
        return { latitude: c.latitude, longitude: c.longitude };
    }
    const coords = lot?.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const sum = coords.reduce(
        (acc, c) => ({ latitude: acc.latitude + c.latitude, longitude: acc.longitude + c.longitude }),
        { latitude: 0, longitude: 0 }
    );
    return { latitude: sum.latitude / coords.length, longitude: sum.longitude / coords.length };
};

//GET DIRECTIONS - asks the user which maps app to open, then hands the lot location over
export const openDirections = (lot) => {
    const center = getLotCenter(lot);
    if (!center) {
        Alert.alert("Error", "No location data available for this lot.");
        return;
    }
    const { latitude, longitude } = center;
    const label = encodeURIComponent(lot?.name || 'Parking Lot');

    const buttons = [];
    if (Platform.OS === 'ios') {
        buttons.push({
            text: 'Apple Maps',
            onPress: () => Linking.openURL(`http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`),
        });
    }
    //universal link: opens the Google Maps app if installed, otherwise the browser
    buttons.push({
        text: 'Google Maps',
        onPress: () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`),
    });
    if (Platform.OS === 'android') {
        //geo: URL lets Android show its own chooser with every installed maps app
        buttons.push({
            text: 'Other Apps',
            onPress: () => Linking.openURL(`geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`),
        });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert("Get Directions", `Open directions to ${lot?.name || 'this lot'} in:`, buttons);
};
