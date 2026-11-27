// Toza qo'shimchalarini alohida yoqish/o'chirish (localStorage `toza_features`). Hammasi standart bo'yicha yoqilgan.
// O'chirilganda qo'shimcha keyingi safar umuman ulanmaydi, ochiq turgani esa darrov olib tashlanadi.
export type Feature = 'player' | 'selbar' | 'roundcam' | 'holdrec' | 'tabbar' | 'calladapt' | 'callaudio' | 'callinfo' | 'acckeys';
const LS = 'toza_features';
export const FEATURES_EVENT = 'toza-features';
const read = (): Partial<Record<Feature, boolean>> => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch{ return {}; } };
export const featureOn = (k: Feature) => read()[k] !== false;
export function setFeature(k: Feature, on: boolean) {
  try { localStorage.setItem(LS, JSON.stringify({...read(), [k]: on})); } catch{ /* xotira yopiq */ }
  window.dispatchEvent(new CustomEvent(FEATURES_EVENT, {detail: {k, on}}));
}
