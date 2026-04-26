import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:go_router/go_router.dart';
import '../models/question.dart';

class ExamPlayerScreen extends StatefulWidget {
  final List<Question> questions;
  final bool isTimed;
  final int duration;
  final String courseId;

  const ExamPlayerScreen({
    super.key,
    required this.questions,
    required this.isTimed,
    required this.duration,
    required this.courseId,
  });

  @override
  State<ExamPlayerScreen> createState() => _ExamPlayerScreenState();
}

class _ExamPlayerScreenState extends State<ExamPlayerScreen> {
  int _currentIndex = 0;
  final Map<String, String> _answers = {};
  late Timer _timer;
  int _timeLeft = 0;
  late List<List<String>> _randomizedOptions;

  @override
  void initState() {
    super.initState();
    _timeLeft = widget.duration * 60;
    if (widget.isTimed) {
      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (mounted) {
          setState(() {
            if (_timeLeft > 0) {
              _timeLeft--;
            } else {
              _timer.cancel();
              _submit();
            }
          });
        }
      });
    }

    _randomizedOptions = widget.questions.map((q) {
      final options = [q.correctAnswer, ...q.incorrectAnswers];
      options.shuffle();
      return options;
    }).toList();
  }

  @override
  void dispose() {
    if (widget.isTimed) _timer.cancel();
    super.dispose();
  }

  void _submit() {
    context.pushReplacement('/cbt-results', extra: {
      'questions': widget.questions,
      'answers': _answers,
      'courseId': widget.courseId,
      'timeSpent': widget.duration * 60 - _timeLeft,
    });
  }

  String _formatTime(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final currentQuestion = widget.questions[_currentIndex];
    final options = _randomizedOptions[_currentIndex];

    return Scaffold(
      appBar: AppBar(
        title: Text('Question ${_currentIndex + 1}/${widget.questions.length}'),
        actions: [
          if (widget.isTimed)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Center(
                child: Text(
                  _formatTime(_timeLeft),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.red),
                ),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          LinearProgressIndicator(value: (_currentIndex + 1) / widget.questions.length),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  MarkdownBody(
                    data: currentQuestion.text,
                    styleSheet: MarkdownStyleSheet(p: const TextStyle(fontSize: 20)),
                  ),
                  const SizedBox(height: 32),
                  ...options.map((opt) => _buildOption(currentQuestion.id, opt)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                ElevatedButton(
                  onPressed: _currentIndex > 0 ? () => setState(() => _currentIndex--) : null,
                  child: const Text('Previous'),
                ),
                if (_currentIndex == widget.questions.length - 1)
                  ElevatedButton(
                    onPressed: _submit,
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                    child: const Text('Submit'),
                  )
                else
                  ElevatedButton(
                    onPressed: () => setState(() => _currentIndex++),
                    child: const Text('Next'),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOption(String questionId, String text) {
    final isSelected = _answers[questionId] == text;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => setState(() => _answers[questionId] = text),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: isSelected ? Colors.blue : Colors.grey.shade300, width: 2),
            borderRadius: BorderRadius.circular(12),
            color: isSelected ? Colors.blue.withValues(alpha: 0.05) : null,
          ),
          child: Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: isSelected ? Colors.blue : Colors.grey),
                  color: isSelected ? Colors.blue : null,
                ),
                child: isSelected ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
              ),
              const SizedBox(width: 16),
              Expanded(child: Text(text, style: const TextStyle(fontSize: 16))),
            ],
          ),
        ),
      ),
    );
  }
}
