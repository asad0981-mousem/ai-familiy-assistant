import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../core/api_exception.dart';
import '../core/session.dart';
import '../models/device.dart';
import '../models/family_member.dart';
import 'policy_editor_screen.dart';

class ChildDetailScreen extends StatefulWidget {
  final FamilyMember child;

  const ChildDetailScreen({super.key, required this.child});

  @override
  State<ChildDetailScreen> createState() => _ChildDetailScreenState();
}

class _ChildDetailScreenState extends State<ChildDetailScreen> {
  List<Device> _devices = [];
  bool _isLoadingDevices = true;
  Map<String, dynamic>? _latestLocation;
  bool _isLoadingLocation = false;

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() => _isLoadingDevices = true);
    final session = context.read<Session>();
    try {
      final raw = await session.api.listDevices();
      final all = raw.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();
      setState(() {
        _devices = all.where((d) => d.childId == widget.child.id).toList();
        _isLoadingDevices = false;
      });
    } on ApiException catch (e) {
      await session.handleUnauthorized(e);
      if (mounted) {
        setState(() => _isLoadingDevices = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  Future<void> _enrollDevice() async {
    final session = context.read<Session>();
    try {
      final result = await session.api.enrollDevice(childId: widget.child.id);
      final deviceToken = result['deviceToken'] as String;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('دستگاه ثبت شد'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'این کد را در اپ Device Agent (روی دستگاه فرزند) وارد کنید. '
                'این کد فقط همین یک‌بار نمایش داده می‌شود:',
              ),
              const SizedBox(height: 12),
              SelectableText(
                deviceToken,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: deviceToken));
                Navigator.of(context).pop();
              },
              child: const Text('کپی و بستن'),
            ),
          ],
        ),
      );
      _loadDevices();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _sendCommand(Device device) async {
    final type = await showDialog<CommandType>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('ارسال دستور'),
        children: CommandType.values
            .map(
              (t) => SimpleDialogOption(
                onPressed: () => Navigator.of(context).pop(t),
                child: Text(t.label),
              ),
            )
            .toList(),
      ),
    );
    if (type == null || !mounted) return;

    final session = context.read<Session>();
    try {
      await session.api.sendCommand(deviceId: device.id, type: type.wireValue);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('دستور «${type.label}» صف شد — Device Agent آن را در Poll بعدی اجرا می‌کند')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _toggleConsent(bool grant) async {
    final session = context.read<Session>();
    try {
      if (grant) {
        await session.api.grantLocationConsent(widget.child.id);
      } else {
        await session.api.revokeLocationConsent(widget.child.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(grant ? 'Consent موقعیت مکانی فعال شد' : 'Consent موقعیت مکانی لغو شد')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _loadLatestLocation() async {
    setState(() => _isLoadingLocation = true);
    final session = context.read<Session>();
    try {
      final result = await session.api.getLatestLocation(widget.child.id);
      setState(() {
        _latestLocation = result;
        _isLoadingLocation = false;
      });
    } on ApiException catch (e) {
      setState(() => _isLoadingLocation = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.child.displayName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const Icon(Icons.rule),
              title: const Text('Policy (محدودیت‌ها)'),
              subtitle: const Text('زمان صفحه، اپ‌های مسدود، برنامه خواب'),
              trailing: const Icon(Icons.chevron_left),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => PolicyEditorScreen(childId: widget.child.id),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('موقعیت مکانی', style: Theme.of(context).textTheme.titleMedium),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _toggleConsent(true),
                  child: const Text('فعال‌سازی Consent'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _toggleConsent(false),
                  child: const Text('لغو Consent'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: _isLoadingLocation ? null : _loadLatestLocation,
            child: Text(_isLoadingLocation ? 'در حال دریافت...' : 'نمایش آخرین موقعیت'),
          ),
          if (_latestLocation != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Lat: ${_latestLocation!['lat']}, Lng: ${_latestLocation!['lng']}\n'
                'زمان: ${_latestLocation!['capturedAt']}',
              ),
            ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('دستگاه‌ها', style: Theme.of(context).textTheme.titleMedium),
              TextButton.icon(
                onPressed: _enrollDevice,
                icon: const Icon(Icons.add),
                label: const Text('ثبت دستگاه جدید'),
              ),
            ],
          ),
          if (_isLoadingDevices)
            const Center(child: CircularProgressIndicator())
          else if (_devices.isEmpty)
            const Text('هنوز دستگاهی برای این فرزند ثبت نشده است')
          else
            ..._devices.map(
              (device) => Card(
                child: ListTile(
                  leading: const Icon(Icons.phone_android),
                  title: Text(device.model ?? device.id),
                  subtitle: Text('وضعیت: ${device.status} — حالت: ${device.managementMode}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.send),
                    tooltip: 'ارسال دستور',
                    onPressed: () => _sendCommand(device),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
