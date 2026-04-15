import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:convert';

class LectureNotesScreen extends StatefulWidget {
  const LectureNotesScreen({super.key});

  @override
  State<LectureNotesScreen> createState() => _LectureNotesScreenState();
}

class _LectureNotesScreenState extends State<LectureNotesScreen> {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  List<Map<String, dynamic>> _offlineNotes = [];
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _loadOfflineNotes();
  }

  Future<void> _loadOfflineNotes() async {
    final prefs = await SharedPreferences.getInstance();
    final String? notesJson = prefs.getString('offline_lecture_notes');
    if (notesJson != null) {
      setState(() {
        _offlineNotes = (json.decode(notesJson) as List).map((e) => Map<String, dynamic>.from(e)).toList();
      });
    }
  }

  Future<void> _saveNotesOffline(List<Map<String, dynamic>> notes) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('offline_lecture_notes', json.encode(notes));
  }

  Future<void> _syncNotes() async {
    setState(() => _isSyncing = true);
    try {
      final snapshot = await _db.collection('lecture_notes').get();
      final notes = snapshot.docs.map((doc) => doc.data() as Map<String, dynamic>).toList();
      await _saveNotesOffline(notes);
      setState(() {
        _offlineNotes = notes;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Content synced for offline viewing')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sync failed: ${e.toString()}')),
        );
      }
    } finally {
      setState(() => _isSyncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Lecture Notes'),
        actions: [
          IconButton(
            icon: _isSyncing 
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(LucideIcons.refreshCw),
            onPressed: _isSyncing ? null : _syncNotes,
          ),
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _db.collection('lecture_notes').snapshots(),
        builder: (context, snapshot) {
          // If we have live data, use it and update offline cache
          if (snapshot.hasData) {
            final notes = snapshot.data!.docs.map((doc) => doc.data() as Map<String, dynamic>).toList();
            _saveNotesOffline(notes);
            return _buildNotesList(notes);
          }
          
          // If offline, show cached notes
          if (_offlineNotes.isNotEmpty) {
            return _buildNotesList(_offlineNotes);
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.wifiOff, size: 64, color: Colors.grey),
                SizedBox(height: 16),
                Text('No content available offline.', style: TextStyle(color: Colors.grey)),
                Text('Connect to internet to sync.', style: TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildNotesList(List<Map<String, dynamic>> notes) {
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: notes.length,
      itemBuilder: (context, index) {
        final note = notes[index];
        return _buildNoteCard(context, note);
      },
    );
  }

  Widget _buildNoteCard(BuildContext context, Map<String, dynamic> note) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: (note['imageUrl'] != null && note['imageUrl'].toString().isNotEmpty)
          ? ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: CachedNetworkImage(
                imageUrl: note['imageUrl'] as String,
                width: 50,
                height: 50,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(color: theme.colorScheme.secondary.withOpacity(0.3)),
                errorWidget: (context, url, error) => const Icon(LucideIcons.image),
              ),
            )
          : Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.fileText, color: Colors.blue),
            ),
        title: Text(
          note['title'] ?? 'Untitled Note',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(note['courseCode'] ?? 'General', style: TextStyle(color: theme.colorScheme.primary.withOpacity(0.7))),
            const SizedBox(height: 8),
            Text(
              note['description'] ?? 'No description available.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurface.withOpacity(0.6)),
            ),
          ],
        ),
        onTap: () {
          // View note logic
        },
      ),
    );
  }
}
