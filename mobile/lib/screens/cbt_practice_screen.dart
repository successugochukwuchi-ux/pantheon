import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pantheon_mobile/providers/questions_provider.dart';
import 'package:pantheon_mobile/screens/exam_player_screen.dart';

class CBTPracticeScreen extends ConsumerWidget {
  const CBTPracticeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(title: const Text('CBT Practice')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select a Course', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
            const SizedBox(height: 8),
            const Text('Practice with simulated exam conditions.', style: TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 32),
            Expanded(
              child: coursesAsync.when(
                data: (courses) => courses.isEmpty 
                  ? const Center(child: Text('No courses available yet.'))
                  : ListView.builder(
                      itemCount: courses.length,
                      itemBuilder: (context, index) {
                        final course = courses[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: _CourseCard(
                            title: course.title,
                            code: course.code,
                            questions: course.questionCount,
                            onTap: () async {
                              // Fetch questions and start exam
                              final questions = await ref.read(questionsProvider(course.id).future);
                              if (context.mounted) {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (context) => ExamPlayerScreen(
                                      questions: questions.map((q) => {
                                        'text': q.text,
                                        'correctAnswer': q.correctAnswer,
                                        'incorrectAnswers': q.incorrectAnswers,
                                      }).toList(),
                                      title: course.title,
                                    ),
                                  ),
                                );
                              }
                            },
                          ),
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

class _CourseCard extends StatelessWidget {
  final String title;
  final String code;
  final int questions;
  final VoidCallback onTap;
  const _CourseCard({required this.title, required this.code, required this.questions, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.school, color: Color(0xFF3B82F6), size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                  Text('$code • $questions Questions', style: const TextStyle(color: Color(0xFF64748B), fontSize: 14)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }
}
