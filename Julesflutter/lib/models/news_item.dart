class NewsItem {
  final String id;
  final String title;
  final String content;
  final String createdAt;

  NewsItem({
    required this.id,
    required this.title,
    required this.content,
    required this.createdAt,
  });

  factory NewsItem.fromMap(Map<String, dynamic> map, String id) {
    return NewsItem(
      id: id,
      title: map['title'] ?? '',
      content: map['content'] ?? '',
      createdAt: map['createdAt'] ?? '',
    );
  }
}
