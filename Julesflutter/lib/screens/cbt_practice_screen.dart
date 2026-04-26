import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../providers/data_provider.dart';
import '../models/question.dart';

class CBTPracticeScreen extends ConsumerStatefulWidget {
  const CBTPracticeScreen({super.key});

  @override
  ConsumerState<CBTPracticeScreen> createState() => _CBTPracticeScreenState();
}

class _CBTPracticeScreenState extends ConsumerState<CBTPracticeScreen> {
  String? _selectedCourseId;
  List<String> _selectedSheetIds = [];
  int _numQuestions = 20;
  bool _isTimed = false;
  int _duration = 30;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final courses = ref.watch(coursesProvider).value ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('CBT Practice')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Configure Simulation', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            DropdownButtonFormField<String>(
              value: _selectedCourseId,
              decoration: const InputDecoration(labelText: 'Select Course', border: OutlineInputBorder()),
              items: courses.map((c) => DropdownMenuItem(value: c.id, child: Text('${c.code} - ${c.title}'))).toList(),
              onChanged: (val) => setState(() {
                _selectedCourseId = val;
                _selectedSheetIds = [];
              }),
            ),
            const SizedBox(height: 24),
            if (_selectedCourseId != null) ...[
              _buildSheetSelector(),
              const SizedBox(height: 24),
            ],
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    initialValue: _numQuestions.toString(),
                    decoration: const InputDecoration(labelText: 'Number of Questions', border: OutlineInputBorder()),
                    keyboardType: TextInputType.number,
                    onChanged: (val) => _numQuestions = int.tryParse(val) ?? 20,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: SwitchListTile(
                    title: const Text('Timed'),
                    value: _isTimed,
                    onChanged: (val) => setState(() => _isTimed = val),
                  ),
                ),
              ],
            ),
            if (_isTimed) ...[
              const SizedBox(height: 16),
              TextFormField(
                initialValue: _duration.toString(),
                decoration: const InputDecoration(labelText: 'Duration (Minutes)', border: OutlineInputBorder()),
                keyboardType: TextInputType.number,
                onChanged: (val) => _duration = int.tryParse(val) ?? 30,
              ),
            ],
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _selectedCourseId == null || _isLoading ? null : _startTest,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: const Color(0xFF0F172A),
                foregroundColor: Colors.white,
              ),
              child: _isLoading ? const CircularProgressIndicator() : const Text('Start Simulation'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetSelector() {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('questionSheets')
          .where('courseId', isEqualTo: _selectedCourseId)
          .where('isAvailable', isEqualTo: true)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const CircularProgressIndicator();
        final sheets = snapshot.data!.docs.map((d) => QuestionSheet.fromMap(d.data() as Map<String, dynamic>, d.id)).toList();

        if (sheets.isEmpty) return const Text('No questions available for this course.');

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Years (Optional)', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: sheets.map((s) {
                final isSelected = _selectedSheetIds.contains(s.id);
                return FilterChip(
                  label: Text(s.year),
                  selected: isSelected,
                  onSelected: (val) {
                    setState(() {
                      if (val) _selectedSheetIds.add(s.id);
                      else _selectedSheetIds.remove(s.id);
                    });
                  },
                );
              }).toList(),
            ),
          ],
        );
      },
    );
  }

  Future<void> _startTest() async {
    setState(() => _isLoading = true);
    try {
      final db = FirebaseFirestore.instance;
      final targetSheetIds = _selectedSheetIds.isNotEmpty
          ? _selectedSheetIds
          : (await db.collection('questionSheets')
              .where('courseId', isEqualTo: _selectedCourseId)
              .where('isAvailable', isEqualTo: true)
              .get()).docs.map((d) => d.id).toList();

      if (targetSheetIds.isEmpty) throw Exception("No questions available");

      List<Question> pool = [];
      for (var sheetId in targetSheetIds) {
        final qs = await db.collection('questions').where('sheetId', isEqualTo: sheetId).get();
        pool.addAll(qs.docs.map((d) => Question.fromMap(d.data(), d.id)));
      }

      pool.shuffle();
      final questions = pool.take(_numQuestions).toList();

      if (questions.isEmpty) throw Exception("No questions found");

      if (mounted) {
        context.push('/exam-player', extra: {
          'questions': questions,
          'isTimed': _isTimed,
          'duration': _duration,
          'courseId': _selectedCourseId,
        });
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
