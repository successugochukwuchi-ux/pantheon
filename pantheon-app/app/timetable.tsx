import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import { getDownloadedCoursesLocal } from '../lib/db';
import * as Notifications from 'expo-notifications';

// Dynamic loaders for platform-specific alarm packages
let ExpoAlarmKit: any = null;
let ExpoAlarmModule: any = null;

try {
  if (Platform.OS === 'ios') {
    ExpoAlarmKit = require('expo-alarm-kit');
  } else if (Platform.OS === 'android') {
    ExpoAlarmModule = require('expo-alarm-module');
  }
} catch (err) {
  console.warn('[Reminders Sync] Dynamic require for expo-alarm package failed:', err);
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute < 10 ? `0${minute}` : minute;
  return `${displayHour}:${displayMinute} ${ampm}`;
}

export function generateSlots(blockSize: '20min' | '30min' | '1hr') {
  const slots: { id: string; name: string; hour: number; minute: number }[] = [];
  const startHour = 8;
  const endHour = 22;

  if (blockSize === '1hr') {
    for (let h = startHour; h < endHour; h++) {
      slots.push({
        id: `slot_1h_${h}`,
        name: `${formatTime(h, 0)} - ${formatTime(h + 1, 0)}`,
        hour: h,
        minute: 0
      });
    }
  } else if (blockSize === '30min') {
    for (let h = startHour; h < endHour; h++) {
      slots.push({
        id: `slot_30m_${h}_0`,
        name: `${formatTime(h, 0)} - ${formatTime(h, 30)}`,
        hour: h,
        minute: 0
      });
      slots.push({
        id: `slot_30m_${h}_30`,
        name: `${formatTime(h, 30)} - ${formatTime(h + 1, 0)}`,
        hour: h,
        minute: 30
      });
    }
  } else if (blockSize === '20min') {
    for (let h = startHour; h < endHour; h++) {
      slots.push({
        id: `slot_20m_${h}_0`,
        name: `${formatTime(h, 0)} - ${formatTime(h, 20)}`,
        hour: h,
        minute: 0
      });
      slots.push({
        id: `slot_20m_${h}_20`,
        name: `${formatTime(h, 20)} - ${formatTime(h, 40)}`,
        hour: h,
        minute: 20
      });
      slots.push({
        id: `slot_20m_${h}_40`,
        name: `${formatTime(h, 40)} - ${formatTime(h + 1, 0)}`,
        hour: h,
        minute: 40
      });
    }
  }
  return slots;
}

const PRESET_ACTIVITIES = [
  { code: 'STUDY', title: 'Personal Study Block', isCustom: true },
  { code: 'BREAK', title: 'Rest & Refreshment', isCustom: true },
  { code: 'RESEARCH', title: 'Research & Project Work', isCustom: true },
  { code: 'REVISION', title: 'Past Question Revision', isCustom: true },
];

const DAY_TO_WEEKDAY_MAP: Record<string, number> = {
  'Sunday': 1,
  'Monday': 2,
  'Tuesday': 3,
  'Wednesday': 4,
  'Thursday': 5,
  'Friday': 6,
  'Saturday': 7,
};

const createEmptyTimetable = (blockSize: '20min' | '30min' | '1hr' = '1hr') => {
  const table: Record<string, Record<string, { code: string; title: string; isCustom?: boolean }>> = {};
  const slots = generateSlots(blockSize);
  DAYS.forEach(day => {
    table[day] = {};
    slots.forEach(slot => {
      table[day][slot.id] = { code: '', title: '' };
    });
  });
  return table;
};

async function requestNotifPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus === 'denied') {
    Alert.alert(
      "Permissions Required",
      "Notification permissions are currently disabled on your device. Please enable notifications in System Settings to trigger timely study alarms.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings",
          onPress: async () => {
            try {
              if (Platform.OS === 'ios') {
                await Linking.openURL('app-settings:');
              } else {
                await Linking.openSettings();
              }
            } catch (err) {
              console.warn('[Reminders Sync] Failed to open system settings:', err);
              Alert.alert("Error", "We're unable to open Settings automatically. Please enable permissions manually in your device Settings.");
            }
          },
        },
      ]
    );
    return false;
  }

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

