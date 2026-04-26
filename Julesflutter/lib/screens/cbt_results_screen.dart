import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';
import '../models/question.dart';

class CBTResultsScreen extends StatelessWidget {
  final List<Question> questions;
  final Map<String, String> answers;
  final String courseId;
  final int timeSpent;

  const CBTResultsScreen({
    super.key,
    required this.questions,
    required this.answers,
    required this.courseId,
    required this.timeSpent,
  });

  @override
  Widget build(BuildContext context) {
    int score = 0;
    for (var q in questions) {
      if (answers[q.id] == q.correctAnswer) score++;
    }
    final percentage = (score / questions.length * 100).round();

    return Scaffold(
      appBar: AppBar(title: const Text('Results'), leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.go('/dashboard'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Center(
              child: Column(
                children: [
                  Text('$percentage%', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Colors.blue)),
                  Text('Score: $score/${questions.length}', style: const TextStyle(fontSize: 20)),
                  const SizedBox(height: 32),
                ],
              ),
            ),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('Review', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),
            ...questions.asMap().entries.map((entry) {
              final i = entry.key;
              final q = entry.value;
              final userAns = answers[q.id];
              final isCorrect = userAns == q.correctAnswer;

              return Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Question ${i + 1}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                      const SizedBox(height: 8),
                      MarkdownBody(data: q.text),
                      const SizedBox(height: 16),
                      _buildResultLine('Your Answer:', userAns ?? 'Not answered', isCorrect ? Colors.green : Colors.red),
                      if (!isCorrect)
                        _buildResultLine('Correct Answer:', q.correctAnswer, Colors.green),
                      if (q.explanation != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
                          child: Text('Explanation: ${q.explanation}', style: const TextStyle(fontStyle: FontStyle.italic)),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildResultLine(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          Expanded(child: Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold))),
        ],
      ),
    );
  }
}
