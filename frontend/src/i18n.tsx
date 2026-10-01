import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'en' | 'ar'

const en = {
  'app.title': 'ELD Trip Planner',
  'app.subtitle': 'HOS-compliant routes and daily logs for property-carrying drivers',
  'app.switchLanguage': 'العربية',
  'app.darkMode': 'Switch to dark mode',
  'app.lightMode': 'Switch to light mode',

  'form.title': 'Trip details',
  'form.example': 'Try an example',
  'form.current': 'Current location',
  'form.pickup': 'Pickup location',
  'form.dropoff': 'Dropoff location',
  'form.placeholder': 'City or address',
  'form.found': 'Location found',
  'form.cycle': 'Current cycle used (hrs)',
  'form.cycleLeft': '{hours} of 70 hours left in the 8-day cycle',
  'form.start': 'Start time',
  'form.startHint': 'Home terminal time. The driver starts fully rested.',
  'form.details': 'Log sheet details (optional)',
  'form.driver': 'Driver name',
  'form.carrier': 'Carrier name',
  'form.office': 'Main office address',
  'form.vehicle': 'Truck / trailer numbers',
  'form.shipment': 'Shipping document or commodity',
  'form.submit': 'Plan trip',
  'form.loading': 'Planning trip…',
  'form.assume1': 'Property-carrying driver, 70 hrs / 8 days',
  'form.assume2': 'Fuel at least every 1,000 miles',
  'form.assume3': '1 hour each for pickup and drop-off',

  'map.emptyTitle': 'Enter a trip to see the route',
  'map.emptyText': 'You get the route with every required stop, and a filled-out log sheet for each day.',
  'map.loading': 'Calculating route and hours of service…',
  'map.mile': 'mile {n}',
  'map.driving': '{time} driving',
  'leg.0': 'To pickup',
  'leg.1': 'To drop-off',

  'stop.start': 'Start',
  'stop.pretrip': 'Pre-trip inspection',
  'stop.pickup': 'Pickup',
  'stop.dropoff': 'Drop-off',
  'stop.fuel': 'Fuel stop',
  'stop.break': '30-minute break',
  'stop.rest': '10-hour rest',
  'stop.restart': '34-hour restart',
  'stop.drive': 'Drive {miles}',

  'status.off_duty': 'Off duty',
  'status.sleeper': 'Sleeper berth',
  'status.driving': 'Driving',
  'status.on_duty': 'On duty (not driving)',

  'summary.label': 'Trip summary',
  'summary.distance': 'Total distance',
  'summary.driving': 'Driving time',
  'summary.doorToDoor': '{time} door to door',
  'summary.arrival': 'Arrival',
  'summary.arrivalSub': '{time}, drop-off complete',
  'summary.sheets': 'Log sheets',
  'summary.day': '{n} day',
  'summary.days': '{n} days',
  'summary.noStops': 'No rest stops needed',
  'summary.cycle': 'Cycle after trip',
  'summary.count.rest': '{n} × 10-hr rest',
  'summary.count.fuel': '{n} × fuel',
  'summary.count.break': '{n} × 30-min break',
  'summary.count.restart': '{n} × 34-hr restart',

  'schedule.title': 'Trip schedule',
  'schedule.subtitle': 'Stops and rests required by the hours-of-service rules',

  'logs.title': 'Daily log sheets',
  'logs.print': 'Print all {n} sheets',
  'logs.day': 'Day {n}',
  'logs.tabs': 'Log sheet day',

  'unit.miles': '{n} mi',
  'unit.h': 'h',
  'unit.m': 'm',

  'error.network': 'Cannot reach the server. Check your connection and try again.',
  'error.unknown': 'Something went wrong. Please try again.',
}

type Key = keyof typeof en

