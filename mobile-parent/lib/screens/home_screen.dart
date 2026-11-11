import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_exception.dart';
import '../core/session.dart';
import '../models/family_member.dart';
import 'child_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<FamilyMember>> _membersFuture;

  @override
  void initState() {
    super.initState();
    _membersFuture = _loadMembers();
  }

  Future<List<FamilyMember>> _loadMembers() async {
    final session = context.read<Session>();
    try {
      final raw = await session.api.listFamilyMembers();
      return raw
          .map((e) => FamilyMember.fromJson(e as Map<String, dynamic>))
          .toList();
    } on ApiException catch (e) {
      await session.handleUnauthorized(e);
      rethrow;
    }
  }

  void _refresh() => setState(() => _membersFuture = _loadMembers());

  Future<void> _showAddChildDialog() async {
    final nameController = TextEditingController();
    String ageBand = '7-9';
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('افزودن فرزند'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'نام فرزند'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: ageBand,
                decoration: const InputDecoration(labelText: 'بازه سنی'),
                items: const [
                  DropdownMenuItem(value: '4-6', child: Text('۴ تا ۶ سال')),
                  DropdownMenuItem(value: '7-9', child: Text('۷ تا ۹ سال')),
                  DropdownMenuItem(value: '10-12', child: Text('۱۰ تا ۱۲ سال')),
                ],
                onChanged: (v) => setDialogState(() => ageBand = v ?? ageBand),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('افزودن'),
            ),
          ],
        ),
      ),
    );

    if (result == true && nameController.text.trim().isNotEmpty && mounted) {
      final session = context.read<Session>();
      try {
        await session.api.createChild(
          displayName: nameController.text.trim(),
          ageBand: ageBand,
        );
        _refresh();
      } on ApiException catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('خانواده من'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'خروج',
            onPressed: () => context.read<Session>().logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => _refresh(),
        child: FutureBuilder<List<FamilyMember>>(
          future: _membersFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                children: [
                  const SizedBox(height: 80),
                  Center(child: Text('خطا در دریافت اطلاعات: ${snapshot.error}')),
                ],
              );
            }
            final children = snapshot.data!.where((m) => m.isChild).toList();
            if (children.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 80),
                  Center(child: Text('هنوز فرزندی اضافه نشده است')),
                ],
              );
            }
            return ListView.builder(
              itemCount: children.length,
              itemBuilder: (context, index) {
                final child = children[index];
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.child_care)),
                  title: Text(child.displayName),
                  subtitle: Text(child.ageBand ?? ''),
                  trailing: const Icon(Icons.chevron_left),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => ChildDetailScreen(child: child),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddChildDialog,
        child: const Icon(Icons.add),
      ),
    );
  }
}
