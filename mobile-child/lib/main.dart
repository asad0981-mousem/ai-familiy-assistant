import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/session.dart';
import 'screens/chat_screen.dart';
import 'screens/login_screen.dart';

/// قابل بازنویسی در زمان Build با: flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
const String _defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

void main() {
  runApp(const ChildApp());
}

class ChildApp extends StatefulWidget {
  const ChildApp({super.key});

  @override
  State<ChildApp> createState() => _ChildAppState();
}

class _ChildAppState extends State<ChildApp> {
  late final Session _session;

  @override
  void initState() {
    super.initState();
    final api = ApiClient(
      baseUrl: _defaultApiBaseUrl,
      tokenProvider: () => _session.accessToken,
      refreshTokenProvider: () => _session.refreshToken,
      onTokensRefreshed: (accessToken, refreshToken) =>
          _session.applyRefreshedTokens(accessToken, refreshToken),
      onRefreshFailed: () => _session.logout(),
    );
    _session = Session(api: api)..restore();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider<Session>.value(
      value: _session,
      child: MaterialApp(
        title: 'AI Family — کودک',
        debugShowCheckedModeBanner: false,
        locale: const Locale('fa'),
        theme: ThemeData(
          colorSchemeSeed: const Color(0xFF26A69A),
          useMaterial3: true,
        ),
        home: Consumer<Session>(
          builder: (context, session, _) {
            if (session.isLoading) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }
            return session.isAuthenticated ? const ChatScreen() : const LoginScreen();
          },
        ),
      ),
    );
  }
}
