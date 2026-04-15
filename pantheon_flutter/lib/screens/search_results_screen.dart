import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lucide_icons/lucide_icons.dart';

class SearchResultsScreen extends StatelessWidget {
  const SearchResultsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final query = ModalRoute.of(context)?.settings.arguments as String? ?? '';
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Results for "$query"'),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('lecture_notes').snapshots(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final results = snapshot.data?.docs.where((doc) {
            final data = doc.data() as Map<String, dynamic>;
            final title = (data['title'] ?? '').toString().toLowerCase();
            final code = (data['courseCode'] ?? '').toString().toLowerCase();
            return title.contains(query.toLowerCase()) || code.contains(query.toLowerCase());
          }).toList() ?? [];

          if (results.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(LucideIcons.searchX, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  Text('No results found for "$query"', style: const TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(20),
            itemCount: results.length,
            itemBuilder: (context, index) {
              final note = results[index].data() as Map<String, dynamic>;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: const Icon(LucideIcons.fileText),
                  title: Text(note['title'] ?? 'Untitled'),
                  subtitle: Text(note['courseCode'] ?? 'General'),
                  onTap: () {},
                ),
              );
            },
          );
        },
      ),
    );
  }
}
