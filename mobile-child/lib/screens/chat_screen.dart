import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_exception.dart';
import '../core/session.dart';
import '../models/chat_message.dart';

/// صفحه اصلی اپ کودک — گفتگوی چت با AI Tutor. هر پیام ارسالی به backend's
/// POST /api/v1/ai-tutor/messages می‌رود و پاسخ (reply) به لیست اضافه می‌شود؛ conversationId
/// پاسخ اول برای پیام‌های بعدی نگه‌داشته می‌شود تا Tutor به تاریخچه/Memory دسترسی داشته باشد.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _messages = <ChatMessage>[];
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  String? _conversationId;
  bool _isSending = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _messages.add(
      ChatMessage(
        content: 'سلام! من Tutor زبان انگلیسی‌ت هستم. چی دوست داری تمرین کنیم؟ 🎉',
        isFromChild: false,
      ),
    );
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() {
      _messages.add(ChatMessage(content: text, isFromChild: true));
      _inputController.clear();
      _isSending = true;
      _errorMessage = null;
    });
    _scrollToBottom();

    final session = context.read<Session>();
    try {
      final result = await session.api.sendTutorMessage(
        content: text,
        conversationId: _conversationId,
      );
      _conversationId = result['conversationId'] as String?;
      setState(() {
        _messages.add(
          ChatMessage(
            content: result['reply'] as String,
            isFromChild: false,
            provider: result['provider'] as String?,
          ),
        );
      });
    } on ApiException catch (e) {
      await session.handleUnauthorized(e);
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = 'اتصال به سرور ناموفق بود');
    } finally {
      if (mounted) setState(() => _isSending = false);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<Session>();
    return Scaffold(
      appBar: AppBar(
        title: Text('سلام ${session.displayName ?? ''} 👋'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'خروج',
            onPressed: () => session.logout(),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(12),
              itemCount: _messages.length,
              itemBuilder: (context, index) => _MessageBubble(message: _messages[index]),
            ),
          ),
          if (_isSending)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
            ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      decoration: const InputDecoration(
                        hintText: 'پیامت رو بنویس...',
                        border: OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _isSending ? null : _send,
                    icon: const Icon(Icons.send),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ChatMessage message;

  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isChild = message.isFromChild;
    return Align(
      alignment: isChild ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isChild
              ? Theme.of(context).colorScheme.secondaryContainer
              : Theme.of(context).colorScheme.primaryContainer,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(message.content),
      ),
    );
  }
}
