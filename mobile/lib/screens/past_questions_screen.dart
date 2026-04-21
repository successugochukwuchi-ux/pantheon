import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pantheon_mobile/providers/questions_provider.dart';

class PastQuestionsScreen extends ConsumerWidget {
  const PastQuestionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(title: const Text('Past Questions')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Study Library', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            const SizedBox(height: 8),
            const Text('Access archived exam papers and study guides.', style: TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 32),
            Expanded(
              child: coursesAsync.when(
                data: (courses) => courses.isEmpty 
                  ? const Center(child: Text('No study materials available yet.'))
                  : ListView.builder(
                      itemCount: courses.length,
                      itemBuilder: (context, index) {
                        final course = courses[index];
                        return _DocumentCard(
                          title: course.title,
                          code: course.code,
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Opening ${course.code} documents... (Migration in progress)')),
                            );
                          },
                        );
                      },
                    ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, stack) => Center(child: Text('Error: $err')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  final String title;
  final String code;
  final VoidCallback onTap;
  const _DocumentCard({required this.title, required this.code, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              const Icon(Icons.picture_as_pdf, color: Color(0xFFEF4444), size: 32),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                    Text('$code Study Bundle', style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                  ],
                ),
              ),
              const Icon(Icons.download, color: Color(0xFF3B82F6), size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
