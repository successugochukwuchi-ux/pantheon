import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'package:pantheon_flutter/screens/cbt_quiz_screen.dart';

class CBTPracticeScreen extends StatefulWidget {
  const CBTPracticeScreen({super.key});

  @override
  State<CBTPracticeScreen> createState() => _CBTPracticeScreenState();
}

class _CBTPracticeScreenState extends State<CBTPracticeScreen> {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('CBT Practice'),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: _db.collection('cbt_questions').snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(child: Text('Error: ${snapshot.error}'));
          }
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final questions = snapshot.data?.docs ?? [];

          if (questions.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.cpu, size: 64, color: Colors.grey),
                  SizedBox(height: 16),
                  Text('No CBT questions available yet.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(20),
            itemCount: questions.length,
            itemBuilder: (context, index) {
              final question = questions[index].data() as Map<String, dynamic>;
              return _buildQuestionCard(context, question);
            },
          );
        },
      ),
    );
  }

  Widget _buildQuestionCard(BuildContext context, Map<String, dynamic> question) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => CBTQuizScreen(questionData: question)),
      ),
      child: Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.purple.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    question['courseCode'] ?? 'General',
                    style: const TextStyle(color: Colors.purple, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
                const Spacer(),
                const Icon(LucideIcons.helpCircle, size: 16, color: Colors.grey),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              question['question'] ?? 'No question text provided.',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 20),
            // Options would go here
            const Text('Options:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 8),
            ...(question['options'] as List? ?? []).map((opt) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.secondary.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(opt.toString()),
              ),
            )).toList(),
          ],
        ),
      ),
    );
  }
}