const ar: Record<Key, string> = {
  'app.title': 'مخطط رحلات ELD',
  'app.subtitle': 'مسارات وسجلات يومية متوافقة مع ساعات الخدمة لسائقي شاحنات البضائع',
  'app.switchLanguage': 'English',
  'app.darkMode': 'التبديل إلى الوضع الداكن',
  'app.lightMode': 'التبديل إلى الوضع الفاتح',

  'form.title': 'تفاصيل الرحلة',
  'form.example': 'جرّب مثالاً',
  'form.current': 'الموقع الحالي',
  'form.pickup': 'موقع الاستلام',
  'form.dropoff': 'موقع التسليم',
  'form.placeholder': 'مدينة أو عنوان',
  'form.found': 'تم العثور على الموقع',
  'form.cycle': 'الساعات المستخدمة من الدورة',
  'form.cycleLeft': 'بقي {hours} من 70 ساعة في دورة الـ 8 أيام',
  'form.start': 'وقت البدء',
  'form.startHint': 'بتوقيت المحطة الرئيسية. يبدأ السائق بعد راحة كاملة.',
  'form.details': 'بيانات ورقة السجل (اختياري)',
  'form.driver': 'اسم السائق',
  'form.carrier': 'اسم شركة النقل',
  'form.office': 'عنوان المكتب الرئيسي',
  'form.vehicle': 'أرقام الشاحنة / المقطورة',
  'form.shipment': 'رقم مستند الشحن أو نوع البضاعة',
  'form.submit': 'خطّط الرحلة',
  'form.loading': 'جارٍ تخطيط الرحلة…',
  'form.assume1': 'سائق شحن بضائع، 70 ساعة / 8 أيام',
  'form.assume2': 'تعبئة وقود كل 1,000 ميل على الأقل',
  'form.assume3': 'ساعة للاستلام وساعة للتسليم',

  'map.emptyTitle': 'أدخل رحلة لعرض المسار',
  'map.emptyText': 'ستحصل على المسار مع كل توقف مطلوب، وورقة سجل معبّأة لكل يوم.',
  'map.loading': 'جارٍ حساب المسار وساعات الخدمة…',
  'map.mile': 'الميل {n}',
  'map.driving': '{time} قيادة',
  'leg.0': 'إلى موقع الاستلام',
  'leg.1': 'إلى موقع التسليم',

  'stop.start': 'البداية',
  'stop.pretrip': 'فحص ما قبل الرحلة',
  'stop.pickup': 'الاستلام',
  'stop.dropoff': 'التسليم',
  'stop.fuel': 'تعبئة وقود',
  'stop.break': 'استراحة 30 دقيقة',
  'stop.rest': 'راحة 10 ساعات',
  'stop.restart': 'إعادة ضبط 34 ساعة',
  'stop.drive': 'قيادة {miles}',

  'status.off_duty': 'خارج الخدمة',
  'status.sleeper': 'سرير النوم',
  'status.driving': 'قيادة',
  'status.on_duty': 'في الخدمة (بدون قيادة)',

  'summary.label': 'ملخص الرحلة',
  'summary.distance': 'المسافة الكلية',
  'summary.driving': 'وقت القيادة',
  'summary.doorToDoor': '{time} من البداية للنهاية',
  'summary.arrival': 'الوصول',
  'summary.arrivalSub': '{time}، بعد اكتمال التسليم',
  'summary.sheets': 'أوراق السجل',
  'summary.day': 'يوم واحد',
  'summary.days': '{n} أيام',
  'summary.noStops': 'لا حاجة لتوقفات راحة',
  'summary.cycle': 'الدورة بعد الرحلة',
  'summary.count.rest': '{n} × راحة 10 ساعات',
  'summary.count.fuel': '{n} × وقود',
  'summary.count.break': '{n} × استراحة 30 دقيقة',
  'summary.count.restart': '{n} × إعادة ضبط 34 ساعة',

  'schedule.title': 'جدول الرحلة',
  'schedule.subtitle': 'التوقفات والراحات التي تفرضها قواعد ساعات الخدمة',

  'logs.title': 'أوراق السجل اليومي',
  'logs.print': 'طباعة كل الأوراق ({n})',
  'logs.day': 'اليوم {n}',
  'logs.tabs': 'يوم ورقة السجل',

  'unit.miles': '{n} ميل',
  'unit.h': 'س',
  'unit.m': 'د',

  'error.network': 'تعذّر الوصول إلى الخادم. تحقق من الاتصال وحاول مرة أخرى.',
  'error.unknown': 'حدث خطأ. حاول مرة أخرى.',
}

const MESSAGES: Record<Lang, Record<Key, string>> = { en, ar }
// Arabic text with Western digits, so times and distances match the log sheet.
const LOCALE: Record<Lang, string> = { en: 'en-US', ar: 'ar-u-nu-latn' }

function makeI18n(lang: Lang) {
  const locale = LOCALE[lang]
  const t = (key: string, vars: Record<string, string | number> = {}) => {
    const template = MESSAGES[lang][key as Key] ?? key
    return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''))
  }
  return {
    lang,
    t,
    /** 135 -> "2h 15m" */
    duration(minutes: number) {
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      const h = `${hours}${t('unit.h')}`
      const m = `${rest}${t('unit.m')}`
      if (!hours) return m
      return rest ? `${h} ${m}` : h
    },
    miles: (value: number) => t('unit.miles', { n: value.toLocaleString('en-US') }),
    /** "2026-10-02T14:15" -> "2:15 PM" */
    clock: (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
    /** "2026-10-02" or a full ISO time -> "Fri, Oct 2" */
    dayLabel: (iso: string) =>
      new Date(iso.length === 10 ? `${iso}T00:00` : iso).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
  }
}

type I18n = ReturnType<typeof makeI18n> & { toggleLang: () => void }

const I18nContext = createContext<I18n | null>(null)

function stored(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private browsing: the choice just isn't remembered
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (stored('lang') === 'ar' ? 'ar' : 'en'))

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = MESSAGES[lang]['app.title']
    store('lang', lang)
  }, [lang])

  const value = useMemo(() => ({ ...makeI18n(lang), toggleLang: () => setLang(lang === 'en' ? 'ar' : 'en') }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}

export type Theme = 'light' | 'dark'

/** Light or dark, following the system until the user picks one. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = stored('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    store('theme', next)
    setTheme(next)
  }
  return { theme, toggleTheme }
}
