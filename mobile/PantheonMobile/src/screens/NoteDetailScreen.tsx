import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { theme } from '../theme';

export const NoteDetailScreen = ({ route }: any) => {
  const { note } = route.params;
  const { width } = useWindowDimensions();

  const htmlContent = note.content
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
    .replace(/\*(.*)\*/gim, '<i>$1</i>')
    .replace(/\n/g, '<br/>');

  const source = {
    html: `<div style="color: ${theme.colors.foreground}; font-family: sans-serif;">${htmlContent}</div>`
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{note.title}</Text>
      </View>
      <View style={styles.content}>
        <RenderHtml
          contentWidth={width - theme.spacing.lg * 2}
          source={source}
          tagsStyles={{
            h1: { fontSize: 24, marginBottom: 10, fontWeight: 'bold' },
            h2: { fontSize: 20, marginBottom: 8, fontWeight: 'bold' },
            h3: { fontSize: 18, marginBottom: 6, fontWeight: 'bold' },
            br: { marginBottom: 5 }
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.muted,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.foreground,
  },
  content: {
    padding: theme.spacing.lg,
  },
});
