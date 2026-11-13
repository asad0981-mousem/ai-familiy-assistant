import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_exception.dart';
import '../core/session.dart';

/// صفحه ورود کودک — به‌جای ایمیل/رمز عبور، «کد ورود» (همان childId که والد از صفحه فرزند در اپ
/// والد نشان می‌دهد) + PIN عددی چهار تا شش‌رقمی. اگر کد ورود قبلاً روی این دستگاه ذخیره شده
/// باشد (Session.rememberedChildId)، فقط PIN دوباره خواسته می‌شود تا کودک مجبور به تایپ UUID
/// در هر بار ورود نباشد.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _childIdController;
  final _pinController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;
  bool _showChildIdField = true;

  @override
  void initState() {
    super.initState();
    final remembered = context.read<Session>().rememberedChildId;
    _childIdController = TextEditingController(text: remembered ?? '');
    _showChildIdField = remembered == null;
  }

  @override
  void dispose() {
    _childIdController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });
    try {
      await context.read<Session>().login(
            childId: _childIdController.text.trim(),
            pin: _pinController.text,
          );
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } catch (e) {
      setState(() => _errorMessage = 'اتصال به سرور ناموفق بود');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _changeAccount() {
    setState(() {
      _showChildIdField = true;
      _childIdController.clear();
      _pinController.clear();
      _errorMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.emoji_people, size: 56),
                  const SizedBox(height: 12),
                  Text(
                    'سلام! برای شروع وارد شو',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  if (_showChildIdField)
                    TextFormField(
                      controller: _childIdController,
                      decoration: const InputDecoration(
                        labelText: 'کد ورود',
                        hintText: 'کدی که والدت به تو داده',
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'کد ورود را وارد کن' : null,
                    )
                  else
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle, size: 16, color: Colors.green),
                        const SizedBox(width: 8),
                        const Text('این دستگاه قبلاً شناسایی شده'),
                        TextButton(onPressed: _changeAccount, child: const Text('تغییر حساب')),
                      ],
                    ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _pinController,
                    decoration: const InputDecoration(
                      labelText: 'PIN',
                      hintText: 'مثلاً ۱۲۳۴',
                    ),
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    validator: (v) {
                      if (v == null || !RegExp(r'^\d{4,6}$').hasMatch(v)) {
                        return 'PIN باید ۴ تا ۶ رقم عددی باشد';
                      }
                      return null;
                    },
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 4),
                    Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _isSubmitting ? null : _submit,
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('ورود'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
