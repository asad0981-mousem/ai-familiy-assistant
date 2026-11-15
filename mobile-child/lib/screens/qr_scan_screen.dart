import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/qr_codes.dart';

/// صفحه اسکن کد ورود (QR) — جایگزین سریع‌تر برای تایپ دستی UUID در LoginScreen. والد همین مقدار
/// را از صفحه جزئیات فرزند در اپ والد («کد ورود اپ کودک») به‌صورت QR نشان می‌دهد.
/// تمام منطق اعتبارسنجی در core/qr_codes.dart است (قابل تست بدون دوربین واقعی)؛ این صفحه فقط
/// دوربین را نشان می‌دهد و نتیجه معتبر را با Navigator.pop برمی‌گرداند.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  bool _handled = false;

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final childId = extractChildIdFromScan(barcode.rawValue);
      if (childId != null) {
        _handled = true;
        Navigator.of(context).pop(childId);
        return;
      }
    }
    // کد نامعتبر (مثلاً QR یک سایت دیگر) نادیده گرفته می‌شود — صفحه بسته نمی‌شود تا کاربر
    // بتواند دوباره روی QR درست نشانه بگیرد.
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اسکن کد ورود')),
      body: Stack(
        children: [
          MobileScanner(onDetect: _onDetect),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              color: Colors.black54,
              padding: const EdgeInsets.all(16),
              child: const Text(
                'دوربین را روی کد QR که والدت نشان می‌دهد بگیر',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