function getNextOccurrence(weekday: number, hour: number, minute: number): Date {
  const result = new Date();
  const targetDay = weekday - 1;
  let attempts = 0;
  while (attempts < 14) {
    if (result.getDay() === targetDay) {
      result.setHours(hour, minute, 0, 0);
      if (result.getTime() > Date.now() + 10000) {
        return result;
      }
    }
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
    attempts++;
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

async function scheduleStudyReminders(timetableGrid: any, blockSize: '20min' | '30min' | '1hr' = '1hr') {
  let androidPermissionWarning = false;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[Reminders Sync] Failed to clear previous Notifications:', err);
  }

  if (Platform.OS === 'ios' && ExpoAlarmKit) {
    try {
      if (typeof ExpoAlarmKit.cancelAllAlarms === 'function') {
        await ExpoAlarmKit.cancelAllAlarms();
      } else if (typeof ExpoAlarmKit.clearAlarms === 'function') {
        await ExpoAlarmKit.clearAlarms();
      }
    } catch (err) {
      console.warn('[Reminders Sync] Failed to clear alarms via expo-alarm-kit:', err);
    }
  } else if (Platform.OS === 'android' && ExpoAlarmModule) {
    try {
      if (typeof ExpoAlarmModule.cancelAllAlarms === 'function') {
        await ExpoAlarmModule.cancelAllAlarms();
      } else if (typeof ExpoAlarmModule.clearAlarms === 'function') {
        await ExpoAlarmModule.clearAlarms();
      }
    } catch (err) {
      console.warn('[Reminders Sync] Failed to clear alarms via expo-alarm-module:', err);
    }
  }

  const slots = generateSlots(blockSize);
  let count = 0;
  for (const day of DAYS) {
    const daySlots = timetableGrid[day] || {};
    const weekdayNum = DAY_TO_WEEKDAY_MAP[day];
    if (!weekdayNum) continue;

    for (const [slotId, assigned] of Object.entries(daySlots)) {
      const slotDef = slots.find(s => s.id === slotId);
      if (!slotDef) continue;

      const item = assigned as { code?: string; title?: string };
      if (item && item.code && item.code !== '') {
        const { hour, minute } = slotDef;
        const standardHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayMinute = minute < 10 ? `0${minute}` : minute;

        const titleText = `📚 Study Block: ${item.code}`;
        const bodyText = `Starting now at ${standardHour}:${displayMinute} ${period}. Time block: "${item.title || item.code}". Let's learn!`;

        if (Platform.OS === 'ios') {
          let alarmScheduled = false;
          if (ExpoAlarmKit) {
            try {
              if (typeof ExpoAlarmKit.setAlarm === 'function') {
                await ExpoAlarmKit.setAlarm({
                  hour,
                  minute,
                  title: titleText,
                  message: bodyText,
                  repeats: true,
                  weekday: weekdayNum,
                });
                alarmScheduled = true;
              }
            } catch (err) {
              console.warn('[Reminders Sync] expo-alarm-kit setAlarm failed:', err);
            }
          }

          if (!alarmScheduled) {
            await Notifications.scheduleNotificationAsync({
              content: { title: titleText, body: bodyText, sound: true },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                weekday: weekdayNum,
                hour,
                minute,
                repeats: true,
              } as any,
            });
          }
          count++;
        } else {
          let alarmScheduled = false;
          if (ExpoAlarmModule) {
            try {
              if (typeof ExpoAlarmModule.setAlarm === 'function') {
                await ExpoAlarmModule.setAlarm({
                  hour,
                  minute,
                  title: titleText,
                  message: bodyText,
                  repeats: true,
                  weekday: weekdayNum,
                });
                alarmScheduled = true;
              }
            } catch (err) {
              console.warn('[Reminders Sync] expo-alarm-module setAlarm failed:', err);
              androidPermissionWarning = true;
            }
          }

          if (!alarmScheduled) {
            const nextDate1 = getNextOccurrence(weekdayNum, hour, minute);
            const nextDate2 = new Date(nextDate1.getTime() + 7 * 24 * 60 * 60 * 1000);

            await Notifications.scheduleNotificationAsync({
              content: { title: titleText, body: bodyText, sound: true },
              trigger: nextDate1,
            });
            count++;

            if (count < 40) {
              await Notifications.scheduleNotificationAsync({
                content: { title: titleText, body: bodyText, sound: true },
                trigger: nextDate2,
              });
              count++;
            }
          } else {
            count++;
          }
        }
      }
    }
  }
  if (Platform.OS === 'android' && androidPermissionWarning) {
    Alert.alert(
      "Precise Alarms Access Needed",
      "We encountered an issue scheduling precise hardware alarms on your device. Please verify that 'Alarms & Reminders' permission is enabled for CoLearn in your Android system Special App Access settings.",
      [
        { text: "Dismiss", style: "cancel" },
        { text: "Open Settings", onPress: () => {
          try {
            Linking.openSettings();
          } catch (err) {
            console.warn('[Reminders Sync] Failed to open system settings:', err);
          }
        }}
      ]
    );
  }

  return count;
}

