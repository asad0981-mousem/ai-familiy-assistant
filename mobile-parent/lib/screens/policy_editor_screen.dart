import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_exception.dart';
import '../core/session.dart';
import '../models/policy.dart';

/// ویرایشگر Policy — نسخه (version) هر بار که از سرور خوانده می‌شود نگه‌داری می‌شود و در PATCH
/// به‌عنوان expectedVersion فرستاده می‌شود (Optimistic Locking — فصل ۹/۱۱ Blueprint). اگر بین
/// خواندن و ذخیره، شخص دیگری (مثلاً والد دیگر خانواده) Policy را تغییر داده باشد، سرور ۴۰۹
/// برمی‌گرداند و این صفحه به‌جای بازنویسی کور، از کاربر می‌خواهد دوباره بارگذاری کند.
class PolicyEditorScreen extends StatefulWidget {
  final String childId;

  const PolicyEditorScreen({super.key, required this.childId});

  @override
  State<PolicyEditorScreen> createState() => _PolicyEditorScreenState();
}

class _PolicyEditorScreenState extends State<PolicyEditorScreen> {
  Policy? _policy;
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  final _screenTimeController = TextEditingController();
  final _blockedAppsController = TextEditingController();
  final _sleepStartController = TextEditingController();
  final _sleepEndController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _screenTimeController.dispose();
    _blockedAppsController.dispose();
    _sleepStartController.dispose();
    _sleepEndController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final session = context.read<Session>();
    try {
      final raw = await session.api.getCurrentPolicy(widget.childId);
      final policy = Policy.fromJson(raw);
      setState(() {
        _policy = policy;
        _screenTimeController.text = policy.screenTimeMinutesPerDay?.toString() ?? '';
        _blockedAppsController.text = policy.blockedApps.join(', ');
        _sleepStartController.text = policy.sleepSchedule?.start ?? '';
        _sleepEndController.text = policy.sleepSchedule?.end ?? '';
        _isLoading = false;
      });
    } on ApiException catch (e) {
      await session.handleUnauthorized(e);
      setState(() {
        _isLoading = false;
        _errorMessage = e.message;
      });
    }
  }

  Future<void> _save() async {
    if (_policy == null) return;
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    final session = context.read<Session>();

    final screenTimeText = _screenTimeController.text.trim();
    final blockedApps = _blockedAppsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    final sleepStart = _sleepStartController.text.trim();
    final sleepEnd = _sleepEndController.text.trim();

    try {
      final raw = await session.api.updatePolicy(
        widget.childId,
        screenTimeMinutesPerDay: screenTimeText.isEmpty ? null : int.tryParse(screenTimeText),
        blockedApps: blockedApps,
        sleepSchedule: (sleepStart.isNotEmpty && sleepEnd.isNotEmpty)
            ? {'start': sleepStart, 'end': sleepEnd}
            : null,
        expectedVersion: _policy!.version,
      );
      setState(() {
        _policy = Policy.fromJson(raw);
        _isSaving = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Policy ذخیره شد — دستور sync_policy برای دستگاه صف شد')),
        );
      }
    } on ApiException catch (e) {
      setState(() => _isSaving = false);
      if (e.isConflict) {
        setState(() => _errorMessage = 'این Policy در این فاصله توسط شخص دیگری تغییر کرده — دوباره بارگذاری کنید');
      } else {
        setState(() => _errorMessage = e.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ویرایش Policy'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_policy != null)
                  Text(
                    'نسخه فعلی: ${_policy!.version}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: _screenTimeController,
                  decoration: const InputDecoration(labelText: 'سقف زمان صفحه (دقیقه در روز)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _blockedAppsController,
                  decoration: const InputDecoration(
                    labelText: 'اپ‌های مسدود (با کاما جدا کنید)',
                    hintText: 'com.example.game, com.example.social',
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _sleepStartController,
                        decoration: const InputDecoration(labelText: 'شروع خواب (HH:mm)'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _sleepEndController,
                        decoration: const InputDecoration(labelText: 'پایان خواب (HH:mm)'),
                      ),
                    ),
                  ],
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 12),
                  Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _isSaving ? null : _save,
                  child: _isSaving ? const Text('در حال ذخیره...') : const Text('ذخیره Policy'),
                ),
              ],
            ),
    );
  }
}
