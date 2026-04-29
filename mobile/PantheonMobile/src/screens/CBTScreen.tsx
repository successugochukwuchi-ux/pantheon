import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { theme } from '../theme';
import { QuestionSheet } from '../types';
import { ChevronRight, ClipboardList } from 'lucide-react-native';

export const CBTScreen = ({ navigation }: any) => {
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sheets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.sheetItem}
            onPress={() => navigation.navigate('CBTQuiz', { sheetId: item.id, title: `${item.academicLevel}L ${item.year}` })}
          >
            <View style={styles.sheetInfo}>
              <ClipboardList size={24} color={theme.colors.primary} />
              <View>
                <Text style={styles.sheetTitle}>{item.academicLevel} Level - {item.year}</Text>
                <Text style={styles.sheetSubtitle}>{item.semester} Semester</Text>
              </View>
            </View>
            <ChevronRight size={20} color={theme.colors.mutedForeground} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No CBT practice sessions available.</Text>}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: theme.spacing.lg,
  },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  sheetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.foreground,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.mutedForeground,
    marginTop: theme.spacing.xl,
  },
});
