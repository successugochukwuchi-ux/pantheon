import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class CBTQuizScreen extends StatefulWidget {
  final Map<String, dynamic> questionData;
  const CBTQuizScreen({super.key, required this.questionData});

  @override
  State<CBTQuizScreen> createState() => _CBTQuizScreenState();
}

class _CBTQuizScreenState extends State<CBTQuizScreen> {
  int? _selectedOption;
  bool _isSubmitted = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final options = widget.questionData['options'] as List? ?? [];
    final correctAnswerIndex = widget.questionData['correctAnswerIndex'] as int? ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Practice Mode'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.questionData['question'] ?? 'No question text.',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 32),
            Expanded(
              child: ListView.builder(
                itemCount: options.length,
                itemBuilder: (context, index) {
                  final isSelected = _selectedOption == index;
                  final isCorrect = index == correctAnswerIndex;
                  
                  Color bgColor = theme.colorScheme.secondary.withOpacity(0.3);
                  Color borderColor = theme.colorScheme.onSurface.withOpacity(0.05);
                  
                  if (_isSubmitted) {
                    if (isCorrect) {
                      bgColor = Colors.green.withOpacity(0.1);
                      borderColor = Colors.green;
                    } else if (isSelected) {
                      bgColor = Colors.red.withOpacity(0.1);
                      borderColor = Colors.red;
                    }
                  } else if (isSelected) {
                    borderColor = theme.colorScheme.primary;
                  }

                  return GestureDetector(
                    onTap: _isSubmitted ? null : () => setState(() => _selectedOption = index),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: bgColor,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: borderColor, width: 2),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              options[index].toString(),
                              style: TextStyle(
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              ),
                            ),
                          ),
                          if (_isSubmitted && isCorrect)
                            const Icon(LucideIcons.checkCircle, color: Colors.green, size: 20),
                          if (_isSubmitted && isSelected && !isCorrect)
                            const Icon(LucideIcons.xCircle, color: Colors.red, size: 20),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _selectedOption == null || _isSubmitted 
                  ? (_isSubmitted ? () => Navigator.pop(context) : null)
                  : () => setState(() => _isSubmitted = true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary,
                  foregroundColor: theme.colorScheme.onPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: Text(_isSubmitted ? 'Close' : 'Submit Answer', style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
