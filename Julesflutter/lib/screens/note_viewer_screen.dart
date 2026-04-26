import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/note.dart';

class NoteViewerScreen extends StatelessWidget {
  final Note note;
  const NoteViewerScreen({super.key, required this.note});

  @override
  Widget build(BuildContext context) {
    List<dynamic> blocks = [];
    try {
      blocks = jsonDecode(note.content);
    } catch (e) {
      blocks = [{'id': '1', 'type': 'text', 'content': note.content}];
    }

    return Scaffold(
      appBar: AppBar(title: Text(note.title)),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: blocks.length,
        itemBuilder: (context, index) {
          final block = blocks[index];
          return NoteBlockRenderer(block: block);
        },
      ),
    );
  }
}

class NoteBlockRenderer extends StatelessWidget {
  final Map<String, dynamic> block;
  const NoteBlockRenderer({super.key, required this.block});

  @override
  Widget build(BuildContext context) {
    final type = block['type'];
    final content = block['content'] ?? '';

    switch (type) {
      case 'h1':
        return Padding(
          padding: const EdgeInsets.only(bottom: 16, top: 8),
          child: Text(
            content,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
          ),
        );
      case 'h2':
        return Padding(
          padding: const EdgeInsets.only(bottom: 12, top: 4),
          child: Text(
            content,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
        );
      case 'text':
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: MarkdownBody(
            data: content,
            selectable: true,
            styleSheet: MarkdownStyleSheet(
              p: const TextStyle(fontSize: 16, height: 1.5),
            ),
          ),
        );
      case 'math':
        return Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Math.tex(
              content,
              textStyle: const TextStyle(fontSize: 18),
              onErrorFallback: (err) => Text(content, style: const TextStyle(fontFamily: 'monospace')),
            ),
          ),
        );
      case 'diagram':
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: content,
              placeholder: (context, url) => Container(
                height: 200,
                color: Colors.grey.shade100,
                child: const Center(child: CircularProgressIndicator()),
              ),
              errorWidget: (context, url, error) => const Icon(Icons.error),
              fit: BoxFit.contain,
            ),
          ),
        );
      case 'table':
        return _buildTable(content);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildTable(String jsonContent) {
    try {
      final List<dynamic> data = jsonDecode(jsonContent);
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(8),
        ),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            columns: List.generate(
              (data.first as List).length,
              (index) => const DataColumn(label: Text('')),
            ),
            rows: data.map((row) {
              return DataRow(
                cells: (row as List).map((cell) {
                  return DataCell(
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: MarkdownBody(data: cell.toString()),
                    ),
                  );
                }).toList(),
              );
            }).toList(),
            headingRowHeight: 0,
          ),
        ),
      );
    } catch (e) {
      return const Text('Error rendering table');
    }
  }
}
