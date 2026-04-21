import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ExamPlayerScreen extends StatefulWidget {
  final List<dynamic> questions;
  final String title;
  const ExamPlayerScreen({super.key, required this.questions, required this.title});
  @override
  State<ExamPlayerScreen> createState() => _ExamPlayerScreenState();
}

class _ExamPlayerScreenState extends State<ExamPlayerScreen> {
  int _currentIndex = 0;
  final Map<int, String> _answers = {};
  bool _isFinished = false;

  void _submitExam() {
    setState(() => _isFinished = true);
  }

  int get _score {
    int correct = 0;
    for (int i = 0; i < widget.questions.length; i++) {
      if (_answers[i] == widget.questions[i]['correctAnswer']) {
        correct++;
      }
    }
    return correct;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: const Center(child: Text('No questions available.')),
      );
    }

    if (_isFinished) {
      return _buildResultsView();
    }

    final question = widget.questions[_currentIndex];
    final options = [...(question['incorrectAnswers'] ?? []), question['correctAnswer']];
    // Sort options randomly once or keep stable
    options.sort(); 

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '${_answers.length}/${widget.questions.length}',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF3B82F6)),
              ),
            ),
          )
        ],
      ),
      body: Column(
        children: [
          LinearProgressIndicator(
            value: (_currentIndex + 1) / widget.questions.length,
            backgroundColor: const Color(0xFFE2E8F0),
            color: const Color(0xFF3B82F6),
            minHeight: 6,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(20)),
                    child: Text(
                      'Question ${_currentIndex + 1}',
                      style: const TextStyle(color: Color(0xFF3B82F6), fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    question['text'] ?? '',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, height: 1.4, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 32),
                  ...options.map((option) {
                    final isSelected = _answers[_currentIndex] == option;
                    return GestureDetector(
                      onTap: () => setState(() => _answers[_currentIndex] = option as String),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFFE2E8F0), width: 2),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 24, height: 24,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFFCBD5E1), width: 2),
                                color: isSelected ? const Color(0xFF3B82F6) : Colors.transparent,
                              ),
                              child: isSelected ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(option as String, style: TextStyle(fontSize: 16, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal, color: const Color(0xFF0F172A)))),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))]),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                OutlinedButton(
                  onPressed: _currentIndex > 0 ? () => setState(() => _currentIndex--) : null,
                  style: OutlinedButton.styleFrom(minimumSize: const Size(120, 48)),
                  child: const Text('Back'),
                ),
                if (_currentIndex == widget.questions.length - 1)
                  ElevatedButton(
                    onPressed: _answers.length == widget.questions.length ? _submitExam : null,
                    style: ElevatedButton.styleFrom(minimumSize: const Size(120, 48), backgroundColor: const Color(0xFF22C55E)),
                    child: const Text('Submit'),
                  )
                else
                  ElevatedButton(
                    onPressed: () => setState(() => _currentIndex++),
                    style: ElevatedButton.styleFrom(minimumSize: const Size(120, 48)),
                    child: const Text('Next'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultsView() {
    final percentage = (_score / widget.questions.length * 100).round();
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.stars, size: 80, color: Color(0xFFEAB308)),
              const SizedBox(height: 24),
              const Text('Exam Completed!', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
              const SizedBox(height: 12),
              Text('You scored $_score out of ${widget.questions.length}', style: const TextStyle(fontSize: 18, color: Color(0xFF64748B))),
              const SizedBox(height: 48),
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
                child: Column(
                  children: [
                    Text('$percentage%', style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Color(0xFF3B82F6))),
                    const Text('Total Score', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const SizedBox(height: 48),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 56)),
                child: const Text('Done'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
