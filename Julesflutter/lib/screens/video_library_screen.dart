import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/data_provider.dart';

class VideoLibraryScreen extends ConsumerWidget {
  const VideoLibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courses = ref.watch(coursesProvider).value ?? [];

    return Scaffold(
      appBar: AppBar(title: const Text('Video Library')),
      body: ListView.builder(
        itemCount: courses.length,
        itemBuilder: (context, index) {
          final course = courses[index];
          return Consumer(builder: (context, ref, child) {
            final notesAsync = ref.watch(notesProvider(course.id));
            return notesAsync.when(
              data: (notes) {
                final videoNotes = notes.where((n) => n.videoUrl != null && n.videoUrl!.isNotEmpty).toList();
                if (videoNotes.isEmpty) return const SizedBox.shrink();

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(course.code, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    ),
                    ...videoNotes.map((n) => ListTile(
                      leading: const Icon(Icons.play_circle_fill, color: Colors.red, size: 40),
                      title: Text(n.title),
                      subtitle: const Text('Tap to watch (Internet required)'),
                      onTap: () async {
                        final url = Uri.parse(n.videoUrl!);
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url, mode: LaunchMode.externalApplication);
                        } else {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Could not launch video URL')),
                            );
                          }
                        }
                      },
                    )),
                  ],
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (e, s) => const SizedBox.shrink(),
            );
          });
        },
      ),
    );
  }
}