// Isolated live clock so 1-second ticks never re-render the timetable matrix
const LiveClockBanner = React.memo(function LiveClockBanner({
  timezoneString,
  C,
  s,
}: {
  timezoneString: string;
  C: any;
  s: any;
}) {
  const [systemTime, setSystemTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const localTimeString = systemTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const localDateString = systemTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={[s.clockCard, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
      <View style={s.clockHeader}>
        <View style={s.clockStatusDot} />
        <Text style={[s.clockTitle, { color: C.inkMid }]}>LOCAL SYSTEM CLOCK (ALIGNED)</Text>
      </View>
      <View style={s.clockRow}>
        <Text style={[s.clockTimeText, { color: C.ink }]}>{localTimeString}</Text>
        <View style={s.clockMeta}>
          <Text style={[s.clockZoneText, { color: C.ink }]}>{timezoneString}</Text>
          <Text style={[s.clockDateText, { color: C.inkLight }]}>{localDateString}</Text>
        </View>
      </View>
      <Text style={s.clockFooter}>
        ✓ Study alarm notifications recalculate precisely to synchronize with your system clock.
      </Text>
    </View>
  );
});

const MatrixCell = React.memo(function MatrixCell({
  day,
  slotId,
  code,
  isCustom,
  isSelectedDay,
  onPressCell,
  C,
  s,
}: {
  day: string;
  slotId: string;
  code: string;
  isCustom: boolean;
  isSelectedDay: boolean;
  onPressCell: (day: string, slotId: string) => void;
  C: any;
  s: any;
}) {
  const hasValue = code !== '';
  return (
    <TouchableOpacity
      style={[
        s.matrixCell,
        isSelectedDay && { borderWidth: 1.5, borderColor: C.ink },
        hasValue && (isCustom ? { backgroundColor: '#FFF5EB' } : { backgroundColor: '#EEF2FF' }),
      ]}
      onPress={() => onPressCell(day, slotId)}
      activeOpacity={0.75}
    >
      {hasValue ? (
        <Text
          style={[
            s.matrixCellCodeText,
            isCustom ? { color: '#D97706' } : { color: C.ink },
          ]}
          numberOfLines={1}
          ellipsizeMode="clip"
        >
          {code}
        </Text>
      ) : (
        <Text style={[s.matrixCellEmptyText, { color: C.border }]}>+</Text>
      )}
    </TouchableOpacity>
  );
});

const DailySlotTile = React.memo(function DailySlotTile({
  slotId,
  rangeLabel,
  code,
  title,
  isCustom,
  onPressTile,
  onClearTile,
  C,
  s,
}: {
  slotId: string;
  rangeLabel: string;
  code: string;
  title: string;
  isCustom: boolean;
  onPressTile: (slotId: string) => void;
  onClearTile: (slotId: string) => void;
  C: any;
  s: any;
}) {
  const hasValue = code !== '';
  return (
    <TouchableOpacity
      style={[
        s.gridTileItem,
        { backgroundColor: C.surface, borderColor: C.border },
        hasValue &&
          (isCustom
            ? { backgroundColor: '#FFF5EB', borderColor: '#FFD1A4' }
            : { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }),
      ]}
      onPress={() => onPressTile(slotId)}
      activeOpacity={0.8}
    >
      <View style={s.tileHeader}>
        <Text style={[s.tileTimeText, { color: C.inkMid }]}>{rangeLabel}</Text>
        {hasValue && (
          <TouchableOpacity
            style={s.tileClearBtn}
            onPress={(e) => {
              e.stopPropagation();
              onClearTile(slotId);
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, color: C.error, fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.tileBody}>
        {hasValue ? (
          <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View
              style={[
                s.tileCodeBadge,
                isCustom ? { backgroundColor: '#FFA500' } : { backgroundColor: C.ink },
              ]}
            >
              <Text style={s.tileCodeBadgeText} numberOfLines={1}>
                {code}
              </Text>
            </View>
            <Text style={[s.tileCourseTitle, { color: C.ink }]} numberOfLines={2}>
              {title.includes(':') ? title.split(':').slice(1).join(':').trim() : title}
            </Text>
          </View>
        ) : (
          <View style={s.tileEmptyContainer}>
            <Text style={[s.tileEmptyText, { color: C.inkLight }]}>+ Free</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function TimetableScreen() {
  const router = useRouter();
  const { profile, user, systemConfig } = useAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);

  const [viewMode, setViewMode] = useState<'matrix' | 'daily'>('matrix');

  const timezoneString = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'System TZ';
    } catch {
      return 'Local Time';
    }
  }, []);

  const [blockSize, setBlockSize] = useState<'20min' | '30min' | '1hr'>('1hr');
  const [timetable, setTimetable] = useState<
    Record<string, Record<string, { code: string; title: string; isCustom?: boolean }>>
  >(() => createEmptyTimetable('1hr'));
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecommended, setHasRecommended] = useState(false);
  const [recommendedGrid, setRecommendedGrid] = useState<any | null>(null);
  const [recommendedBlockSize, setRecommendedBlockSize] = useState<'20min' | '30min' | '1hr'>('1hr');

  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedBlockItem, setSelectedBlockItem] = useState<{
    code: string;
    title: string;
    isCustom?: boolean;
  } | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  const selectedBlockItemRef = useRef(selectedBlockItem);
  selectedBlockItemRef.current = selectedBlockItem;
  const selectedDayRef = useRef(selectedDay);
  selectedDayRef.current = selectedDay;

  const slots = useMemo(() => generateSlots(blockSize), [blockSize]);

  const slotShortRanges = useMemo(() => {
    const map: Record<string, string> = {};
    const stepMins = blockSize === '20min' ? 20 : blockSize === '30min' ? 30 : 60;
    for (const slot of slots) {
      const startStr = formatTime(slot.hour, slot.minute)
        .replace(':00', '')
        .replace(' AM', 'a')
        .replace(' PM', 'p');
      let endHour = slot.hour;
      let endMinute = slot.minute + stepMins;
      if (endMinute >= 60) {
        endHour += Math.floor(endMinute / 60);
        endMinute = endMinute % 60;
      }
      const endStr = formatTime(endHour, endMinute)
        .replace(':00', '')
        .replace(' AM', 'a')
        .replace(' PM', 'p');
      map[slot.id] = `${startStr} - ${endStr}`;
    }
    return map;
  }, [slots, blockSize]);

  const studentLevel = profile?.academicLevel || (profile?.level ? `${profile.level}00` : '100');
  const studentDept = profile?.department || 'Computer Science';

  const isUnactivatedStudent =
    (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  useEffect(() => {
    if (isUnactivatedStudent) {
      setLoading(false);
      return;
    }

    if (!profile || !user) return;

    let cancelled = false;
    const cacheKey = `colearn_timetable_${user.uid}`;
    const recId = `${studentLevel}_${studentDept.replace(/\s+/g, '_')}`;
    const recCacheKey = `colearn_timetable_rec_${recId}`;

    // Instant hydration from AsyncStorage cache so the screen opens immediately
    Promise.all([AsyncStorage.getItem(cacheKey), AsyncStorage.getItem(recCacheKey)])
      .then(([cachedStr, recStr]) => {
        if (cancelled) return;
        if (cachedStr) {
          try {
            const data = JSON.parse(cachedStr);
            if (data.blockSize) setBlockSize(data.blockSize);
            if (data.grid) setTimetable(data.grid);
            if (data.remindersEnabled !== undefined) setRemindersEnabled(data.remindersEnabled);
            setLoading(false);
          } catch {}
        }
        if (recStr) {
          try {
            const rData = JSON.parse(recStr);
            if (rData.blockSize) setRecommendedBlockSize(rData.blockSize);
            if (rData.grid) {
              setRecommendedGrid(rData.grid);
              setHasRecommended(true);
            }
          } catch {}
        }
      })
      .catch(() => {});

    // 1. Fetch available course options (SQLite first to save reads)
    try {
      const semesterArg = systemConfig?.currentSemester === '2nd' ? '2nd' : '1st';
      const localCourses = getDownloadedCoursesLocal();
      if (localCourses && localCourses.length > 0) {
        getFilteredCoursesForStudent(localCourses, profile, true, semesterArg).then((relevant) => {
          if (!cancelled && relevant && relevant.length > 0) {
            setCourses(relevant);
          }
        });
      } else {
        const coursesQuery = query(collection(db, 'courses'), where('semester', '==', semesterArg));
        getDocs(coursesQuery)
          .then(async (snapshot) => {
            const allFetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any));
            const relevant = await getFilteredCoursesForStudent(allFetched, profile, true, semesterArg);
            if (!cancelled) setCourses(relevant);
          })
          .catch((err) => {
            console.error('Error loading timetable courses:', err);
            handleFirestoreError(err, OperationType.LIST, 'courses');
          });
      }
    } catch (e) {
      console.log('Error checking local courses in timetable:', e);
    }

    // 2. Fetch User timetable & Recommended timetable in parallel
    Promise.all([
      getDoc(doc(db, 'timetables', user.uid))
        .then((snapshot) => {
          if (!cancelled && snapshot.exists()) {
            const data = snapshot.data();
            if (data.blockSize) setBlockSize(data.blockSize);
            if (data.grid) setTimetable(data.grid);
            if (data.remindersEnabled !== undefined) setRemindersEnabled(data.remindersEnabled);
            AsyncStorage.setItem(
              cacheKey,
              JSON.stringify({
                blockSize: data.blockSize || '1hr',
                grid: data.grid || null,
                remindersEnabled: data.remindersEnabled,
              })
            ).catch(() => {});
          }
        })
        .catch((err) => {
          console.error('Error loading timetable from Firestore:', err);
          handleFirestoreError(err, OperationType.GET, `timetables/${user.uid}`);
        }),
      getDoc(doc(db, 'recommended_timetables', recId))
        .then((snapshot) => {
          if (!cancelled && snapshot.exists()) {
            const rData = snapshot.data();
            if (rData.blockSize) setRecommendedBlockSize(rData.blockSize);
            if (rData.grid) {
              setRecommendedGrid(rData.grid);
              setHasRecommended(true);
            }
            AsyncStorage.setItem(
              recCacheKey,
              JSON.stringify({
                blockSize: rData.blockSize || '1hr',
                grid: rData.grid || null,
              })
            ).catch(() => {});
          }
        })
        .catch((err) => {
          console.error('Error checking recommended timetable:', err);
          handleFirestoreError(err, OperationType.GET, `recommended_timetables/${recId}`);
        }),
    ]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [profile, user, isUnactivatedStudent, studentLevel, studentDept, systemConfig]);

  // Stable callbacks so MatrixCell / DailySlotTile never re-render when painting unrelated slots
  const handleMatrixCellPress = useCallback((day: string, slotId: string) => {
    setSelectedDay(day);
    const activeBrush = selectedBlockItemRef.current;
    if (activeBrush) {
      setTimetable((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [slotId]: {
            code: activeBrush.code,
            title: activeBrush.title,
            isCustom: activeBrush.isCustom || false,
          },
        },
      }));
    }
  }, []);

  const handleDailyTilePress = useCallback((slotId: string) => {
    const day = selectedDayRef.current;
    const activeBrush = selectedBlockItemRef.current;
    if (activeBrush) {
      setTimetable((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [slotId]: {
            code: activeBrush.code,
            title: activeBrush.title,
            isCustom: activeBrush.isCustom || false,
          },
        },
      }));
    } else {
      setTimetable((prev) => {
        if (!prev[day]?.[slotId]?.code) return prev;
        return {
          ...prev,
          [day]: {
            ...prev[day],
            [slotId]: { code: '', title: '' },
          },
        };
      });
    }
  }, []);

  const handleClearCell = useCallback((slotId: string) => {
    const day = selectedDayRef.current;
    setTimetable((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [slotId]: { code: '', title: '' },
      },
    }));
  }, []);

  const handleApplyRecommended = () => {
    if (!recommendedGrid) return;
    Alert.alert(
      "Confirm Load",
      "Applying the recommended timetable will overwrite your current schedule draft. Do you wish to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace",
          onPress: () => {
            setBlockSize(recommendedBlockSize);
            setTimetable(recommendedGrid);
            Alert.alert("Success", `Loaded recommended study blocks for ${studentDept} (${studentLevel} LVL)`);
          }
        }
      ]
    );
  };

  const handleResetTimetable = () => {
    Alert.alert(
      "Reset Schedule",
      "Are you sure you want to clear the entire timetable sheet?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            setTimetable(createEmptyTimetable(blockSize));
          }
        }
      ]
    );
  };

  const handleSaveAndSync = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload = {
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        grid: timetable,
        remindersEnabled,
        blockSize,
      };
      AsyncStorage.setItem(
        `colearn_timetable_${user.uid}`,
        JSON.stringify({ blockSize, grid: timetable, remindersEnabled })
      ).catch(() => {});

      await setDoc(doc(db, 'timetables', user.uid), payload);

      if (remindersEnabled) {
        const isGranted = await requestNotifPermissions();
        if (isGranted) {
          const count = await scheduleStudyReminders(timetable, blockSize);
          const nowTimeStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          Alert.alert(
            "Schedule Synchronized",
            `Your study timetable is now active offline! Based on your active device system time (${nowTimeStr}) in the ${timezoneString} timezone, we've registered ${count} weekly periodic reminders aligned with your agenda.`
          );
        } else {
          Alert.alert(
            "Permissions Denied",
            "Timetable saved! However, we couldn't schedule study reminders because notification permissions are disabled on this device. Please permit notifications in System Settings to get notified."
          );
        }
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        Alert.alert("Schedule Saved", "Your timetable was saved. Alarms and notifications have been paused.");
      }
    } catch (err) {
      console.error("Save timetable failed:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      Alert.alert(
        "Error",
        `Failed to preserve your timetable on cloud databases. Check your network.\n\nCode/Details: ${errMsg}`
      );
      handleFirestoreError(err, OperationType.WRITE, `timetables/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isUnactivatedStudent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.iconBtn}>
            <View style={[s.backArrow, { backgroundColor: C.ink }]} />
            <View style={[s.backArrowHead, { borderColor: C.ink }]} />
          </TouchableOpacity>
          <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]}>
            STUDY TIMETABLE
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FFE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40 }}>📅</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 22, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            Study Timetable Locked
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 }}>
            The Study Timetable feature is a premium utility reserved for verified activated profiles. Unlock your account to manage weekly academic calendars, copy recommended cohorts timetables, and receive automated study alarms!
          </Text>

          <TouchableOpacity
            style={{ width: '100%', height: 56, backgroundColor: C.ink, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bg }}>ACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ width: '100%', height: 56, borderWidth: 1, borderColor: C.border, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.inkMid }}>BACK TO DASHBOARD</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.backArrow, { backgroundColor: C.ink }]} />
          <View style={[s.backArrowHead, { borderColor: C.ink }]} />
        </TouchableOpacity>
        <Text style={[s.headerTextTitle, { color: C.ink }]}>Study Timetable</Text>
        <TouchableOpacity
          onPress={handleSaveAndSync}
          disabled={isSaving}
          style={[s.headerActionBtn, { backgroundColor: C.ink }]}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <Text style={[s.headerActionText, { color: C.bg }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={C.ink} />
          <Text style={{ marginTop: 12, fontSize: 13, color: C.inkLight, fontFamily: F.mono }}>Loading schedule...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            style={s.scrollView}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <LiveClockBanner timezoneString={timezoneString} C={C} s={s} />

            <View style={[s.cohortBox, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.cohortSub, { color: C.inkLight }]}>ACADEMIC DIVISION</Text>
                <Text style={[s.cohortTitle, { color: C.ink }]} numberOfLines={1}>
                  {studentDept} ({studentLevel} Level)
                </Text>
              </View>
              {hasRecommended && (
                <TouchableOpacity
                  style={[s.recBtn, { backgroundColor: C.activeBg }]}
                  onPress={handleApplyRecommended}
                  activeOpacity={0.8}
                >
                  <Text style={[s.recBtnText, { color: C.activeText }]}>Standard</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[s.cohortBox, { backgroundColor: C.bgAlt, borderColor: C.border, marginTop: -8, marginBottom: 16 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.cohortSub, { color: C.inkLight, marginBottom: 6 }]}>CHOOSE BLOCK SIZE</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['20min', '30min', '1hr'] as const).map((blockVal) => {
                    const isSelected = blockSize === blockVal;
                    return (
                      <TouchableOpacity
                        key={blockVal}
                        onPress={() => {
                          if (blockSize === blockVal) return;
                          Alert.alert(
                            "Change Block Size",
                            "Changing your preferred study block spacing will reset your current timetable draft to fit the custom spacing grid. Proceed?",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Reset & Change",
                                style: "destructive",
                                onPress: () => {
                                  setBlockSize(blockVal);
                                  setTimetable(createEmptyTimetable(blockVal));
                                }
                              }
                            ]
                          );
                        }}
                        style={[
                          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
                          isSelected && { backgroundColor: C.ink, borderColor: C.ink }
                        ]}
                      >
                        <Text style={[{ fontSize: 12, fontFamily: F.bold, color: C.ink }, isSelected && { color: C.bg }]}>
                          {blockVal === '20min' ? '20 Min' : blockVal === '30min' ? '30 Min' : '1 Hour'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={[s.switchRow, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[s.switchLabel, { color: C.ink }]}>Enable Study Alarms</Text>
                <Text style={[s.switchSub, { color: C.inkMid }]}>Trigger device alerts when a block starts.</Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={async (value) => {
                  setRemindersEnabled(value);
                  if (value) {
                    const granted = await requestNotifPermissions();
                    if (!granted) {
                      setRemindersEnabled(false);
                    }
                  }
                }}
                trackColor={{ false: C.border, true: C.ink }}
                thumbColor={C.bg}
              />
            </View>

            <View style={s.viewToggleRow}>
              <TouchableOpacity
                style={[s.toggleTab, viewMode === 'matrix' && s.toggleTabActive]}
                onPress={() => setViewMode('matrix')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleTabText, viewMode === 'matrix' && s.toggleTabTextActive, { color: C.ink }]}>
                  📅 Weekly Grid Board
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleTab, viewMode === 'daily' && s.toggleTabActive]}
                onPress={() => setViewMode('daily')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleTabText, viewMode === 'daily' && s.toggleTabTextActive, { color: C.ink }]}>
                  📋 Daily Tile Grid
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[s.paintInstructionBox, { backgroundColor: '#FFF9E6', borderColor: '#FFE89C' }]}>
              <Text style={{ fontFamily: F.bold, color: '#B78103', fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>
                💡 SMART DEPOSITION BRUSH
              </Text>
              <Text style={{ fontFamily: F.medium, color: '#8A5D00', fontSize: 12, lineHeight: 18 }}>
                Select an activity block below, then tap any Slot in the grid to place it. Tap any assigned slot or its clear button to clear it.
              </Text>
            </View>

            <Text style={[s.sectionHeader, { color: C.inkLight }]}>SELECT ACTIVITY BLOCK TO PAINT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -16, paddingHorizontal: 16, marginBottom: 20 }}
            >
              <View style={s.brushSelectorRow}>
                {courses.map((course) => {
                  const isSelected = selectedBlockItem?.code === course.code;
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        s.brushChip,
                        { backgroundColor: C.surface, borderColor: C.border },
                        isSelected && { backgroundColor: C.ink, borderColor: C.ink }
                      ]}
                      onPress={() => setSelectedBlockItem(isSelected ? null : { code: course.code, title: course.title })}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        s.brushChipText,
                        { color: C.ink },
                        isSelected && { color: C.bg, fontFamily: F.bold }
                      ]}>
                        🎨 {course.code}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {PRESET_ACTIVITIES.map((act) => {
                  const isSelected = selectedBlockItem?.code === act.code;
                  return (
                    <TouchableOpacity
                      key={act.code}
                      style={[
                        s.brushChip,
                        { backgroundColor: C.surface, borderColor: C.border },
                        isSelected && { backgroundColor: C.ink, borderColor: C.ink }
                      ]}
                      onPress={() => setSelectedBlockItem(isSelected ? null : act)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        s.brushChipText,
                        { color: C.ink },
                        isSelected && { color: C.bg, fontFamily: F.bold }
                      ]}>
                        ⭐ {act.code}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {selectedBlockItem && (
              <View style={[s.brushActiveBar, { backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }]}>
                <Text style={{ color: C.bg, fontFamily: F.bold, fontSize: 12, flex: 1 }}>
                  🖌️ Brush: "{selectedBlockItem.code}" is active. Tap slots to paint!
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: C.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                  onPress={() => setSelectedBlockItem(null)}
                >
                  <Text style={{ fontSize: 11, fontFamily: F.bold, color: C.ink }}>Cancel Brush</Text>
                </TouchableOpacity>
              </View>
            )}

            {viewMode === 'matrix' ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={[s.sectionHeader, { color: C.inkLight }]}>WEEK METRIC MATRIX GRID</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={{ marginHorizontal: -16 }}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
                >
                  <View style={[s.matrixContainer, { borderColor: C.border, backgroundColor: C.surface }]}>
                    <View style={[s.matrixHeaderRow, { backgroundColor: C.border }]}>
                      <View style={s.matrixTimeHeaderCell}>
                        <Text style={[s.matrixHeaderCellText, { color: C.ink, fontFamily: F.bold }]}>Time Block</Text>
                      </View>
                      {DAYS.map((day) => (
                        <View key={day} style={s.matrixHeaderCell}>
                          <Text style={[s.matrixHeaderCellText, { color: C.ink, fontFamily: F.bold }]}>
                            {day.substring(0, 3).toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {slots.map((slot) => (
                      <View key={slot.id} style={[s.matrixRow, { borderBottomColor: C.border }]}>
                        <View style={[s.matrixTimeCell, { backgroundColor: C.bgAlt }]}>
                          <Text style={[s.matrixTimeText, { color: C.ink }]}>
                            {formatTime(slot.hour, slot.minute).replace(' AM', 'a').replace(' PM', 'p').replace(':00', '')}
                          </Text>
                        </View>

                        {DAYS.map((day) => {
                          const assigned = timetable[day]?.[slot.id];
                          return (
                            <MatrixCell
                              key={day}
                              day={day}
                              slotId={slot.id}
                              code={assigned?.code || ''}
                              isCustom={Boolean(assigned?.isCustom)}
                              isSelectedDay={selectedDay === day}
                              onPressCell={handleMatrixCellPress}
                              C={C}
                              s={s}
                            />
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
                <Text style={{ fontSize: 11, fontFamily: F.mono, color: C.inkLight, textAlign: 'center', marginTop: 10 }}>
                  ← Swipe horizontally to view full scheduler board matrix →
                </Text>
              </View>
            ) : (
              <View>
                <View style={s.daysWrap}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 4 }}>
                    {DAYS.map((day) => {
                      const isActive = selectedDay === day;
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            s.dayButton,
                            { backgroundColor: C.surface, borderColor: C.border },
                            isActive && { backgroundColor: C.ink, borderColor: C.ink }
                          ]}
                          onPress={() => setSelectedDay(day)}
                          activeOpacity={0.8}
                        >
                          <Text style={[
                            s.dayButtonText,
                            { color: C.ink },
                            isActive && { color: C.bg, fontFamily: F.bold }
                          ]}>
                            {day.substring(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                <Text style={[s.sectionHeader, { color: C.inkLight }]}>{selectedDay.toUpperCase()} TIMESLOTS GRID</Text>
                <View style={s.dailyGridRow}>
                  {slots.map((slot) => {
                    const assigned = timetable[selectedDay]?.[slot.id];
                    return (
                      <DailySlotTile
                        key={slot.id}
                        slotId={slot.id}
                        rangeLabel={slotShortRanges[slot.id] || ''}
                        code={assigned?.code || ''}
                        title={assigned?.title || ''}
                        isCustom={Boolean(assigned?.isCustom)}
                        onPressTile={handleDailyTilePress}
                        onClearTile={handleClearCell}
                        C={C}
                        s={s}
                      />
                    );
                  })}
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[s.dangerBtn, { borderColor: C.error }]}
              onPress={handleResetTimetable}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: F.bold, color: C.error, fontSize: 14 }}>Reset Whole Sheet Grid</Text>
            </TouchableOpacity>

            <View style={{ height: 110 }} />
          </ScrollView>
        </View>
      )}

      <BottomNav active="notes" />
    </SafeAreaView>
  );
}

const createStyles = (C: any) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    backArrow: { position: 'absolute', width: 16, height: 2, borderRadius: 1 },
    backArrowHead: {
      position: 'absolute',
      left: 10,
      width: 9,
      height: 9,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      transform: [{ rotate: '45deg' }],
    },
    headerBrand: { fontFamily: F.bold, fontSize: 14, letterSpacing: 2 },
    headerTextTitle: { fontFamily: F.bold, fontSize: 17, flex: 1, marginLeft: 12 },
    headerActionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    headerActionText: { fontFamily: F.bold, fontSize: 13 },
    
    scrollView: { flex: 1 },
    scrollContent: { padding: 16 },

    // Clock Status Styles
    clockCard: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 16,
    },
    clockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    clockStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10B981',
      marginRight: 6,
    },
    clockTitle: {
      fontFamily: F.bold,
      fontSize: 10,
      letterSpacing: 1.2,
    },
    clockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    clockTimeText: {
      fontFamily: F.mono,
      fontSize: 24,
      fontWeight: 'bold',
    },
    clockMeta: {
      alignItems: 'flex-end',
    },
    clockZoneText: {
      fontFamily: F.mono,
      fontSize: 10,
      fontWeight: '500',
    },
    clockDateText: {
      fontFamily: F.medium,
      fontSize: 11,
    },
    clockFooter: {
      fontFamily: F.mono,
      fontSize: 10,
      marginTop: 8,
      color: '#10B981',
    },

    cohortBox: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    cohortSub: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1.2, marginBottom: 4 },
    cohortTitle: { fontFamily: F.bold, fontSize: 15 },
    recBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    recBtnText: { fontFamily: F.bold, fontSize: 11 },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 16,
    },
    switchLabel: { fontFamily: F.bold, fontSize: 15, marginBottom: 4 },
    switchSub: { fontFamily: F.body, fontSize: 12, lineHeight: 16 },

    // View Toggle Row
    viewToggleRow: {
      flexDirection: 'row',
      borderWidth: 1,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
    },
    toggleTab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    toggleTabActive: {
      backgroundColor: '#FFFFFF',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 1,
    },
    toggleTabText: {
      fontFamily: F.medium,
      fontSize: 12,
    },
    toggleTabTextActive: {
      fontFamily: F.bold,
    },

    paintInstructionBox: {
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginBottom: 20,
    },

    sectionHeader: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1.5, marginBottom: 12 },
    
    brushSelectorRow: { flexDirection: 'row', gap: 8 },
    brushChip: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    brushChipText: { fontFamily: F.medium, fontSize: 13 },

    brushActiveBar: {
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 20,
    },

    daysWrap: { marginBottom: 16 },
    dayButton: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 6,
    },
    dayButtonText: { fontFamily: F.medium, fontSize: 13 },

    // Weekly Matrix Board Grid Styles
    matrixContainer: {
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
    },
    matrixHeaderRow: {
      flexDirection: 'row',
    },
    matrixRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
    },
    matrixHeaderCell: {
      width: 75,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matrixTimeHeaderCell: {
      width: 70,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matrixHeaderCellText: {
      fontSize: 10,
      letterSpacing: 0.5,
    },
    matrixTimeCell: {
      width: 70,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matrixTimeText: {
      fontFamily: F.mono,
      fontSize: 10,
      fontWeight: 'bold',
    },
    matrixCell: {
      width: 75,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
    },
    matrixCellCodeText: {
      fontFamily: F.bold,
      fontSize: 10,
      textAlign: 'center',
    },
    matrixCellEmptyText: {
      fontFamily: F.mono,
      fontSize: 14,
    },

    // Daily Tile Grid Styles
    dailyGridRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    gridTileItem: {
      width: '48.5%',
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      minHeight: 110,
      marginBottom: 10,
      justifyContent: 'space-between',
    },
    tileHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 6,
      marginBottom: 6,
    },
    tileTimeText: {
      fontFamily: F.mono,
      fontSize: 9,
      fontWeight: 'bold',
    },
    tileClearBtn: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tileBody: {
      flex: 1,
      justifyContent: 'center',
    },
    tileCodeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginBottom: 4,
    },
    tileCodeBadgeText: {
      fontFamily: F.bold,
      fontSize: 10,
      color: '#FFFFFF',
    },
    tileCourseTitle: {
      fontFamily: F.medium,
      fontSize: 11,
      lineHeight: 14,
    },
    tileEmptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tileEmptyText: {
      fontFamily: F.mono,
      fontSize: 12,
    },

    dangerBtn: {
      borderRadius: 14,
      borderWidth: 1.5,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 12,
    },
  });
