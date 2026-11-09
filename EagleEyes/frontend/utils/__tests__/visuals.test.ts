import { getPermitCardStyle, PERMIT_CARD_STYLES, DEFAULT_PERMIT_CARD_STYLE } from '../permitColors';
import { getAlertVisual, getEventVisual, getHazardVisual, getCategoryLabel } from '../alertVisuals';

describe('getPermitCardStyle', () => {
  it('uses the shared color for a permit and its raw codes', () => {
    expect(getPermitCardStyle('Eagle')).toBe(PERMIT_CARD_STYLES['Eagle']);
    expect(getPermitCardStyle('F/S')).toBe(PERMIT_CARD_STYLES['Faculty and Staff']);
    expect(getPermitCardStyle('A24')).toBe(PERMIT_CARD_STYLES['A-Reserved']);
  });

  it('falls back to the default style for unknown permits', () => {
    expect(getPermitCardStyle('Something New')).toBe(DEFAULT_PERMIT_CARD_STYLE);
    expect(getPermitCardStyle('')).toBe(DEFAULT_PERMIT_CARD_STYLE);
  });
});

describe('alert visuals', () => {
  it('looks up categories case-insensitively, with defaults', () => {
    expect(getHazardVisual('SNOW')).toBe(getHazardVisual('snow'));
    expect(getHazardVisual('pothole')).toBe(getHazardVisual(null));
    expect(getEventVisual('Closure')).toBe(getEventVisual('Lot Closure'));
  });

  it('picks the hazard or event set by alert type', () => {
    expect(getAlertVisual('event', 'Gameday')).toBe(getEventVisual('Gameday'));
    expect(getAlertVisual('hazard', 'flood')).toBe(getHazardVisual('flood'));
  });
});

describe('getCategoryLabel', () => {
  it('maps stored hazard categories to their labels', () => {
    expect(getCategoryLabel('hazard', 'traffic jam')).toBe('Traffic Jam');
  });

  it('capitalizes custom "Other" hazard types', () => {
    expect(getCategoryLabel('hazard', 'pothole')).toBe('Pothole');
  });

  it('shows event categories as stored, with generic fallbacks', () => {
    expect(getCategoryLabel('event', 'Gameday')).toBe('Gameday');
    expect(getCategoryLabel('event', null)).toBe('Event');
    expect(getCategoryLabel('hazard', undefined)).toBe('Hazard');
  });
});
