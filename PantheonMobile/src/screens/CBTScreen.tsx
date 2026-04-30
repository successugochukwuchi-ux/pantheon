import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTheme } from '../context/ThemeContext';
import { QuestionSheet } from '../types';
import { ChevronRight, ClipboardList } from 'lucide-react-native';

export const CBTScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [sheets, setSheets] = useState<QuestionSheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSheets = async () => {
      try {
        const q = query(collection(db, 'questionSheets'), where('isAvailable', '==', true));
        const querySnapshot = await getDocs(q);
        const sheetItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSheet));
        setSheets(sheetItems);
      } catch (error) {
        console.error('Error fetching sheets:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSheets();
  }, []);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.sheetItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('CBTQuiz', { sheetId: item.id, title: `${item.academicLevel}L ${item.year}` })}
          >
            <View style={styles.sheetInfo}>
              <View style={[styles.iconContainer, { backgroundColor: colors.muted }]}>
                <ClipboardList size={24} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{item.academicLevel} Level - {item.year}</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>{item.semester} Semester</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No CBT practice sessions available.</Text>}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  sheetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sheetSubtitle: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
  },
});
