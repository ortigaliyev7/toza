// Toza sozlamalari, tweb ishchi (worker) tomonida: import yo'q, shuning uchun appManager'lar xavfsiz import qiladi.
// Asosiy oynadan `managers.appUsersManager.setTozaFlags(...)` bilan o'rnatiladi (ishchi qayta ishga tushsa, Toza ularni qayta yuboradi).
export const tozaFlags = {
  /** «O'qildi» belgisini yubormaslik (mahalliy o'qilgan bo'ladi, suhbatdosh ko'rmaydi). Ovozli xabar «tinglandi» belgisi ham. */
  noRead: false,
  /** «Yozmoqda...» holatini yubormaslik. */
  noTyping: false,
  /** Doim «offlayn» ko'rinish (onlayn holatini yubormaslik). */
  noOnline: false,
  /** Hikoyani yashirin ko'rish (ko'rganlar ro'yxatiga tushmaslik). */
  noStoryView: false
};
export type TozaFlags = typeof tozaFlags;
