import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/data_provider.dart';
import '../models/course.dart';

class NotesScreen extends ConsumerStatefulWidget {
  final String type;
  const NotesScreen({super.key, required this.type});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_getTypeLabel(widget.type)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Search courses...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (value) => setState(() => _searchQuery = value),
            ),
          ),
          Expanded(
            child: coursesAsync.when(
              data: (courses) {
                final filtered = courses.where((c) =>
                  c.code.toLowerCase().contains(_searchQuery.toLowerCase()) ||
                  c.title.toLowerCase().contains(_searchQuery.toLowerCase())
                ).toList();

                if (filtered.isEmpty) {
                  return const Center(child: Text('No courses found.'));
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final course = filtered[index];
                    return _buildCourseCard(course);
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Error: $err')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCourseCard(Course course) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(course.code, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(course.title),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          // Show notes for this course
          _showNotesList(course);
        },
      ),
    );
  }

  void _showNotesList(Course course) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => Consumer(
          builder: (context, ref, child) {
            final notesAsync = ref.watch(notesProvider(course.id));
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    '${course.code} Materials',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                Expanded(
                  child: notesAsync.when(
                    data: (notes) {
                      final filtered = notes.where((n) => n.type == widget.type).toList();
                      if (filtered.isEmpty) {
                        return const Center(child: Text('No materials found.'));
                      }
                      return ListView.builder(
                        controller: scrollController,
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final note = filtered[index];
                          return ListTile(
                            title: Text(note.title),
                            subtitle: Text('Added on ${_formatDate(note.createdAt)}'),
                            onTap: () {
                              context.push('/note-viewer', extra: note);
                            },
                          );
                        },
                      );
                    },
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, stack) => Center(child: Text('Error: $err')),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  String _getTypeLabel(String type) {
    switch (type) {
      case 'lecture': return 'Lecture Notes';
      case 'punch': return 'Punch Notes';
      case 'past_question': return 'Past Questions';
      default: return 'Study Materials';
    }
  }

  String _formatDate(String iso) {
    try {
      final date = DateTime.parse(iso);
      return '${date.day}/${date.month}/${date.year}';
    } catch (_) {
      return iso;
    }
  }
}
